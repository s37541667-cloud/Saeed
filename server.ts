import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  ClientMessage,
  DrawingState,
  FarmState,
  GameId,
  GuessState,
  Player,
  PongState,
  PublicRoomSummary,
  RaceObstacle,
  RaceState,
  RoomStage,
  RoomState,
  ServerMessage,
} from './src/types.ts';
import {
  DRAWING_PROMPTS,
  FARM_CROPS,
  GUESS_CHARACTERS,
  PLAYER_COLORS,
} from './src/gameData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MAX_PLAYERS = 6;

interface GuessInternalExtra {
  deckIndices: number[];
  currentAnswer: string;
  lastClueStepAt: number;
  revealStartedAt: number;
}

interface InternalRoom {
  code: string;
  hostId: string;
  maxPlayers: number;
  stage: RoomStage;
  currentGame: GameId | null;
  players: Player[];
  gameState: RoomState['gameState'];
  guessExtra?: GuessInternalExtra;
  pongInput: Record<string, number>;
  raceAccelerateUntil: Record<string, number>;
  lastTickAt: number;
  tickTimer?: ReturnType<typeof setInterval>;
  cleanupTimer?: ReturnType<typeof setTimeout>;
  usedPromptIndices: number[];
}

const rooms = new Map<string, InternalRoom>();
const clientMeta = new Map<WebSocket, { playerId?: string; roomCode?: string; subscribedLobby?: boolean }>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 5; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function getPublicRooms(): PublicRoomSummary[] {
  const list: PublicRoomSummary[] = [];
  for (const room of rooms.values()) {
    if (room.players.length === 0) continue;
    const host = room.players.find((p) => p.id === room.hostId) || room.players[0];
    list.push({
      code: room.code,
      hostName: host.name,
      hostAvatarId: host.avatarId,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      stage: room.stage,
      currentGame: room.currentGame,
    });
  }
  return list;
}

function broadcastLobbyList() {
  const msg: ServerMessage = { type: 'rooms:list', rooms: getPublicRooms() };
  const raw = JSON.stringify(msg);
  for (const [ws, meta] of clientMeta.entries()) {
    if (meta.subscribedLobby && ws.readyState === WebSocket.OPEN) {
      ws.send(raw);
    }
  }
}

function serializeRoom(room: InternalRoom): RoomState {
  return {
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    stage: room.stage,
    currentGame: room.currentGame,
    players: room.players,
    gameState: room.gameState,
    serverTime: Date.now(),
  };
}

function broadcastRoom(room: InternalRoom) {
  const payload = JSON.stringify({ type: 'room:state', room: serializeRoom(room) } satisfies ServerMessage);
  for (const [ws, meta] of clientMeta.entries()) {
    if (meta.roomCode === room.code && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function stopRoomTick(room: InternalRoom) {
  if (room.tickTimer) {
    clearInterval(room.tickTimer);
    room.tickTimer = undefined;
  }
}

function scheduleCleanupIfEmpty(room: InternalRoom) {
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = undefined;
  }
  const anyConnected = room.players.some((p) => p.connected);
  if (!anyConnected) {
    room.cleanupTimer = setTimeout(() => {
      const current = rooms.get(room.code);
      if (current && !current.players.some((p) => p.connected)) {
        stopRoomTick(current);
        rooms.delete(current.code);
        broadcastLobbyList();
      }
    }, 10 * 60 * 1000);
  }
}

// ==========================================
// Game Initializers & Tick Loops
// ==========================================

function pickDrawingPrompt(room: InternalRoom): string {
  if (room.usedPromptIndices.length >= DRAWING_PROMPTS.length) {
    room.usedPromptIndices = [];
  }
  const available = DRAWING_PROMPTS.map((_, idx) => idx).filter(
    (idx) => !room.usedPromptIndices.includes(idx)
  );
  const chosenIdx = available[Math.floor(Math.random() * available.length)] ?? 0;
  room.usedPromptIndices.push(chosenIdx);
  return DRAWING_PROMPTS[chosenIdx];
}

function initDrawingGame(room: InternalRoom, round = 1) {
  stopRoomTick(room);
  const state: DrawingState = {
    kind: 'drawing',
    round,
    phase: 'drawing',
    prompt: pickDrawingPrompt(room),
    endsAt: Date.now() + 45_000,
    submissions: {},
    voters: {},
    winnerIds: [],
  };
  room.gameState = state;
  room.tickTimer = setInterval(() => tickDrawing(room), 1000);
}

function finalizeDrawingVoting(room: InternalRoom, state: DrawingState) {
  const counts: Record<string, number> = {};
  for (const sub of Object.values(state.submissions)) {
    counts[sub.playerId] = 0;
  }
  for (const targetId of Object.values(state.voters)) {
    if (counts[targetId] !== undefined) {
      counts[targetId] += 1;
    }
  }
  let maxVotes = 0;
  for (const sub of Object.values(state.submissions)) {
    sub.votes = counts[sub.playerId] || 0;
    if (sub.votes > maxVotes) maxVotes = sub.votes;
  }
  const winners: string[] = [];
  if (maxVotes > 0) {
    for (const sub of Object.values(state.submissions)) {
      if (sub.votes === maxVotes) winners.push(sub.playerId);
    }
  } else {
    for (const sub of Object.values(state.submissions)) {
      winners.push(sub.playerId);
    }
  }
  state.winnerIds = winners;

  // Award points
  for (const player of room.players) {
    const sub = state.submissions[player.id];
    if (sub) {
      player.score += sub.votes * 80 + (winners.includes(player.id) ? 60 : 20);
    }
  }
  state.phase = 'results';
  state.endsAt = Date.now() + 15_000;
  broadcastRoom(room);
}

function tickDrawing(room: InternalRoom) {
  if (!room.gameState || room.gameState.kind !== 'drawing') return;
  const state = room.gameState;
  const now = Date.now();
  if (state.phase === 'drawing' && now >= state.endsAt) {
    const submissionCount = Object.keys(state.submissions).length;
    if (submissionCount === 0) {
      state.phase = 'results';
      state.winnerIds = [];
      state.endsAt = now + 10_000;
    } else {
      state.phase = 'voting';
      state.endsAt = now + 25_000;
    }
    broadcastRoom(room);
  } else if (state.phase === 'voting' && now >= state.endsAt) {
    finalizeDrawingVoting(room, state);
  }
}

// ==========================================
// Game 2: Pong (مضارب تنك)
// ==========================================

function initPongGame(room: InternalRoom) {
  stopRoomTick(room);
  room.pongInput = {};
  const paddles: PongState['paddles'] = {};
  const activePlayers = room.players;
  const hasBot = activePlayers.length === 1;

  activePlayers.forEach((p, idx) => {
    const team: 'left' | 'right' = hasBot ? 'left' : idx % 2 === 0 ? 'left' : 'right';
    const teamIndex = Math.floor(idx / 2);
    const startY = team === 'left' && hasBot ? 300 : 180 + teamIndex * 120;
    paddles[p.id] = {
      playerId: p.id,
      name: p.name,
      team,
      y: Math.max(70, Math.min(530, startY)),
      color: p.color,
      hits: 0,
    };
  });

  const dirX = Math.random() > 0.5 ? 1 : -1;
  const state: PongState = {
    kind: 'pong',
    phase: 'countdown',
    countdown: 3,
    ball: { x: 500, y: 300, vx: dirX * 7.2, vy: (Math.random() * 4 - 2) || 2.5 },
    paddles,
    hasBot,
    botY: 300,
    scores: { left: 0, right: 0 },
    targetScore: 7,
    winnerTeam: null,
    bumpers: [
      { x: 500, y: 170, r: 22 },
      { x: 500, y: 430, r: 22 },
    ],
  };

  room.gameState = state;
  room.lastTickAt = Date.now();
  let countdownAcc = 0;

  room.tickTimer = setInterval(() => {
    if (!room.gameState || room.gameState.kind !== 'pong') return;
    const s = room.gameState;
    const now = Date.now();
    const dt = Math.min(50, now - room.lastTickAt);
    room.lastTickAt = now;

    if (s.phase === 'countdown') {
      countdownAcc += dt;
      if (countdownAcc >= 1000) {
        countdownAcc -= 1000;
        s.countdown -= 1;
        if (s.countdown <= 0) {
          s.phase = 'playing';
        }
        broadcastRoom(room);
      }
      return;
    }

    if (s.phase === 'gameover') return;

    const factor = dt / 16.67;

    // Move paddles smoothly toward target y
    for (const pid of Object.keys(s.paddles)) {
      const targetY = room.pongInput[pid];
      if (typeof targetY === 'number') {
        const clamped = Math.max(60, Math.min(540, targetY));
        s.paddles[pid].y += (clamped - s.paddles[pid].y) * 0.45;
      }
    }

    // Move Bot if solo
    if (s.hasBot) {
      const botTarget = Math.max(60, Math.min(540, s.ball.y));
      const diff = botTarget - s.botY;
      s.botY += Math.sign(diff) * Math.min(Math.abs(diff), 5.6 * factor);
    }

    // Move ball
    s.ball.x += s.ball.vx * factor;
    s.ball.y += s.ball.vy * factor;

    // Top & Bottom wall bounce
    if (s.ball.y <= 16) {
      s.ball.y = 16;
      s.ball.vy = Math.abs(s.ball.vy);
    } else if (s.ball.y >= 584) {
      s.ball.y = 584;
      s.ball.vy = -Math.abs(s.ball.vy);
    }

    // Bumper collisions
    for (const b of s.bumpers) {
      const dx = s.ball.x - b.x;
      const dy = s.ball.y - b.y;
      const dist = Math.hypot(dx, dy);
      const minDist = b.r + 12;
      if (dist > 0 && dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        s.ball.x = b.x + nx * minDist;
        s.ball.y = b.y + ny * minDist;
        const dot = s.ball.vx * nx + s.ball.vy * ny;
        s.ball.vx = s.ball.vx - 2 * dot * nx;
        s.ball.vy = s.ball.vy - 2 * dot * ny;
      }
    }

    // Left paddles collision (x around 44..62)
    if (s.ball.vx < 0 && s.ball.x <= 66 && s.ball.x >= 32) {
      for (const pad of Object.values(s.paddles)) {
        if (pad.team === 'left' && Math.abs(s.ball.y - pad.y) <= 58) {
          s.ball.x = 67;
          const rel = (s.ball.y - pad.y) / 58;
          const speed = Math.min(13.5, Math.hypot(s.ball.vx, s.ball.vy) * 1.05 + 0.25);
          const angle = rel * 0.95;
          s.ball.vx = Math.abs(Math.cos(angle) * speed);
          s.ball.vy = Math.sin(angle) * speed;
          pad.hits += 1;
          const pl = room.players.find((p) => p.id === pad.playerId);
          if (pl) pl.score += 10;
          break;
        }
      }
    }

    // Right paddles (or Bot) collision (x around 934..968)
    if (s.ball.vx > 0 && s.ball.x >= 934 && s.ball.x <= 968) {
      let hit = false;
      for (const pad of Object.values(s.paddles)) {
        if (pad.team === 'right' && Math.abs(s.ball.y - pad.y) <= 58) {
          s.ball.x = 933;
          const rel = (s.ball.y - pad.y) / 58;
          const speed = Math.min(13.5, Math.hypot(s.ball.vx, s.ball.vy) * 1.05 + 0.25);
          const angle = rel * 0.95;
          s.ball.vx = -Math.abs(Math.cos(angle) * speed);
          s.ball.vy = Math.sin(angle) * speed;
          pad.hits += 1;
          const pl = room.players.find((p) => p.id === pad.playerId);
          if (pl) pl.score += 10;
          hit = true;
          break;
        }
      }
      if (!hit && s.hasBot && Math.abs(s.ball.y - s.botY) <= 58) {
        s.ball.x = 933;
        const rel = (s.ball.y - s.botY) / 58;
        const speed = Math.min(13, Math.hypot(s.ball.vx, s.ball.vy) * 1.04 + 0.2);
        const angle = rel * 0.9;
        s.ball.vx = -Math.abs(Math.cos(angle) * speed);
        s.ball.vy = Math.sin(angle) * speed;
      }
    }

    // Goals
    if (s.ball.x < 10) {
      s.scores.right += 1;
      resetPongBall(s, 1);
    } else if (s.ball.x > 990) {
      s.scores.left += 1;
      resetPongBall(s, -1);
    }

    if (s.scores.left >= s.targetScore || s.scores.right >= s.targetScore) {
      s.phase = 'gameover';
      s.winnerTeam = s.scores.left >= s.targetScore ? 'left' : 'right';
      for (const pad of Object.values(s.paddles)) {
        if (pad.team === s.winnerTeam) {
          const pl = room.players.find((p) => p.id === pad.playerId);
          if (pl) pl.score += 150;
        }
      }
    }

    broadcastRoom(room);
  }, 33);
}

function resetPongBall(s: PongState, direction: 1 | -1) {
  s.ball = {
    x: 500,
    y: 300,
    vx: direction * 7.2,
    vy: (Math.random() * 5 - 2.5) || 2.2,
  };
}

// ==========================================
// Game 3: Guess the Person (خمن الشخص)
// ==========================================

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function loadGuessRound(room: InternalRoom, round: number) {
  const extra = room.guessExtra!;
  const cardIdx = extra.deckIndices[round - 1] ?? 0;
  const card = GUESS_CHARACTERS[cardIdx];
  extra.currentAnswer = card.answer;
  extra.lastClueStepAt = Date.now();
  extra.revealStartedAt = 0;

  const state: GuessState = {
    kind: 'guess',
    round,
    totalRounds: extra.deckIndices.length,
    phase: 'clues',
    cluesRevealed: 1,
    clues: [...card.clues],
    options: shuffleArray(card.options),
    correctOption: null,
    category: card.category,
    endsAt: Date.now() + 24_000,
    roundAnswered: {},
    firstCorrectPlayerId: null,
  };
  room.gameState = state;
}

function initGuessGame(room: InternalRoom) {
  stopRoomTick(room);
  const allIndices = shuffleArray(GUESS_CHARACTERS.map((_, i) => i));
  room.guessExtra = {
    deckIndices: allIndices.slice(0, 5),
    currentAnswer: '',
    lastClueStepAt: Date.now(),
    revealStartedAt: 0,
  };
  loadGuessRound(room, 1);

  room.tickTimer = setInterval(() => {
    if (!room.gameState || room.gameState.kind !== 'guess' || !room.guessExtra) return;
    const s = room.gameState;
    const extra = room.guessExtra;
    const now = Date.now();

    if (s.phase === 'clues') {
      if (s.cluesRevealed < 4 && now - extra.lastClueStepAt >= 6000) {
        s.cluesRevealed += 1;
        extra.lastClueStepAt = now;
        broadcastRoom(room);
      } else if (now >= s.endsAt) {
        s.phase = 'reveal';
        s.correctOption = extra.currentAnswer;
        s.endsAt = now + 4500;
        extra.revealStartedAt = now;
        broadcastRoom(room);
      }
    } else if (s.phase === 'reveal' && now >= s.endsAt) {
      if (s.round >= s.totalRounds) {
        s.phase = 'gameover';
      } else {
        loadGuessRound(room, s.round + 1);
      }
      broadcastRoom(room);
    }
  }, 500);
}

// ==========================================
// Game 4: Car Race (سباق السيارات)
// ==========================================

function generateRaceObstacles(trackLength: number): RaceObstacle[] {
  const obstacles: RaceObstacle[] = [];
  let id = 1;
  for (let d = 260; d < trackLength - 180; d += 95) {
    const lane = Math.floor(Math.random() * 3);
    const roll = Math.random();
    const type: RaceObstacle['type'] = roll < 0.34 ? 'boost' : roll < 0.72 ? 'cone' : 'oil';
    obstacles.push({ id: id++, distance: d, lane, type });
    if (Math.random() < 0.35) {
      const otherLane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
      obstacles.push({
        id: id++,
        distance: d + 20,
        lane: otherLane,
        type: Math.random() < 0.4 ? 'boost' : 'cone',
      });
    }
  }
  return obstacles;
}

function initRaceGame(room: InternalRoom) {
  stopRoomTick(room);
  room.raceAccelerateUntil = {};
  const trackLength = 2400;
  const cars: RaceState['cars'] = {};
  room.players.forEach((p, idx) => {
    cars[p.id] = {
      playerId: p.id,
      name: p.name,
      color: p.color,
      avatarId: p.avatarId,
      distance: 0,
      lane: idx % 3,
      speed: 0,
      stunUntil: 0,
      boostUntil: 0,
      finishedRank: null,
    };
  });

  const state: RaceState = {
    kind: 'race',
    phase: 'countdown',
    countdown: 3,
    trackLength,
    obstacles: generateRaceObstacles(trackLength),
    cars,
    finishOrder: [],
  };
  room.gameState = state;
  room.lastTickAt = Date.now();
  let countdownAcc = 0;
  const hitHistory = new Map<string, Set<number>>();
  let firstFinishAt = 0;

  room.tickTimer = setInterval(() => {
    if (!room.gameState || room.gameState.kind !== 'race') return;
    const s = room.gameState;
    const now = Date.now();
    const dt = Math.min(60, now - room.lastTickAt);
    room.lastTickAt = now;

    if (s.phase === 'countdown') {
      countdownAcc += dt;
      if (countdownAcc >= 1000) {
        countdownAcc -= 1000;
        s.countdown -= 1;
        if (s.countdown <= 0) {
          s.phase = 'racing';
        }
        broadcastRoom(room);
      }
      return;
    }

    if (s.phase === 'gameover') return;

    const sec = dt / 1000;

    for (const car of Object.values(s.cars)) {
      if (car.finishedRank !== null) continue;

      let targetSpeed = 125;
      if ((room.raceAccelerateUntil[car.playerId] || 0) > now) {
        targetSpeed = 175;
      }
      if (car.boostUntil > now) {
        targetSpeed = 245;
      }
      if (car.stunUntil > now) {
        targetSpeed = 52;
      }

      car.speed += (targetSpeed - car.speed) * 0.25;
      const prevDist = car.distance;
      car.distance += car.speed * sec;

      if (!hitHistory.has(car.playerId)) hitHistory.set(car.playerId, new Set());
      const seen = hitHistory.get(car.playerId)!;

      for (const obs of s.obstacles) {
        if (seen.has(obs.id)) continue;
        if (obs.lane === car.lane && obs.distance >= prevDist && obs.distance <= car.distance + 18) {
          seen.add(obs.id);
          if (obs.type === 'boost') {
            car.boostUntil = now + 1500;
          } else {
            car.stunUntil = now + 950;
          }
        }
      }

      if (car.distance >= s.trackLength) {
        car.distance = s.trackLength;
        s.finishOrder.push(car.playerId);
        car.finishedRank = s.finishOrder.length;
        if (firstFinishAt === 0) firstFinishAt = now;
        const pointsByRank = [200, 140, 100, 70, 50, 40];
        const pts = pointsByRank[car.finishedRank - 1] || 40;
        const pl = room.players.find((p) => p.id === car.playerId);
        if (pl) pl.score += pts;
      }
    }

    const connectedIds = room.players.filter((p) => p.connected).map((p) => p.id);
    const allFinished =
      connectedIds.length > 0 && connectedIds.every((id) => s.cars[id]?.finishedRank !== null);
    if (allFinished || (firstFinishAt > 0 && now - firstFinishAt >= 7000)) {
      s.phase = 'gameover';
    }

    broadcastRoom(room);
  }, 40);
}

// ==========================================
// Game 5: Farm (الزراعة السعيدة)
// ==========================================

function createEmptyFarm(playerId: string) {
  return {
    playerId,
    coins: 50,
    harvestedCount: 0,
    plots: Array.from({ length: 6 }, (_, id) => ({
      id,
      cropId: null,
      plantedAt: 0,
      growMs: 0,
      watered: false,
    })),
  };
}

function initFarmGame(room: InternalRoom) {
  stopRoomTick(room);
  const farms: FarmState['farms'] = {};
  for (const p of room.players) {
    farms[p.id] = createEmptyFarm(p.id);
  }
  const state: FarmState = {
    kind: 'farm',
    phase: 'playing',
    endsAt: Date.now() + 90_000,
    farms,
    winnerIds: [],
  };
  room.gameState = state;
  room.tickTimer = setInterval(() => {
    if (!room.gameState || room.gameState.kind !== 'farm') return;
    const s = room.gameState;
    if (s.phase === 'playing' && Date.now() >= s.endsAt) {
      s.phase = 'gameover';
      let maxCoins = -1;
      for (const f of Object.values(s.farms)) {
        if (f.coins > maxCoins) maxCoins = f.coins;
      }
      s.winnerIds = Object.values(s.farms)
        .filter((f) => f.coins === maxCoins)
        .map((f) => f.playerId);
      for (const wid of s.winnerIds) {
        const pl = room.players.find((p) => p.id === wid);
        if (pl) pl.score += 150;
      }
      broadcastRoom(room);
    }
  }, 1000);
}

function startSelectedGame(room: InternalRoom, gameId: GameId) {
  room.currentGame = gameId;
  room.stage = 'playing';
  if (gameId === 'drawing') initDrawingGame(room, 1);
  else if (gameId === 'pong') initPongGame(room);
  else if (gameId === 'guess') initGuessGame(room);
  else if (gameId === 'race') initRaceGame(room);
  else if (gameId === 'farm') initFarmGame(room);
  broadcastRoom(room);
  broadcastLobbyList();
}

function ensureLateJoinerInActiveGame(room: InternalRoom, player: Player) {
  const gs = room.gameState;
  if (!gs) return;
  if (gs.kind === 'farm' && !gs.farms[player.id]) {
    gs.farms[player.id] = createEmptyFarm(player.id);
  } else if (gs.kind === 'race' && !gs.cars[player.id]) {
    gs.cars[player.id] = {
      playerId: player.id,
      name: player.name,
      color: player.color,
      avatarId: player.avatarId,
      distance: 0,
      lane: Object.keys(gs.cars).length % 3,
      speed: 0,
      stunUntil: 0,
      boostUntil: 0,
      finishedRank: null,
    };
  } else if (gs.kind === 'pong' && !gs.paddles[player.id]) {
    const leftCount = Object.values(gs.paddles).filter((p) => p.team === 'left').length;
    const rightCount = Object.values(gs.paddles).filter((p) => p.team === 'right').length;
    const team: 'left' | 'right' = gs.hasBot ? 'right' : leftCount <= rightCount ? 'left' : 'right';
    gs.hasBot = false;
    gs.paddles[player.id] = {
      playerId: player.id,
      name: player.name,
      team,
      y: 300,
      color: player.color,
      hits: 0,
    };
  }
}

// ==========================================
// Server Bootstrap (Express + WS + Vite)
// ==========================================

async function bootstrap() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  app.get('/api/rooms', (_req, res) => {
    res.json({ rooms: getPublicRooms() });
  });

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    clientMeta.set(ws, {});

    ws.on('message', (rawData) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(rawData.toString()) as ClientMessage;
      } catch {
        return;
      }

      const meta = clientMeta.get(ws) || {};
      clientMeta.set(ws, meta);

      switch (msg.type) {
        case 'rooms:subscribe': {
          meta.subscribedLobby = true;
          send(ws, { type: 'rooms:list', rooms: getPublicRooms() });
          break;
        }

        case 'room:create': {
          const cleanName = (msg.name || '').trim().slice(0, 20);
          if (!cleanName) {
            send(ws, { type: 'room:error', message: 'يرجى كتابة اسمك أولاً' });
            return;
          }
          const code = generateRoomCode();
          const player: Player = {
            id: msg.playerId,
            name: cleanName,
            avatarId: msg.avatarId ?? 0,
            color: PLAYER_COLORS[0],
            score: 0,
            isHost: true,
            connected: true,
          };
          const room: InternalRoom = {
            code,
            hostId: player.id,
            maxPlayers: MAX_PLAYERS,
            stage: 'lobby',
            currentGame: null,
            players: [player],
            gameState: null,
            pongInput: {},
            raceAccelerateUntil: {},
            lastTickAt: Date.now(),
            usedPromptIndices: [],
          };
          rooms.set(code, room);
          meta.playerId = player.id;
          meta.roomCode = code;
          broadcastRoom(room);
          broadcastLobbyList();
          break;
        }

        case 'room:join': {
          const code = (msg.roomCode || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            send(ws, { type: 'room:error', message: 'الغرفة غير موجودة أو انتهت', code: 'NOT_FOUND' });
            return;
          }
          if (room.cleanupTimer) {
            clearTimeout(room.cleanupTimer);
            room.cleanupTimer = undefined;
          }

          const existing = room.players.find((p) => p.id === msg.playerId);
          if (existing) {
            existing.connected = true;
            if (msg.name.trim()) existing.name = msg.name.trim().slice(0, 20);
            if (typeof msg.avatarId === 'number') existing.avatarId = msg.avatarId;
            meta.playerId = existing.id;
            meta.roomCode = room.code;
            ensureLateJoinerInActiveGame(room, existing);
            broadcastRoom(room);
            broadcastLobbyList();
            return;
          }

          if (room.players.length >= room.maxPlayers) {
            send(ws, { type: 'room:error', message: 'الغرفة ممتلئة (6/6 لاعبين)', code: 'ROOM_FULL' });
            return;
          }

          const cleanName = (msg.name || '').trim().slice(0, 20);
          if (!cleanName) {
            send(ws, { type: 'room:error', message: 'يرجى كتابة اسمك قبل الدخول' });
            return;
          }

          const usedColors = new Set(room.players.map((p) => p.color));
          const freeColor = PLAYER_COLORS.find((c) => !usedColors.has(c)) || PLAYER_COLORS[room.players.length % PLAYER_COLORS.length];

          const player: Player = {
            id: msg.playerId,
            name: cleanName,
            avatarId: msg.avatarId ?? (room.players.length % 12),
            color: freeColor,
            score: 0,
            isHost: false,
            connected: true,
          };
          room.players.push(player);
          meta.playerId = player.id;
          meta.roomCode = room.code;
          ensureLateJoinerInActiveGame(room, player);
          broadcastRoom(room);
          broadcastLobbyList();
          break;
        }

        case 'room:rejoin': {
          const code = (msg.roomCode || '').trim().toUpperCase();
          const room = rooms.get(code);
          if (!room) {
            send(ws, { type: 'room:error', message: 'الغرفة غير موجودة', code: 'NOT_FOUND' });
            return;
          }
          const existing = room.players.find((p) => p.id === msg.playerId);
          if (!existing) {
            send(ws, { type: 'room:error', message: 'انتهت جلستك السابقة في هذه الغرفة', code: 'NOT_MEMBER' });
            return;
          }
          if (room.cleanupTimer) {
            clearTimeout(room.cleanupTimer);
            room.cleanupTimer = undefined;
          }
          existing.connected = true;
          meta.playerId = existing.id;
          meta.roomCode = room.code;
          ensureLateJoinerInActiveGame(room, existing);
          broadcastRoom(room);
          broadcastLobbyList();
          break;
        }

        case 'room:leave': {
          const room = rooms.get(msg.roomCode);
          if (!room) {
            send(ws, { type: 'room:left' });
            return;
          }
          room.players = room.players.filter((p) => p.id !== msg.playerId);
          meta.roomCode = undefined;
          send(ws, { type: 'room:left' });
          if (room.players.length === 0) {
            stopRoomTick(room);
            rooms.delete(room.code);
          } else {
            if (room.hostId === msg.playerId) {
              const nextHost = room.players.find((p) => p.connected) || room.players[0];
              nextHost.isHost = true;
              room.hostId = nextHost.id;
            }
            broadcastRoom(room);
          }
          broadcastLobbyList();
          break;
        }

        case 'room:open_game_select': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.hostId !== msg.playerId) return;
          stopRoomTick(room);
          room.stage = 'game_select';
          room.currentGame = null;
          room.gameState = null;
          broadcastRoom(room);
          broadcastLobbyList();
          break;
        }

        case 'room:back_to_lobby': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.hostId !== msg.playerId) return;
          stopRoomTick(room);
          room.stage = 'lobby';
          room.currentGame = null;
          room.gameState = null;
          broadcastRoom(room);
          broadcastLobbyList();
          break;
        }

        case 'room:select_game': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.hostId !== msg.playerId) return;
          startSelectedGame(room, msg.gameId);
          break;
        }

        // ---- Game 1: Drawing ----
        case 'drawing:submit': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.gameState?.kind !== 'drawing') return;
          const state = room.gameState;
          if (state.phase !== 'drawing') return;
          if (typeof msg.imageData !== 'string' || msg.imageData.length > 220_000) return;

          state.submissions[msg.playerId] = {
            playerId: msg.playerId,
            imageData: msg.imageData,
            votes: 0,
          };

          const connectedIds = room.players.filter((p) => p.connected).map((p) => p.id);
          if (connectedIds.length > 0 && connectedIds.every((id) => Boolean(state.submissions[id]))) {
            state.phase = 'voting';
            state.endsAt = Date.now() + 25_000;
          }
          broadcastRoom(room);
          break;
        }

        case 'drawing:vote': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.gameState?.kind !== 'drawing') return;
          const state = room.gameState;
          if (state.phase !== 'voting') return;
          const subCount = Object.keys(state.submissions).length;
          if (subCount > 1 && msg.targetPlayerId === msg.playerId) return;
          if (!state.submissions[msg.targetPlayerId]) return;

          state.voters[msg.playerId] = msg.targetPlayerId;
          const connectedIds = room.players.filter((p) => p.connected).map((p) => p.id);
          if (connectedIds.length > 0 && connectedIds.every((id) => Boolean(state.voters[id]))) {
            finalizeDrawingVoting(room, state);
          } else {
            broadcastRoom(room);
          }
          break;
        }

        case 'drawing:next_round': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.hostId !== msg.playerId || room.gameState?.kind !== 'drawing') return;
          initDrawingGame(room, room.gameState.round + 1);
          broadcastRoom(room);
          break;
        }

        // ---- Game 2: Pong ----
        case 'pong:move': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.gameState?.kind !== 'pong') return;
          room.pongInput[msg.playerId] = msg.y;
          break;
        }

        case 'pong:restart': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.hostId !== msg.playerId) return;
          initPongGame(room);
          broadcastRoom(room);
          break;
        }

        // ---- Game 3: Guess ----
        case 'guess:answer': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.gameState?.kind !== 'guess' || !room.guessExtra) return;
          const s = room.gameState;
          if (s.phase !== 'clues') return;
          if (s.roundAnswered[msg.playerId]) return;

          const isCorrect = msg.option === room.guessExtra.currentAnswer;
          let pts = 0;
          let order = 0;
          if (isCorrect) {
            const baseByClue = [150, 120, 90, 60][s.cluesRevealed - 1] ?? 60;
            const isFirst = s.firstCorrectPlayerId === null;
            if (isFirst) s.firstCorrectPlayerId = msg.playerId;
            order = Object.values(s.roundAnswered).filter((a) => a.correct).length + 1;
            pts = baseByClue + (isFirst ? 40 : 0);
            const pl = room.players.find((p) => p.id === msg.playerId);
            if (pl) pl.score += pts;
          }
          s.roundAnswered[msg.playerId] = { correct: isCorrect, points: pts, order };

          const connectedIds = room.players.filter((p) => p.connected).map((p) => p.id);
          if (connectedIds.length > 0 && connectedIds.every((id) => Boolean(s.roundAnswered[id]))) {
            s.phase = 'reveal';
            s.correctOption = room.guessExtra.currentAnswer;
            s.endsAt = Date.now() + 4000;
          }
          broadcastRoom(room);
          break;
        }

        case 'guess:restart': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.hostId !== msg.playerId) return;
          initGuessGame(room);
          broadcastRoom(room);
          break;
        }

        // ---- Game 4: Race ----
        case 'race:input': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.gameState?.kind !== 'race') return;
          const car = room.gameState.cars[msg.playerId];
          if (!car || room.gameState.phase !== 'racing') return;
          if (typeof msg.lane === 'number') {
            car.lane = Math.max(0, Math.min(2, msg.lane));
          }
          if (msg.accelerate) {
            room.raceAccelerateUntil[msg.playerId] = Date.now() + 650;
          }
          break;
        }

        case 'race:restart': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.hostId !== msg.playerId) return;
          initRaceGame(room);
          broadcastRoom(room);
          break;
        }

        // ---- Game 5: Farm ----
        case 'farm:plant': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.gameState?.kind !== 'farm') return;
          if (room.gameState.phase !== 'playing') return;
          const farm = room.gameState.farms[msg.playerId];
          const crop = FARM_CROPS.find((c) => c.id === msg.cropId);
          if (!farm || !crop) return;
          const plot = farm.plots[msg.plotId];
          if (!plot || plot.cropId !== null || farm.coins < crop.cost) return;

          farm.coins -= crop.cost;
          plot.cropId = crop.id;
          plot.plantedAt = Date.now();
          plot.growMs = crop.growMs;
          plot.watered = false;
          broadcastRoom(room);
          break;
        }

        case 'farm:water': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.gameState?.kind !== 'farm') return;
          if (room.gameState.phase !== 'playing') return;
          const farm = room.gameState.farms[msg.playerId];
          if (!farm) return;
          const plot = farm.plots[msg.plotId];
          if (!plot || !plot.cropId || plot.watered) return;
          plot.watered = true;
          plot.growMs = Math.max(1500, Math.round(plot.growMs * 0.6));
          broadcastRoom(room);
          break;
        }

        case 'farm:harvest': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.gameState?.kind !== 'farm') return;
          if (room.gameState.phase !== 'playing') return;
          const farm = room.gameState.farms[msg.playerId];
          if (!farm) return;
          const plot = farm.plots[msg.plotId];
          if (!plot || !plot.cropId) return;
          if (Date.now() - plot.plantedAt < plot.growMs) return;

          const crop = FARM_CROPS.find((c) => c.id === plot.cropId);
          if (!crop) return;
          farm.coins += crop.sellPrice;
          farm.harvestedCount += 1;
          plot.cropId = null;
          plot.plantedAt = 0;
          plot.growMs = 0;
          plot.watered = false;

          const pl = room.players.find((p) => p.id === msg.playerId);
          if (pl) pl.score += crop.sellPrice;
          broadcastRoom(room);
          break;
        }

        case 'farm:restart': {
          const room = rooms.get(msg.roomCode);
          if (!room || room.hostId !== msg.playerId) return;
          initFarmGame(room);
          broadcastRoom(room);
          break;
        }
      }
    });

    ws.on('close', () => {
      const meta = clientMeta.get(ws);
      clientMeta.delete(ws);
      if (meta?.roomCode && meta?.playerId) {
        const room = rooms.get(meta.roomCode);
        if (room) {
          // Check if player still has another open socket
          let stillConnected = false;
          for (const otherMeta of clientMeta.values()) {
            if (otherMeta.roomCode === meta.roomCode && otherMeta.playerId === meta.playerId) {
              stillConnected = true;
              break;
            }
          }
          if (!stillConnected) {
            const p = room.players.find((pl) => pl.id === meta.playerId);
            if (p) {
              p.connected = false;
              broadcastRoom(room);
              scheduleCleanupIfEmpty(room);
            }
          }
        }
      }
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap();
