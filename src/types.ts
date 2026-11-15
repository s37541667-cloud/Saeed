export type GameId = 'drawing' | 'pong' | 'guess' | 'race' | 'farm';

export type RoomStage = 'lobby' | 'game_select' | 'playing';

export interface Player {
  id: string;
  name: string;
  avatarId: number;
  color: string;
  score: number;
  isHost: boolean;
  connected: boolean;
}

export interface PublicRoomSummary {
  code: string;
  hostName: string;
  hostAvatarId: number;
  playerCount: number;
  maxPlayers: number;
  stage: RoomStage;
  currentGame: GameId | null;
}

export interface DrawingSubmission {
  playerId: string;
  imageData: string;
  votes: number;
}

export interface DrawingState {
  kind: 'drawing';
  round: number;
  phase: 'drawing' | 'voting' | 'results';
  prompt: string;
  endsAt: number;
  submissions: Record<string, DrawingSubmission>;
  voters: Record<string, string>;
  winnerIds: string[];
}

export interface PongPaddle {
  playerId: string;
  name: string;
  team: 'left' | 'right';
  y: number;
  color: string;
  hits: number;
}

export interface PongState {
  kind: 'pong';
  phase: 'countdown' | 'playing' | 'gameover';
  countdown: number;
  ball: { x: number; y: number; vx: number; vy: number };
  paddles: Record<string, PongPaddle>;
  hasBot: boolean;
  botY: number;
  scores: { left: number; right: number };
  targetScore: number;
  winnerTeam: 'left' | 'right' | null;
  bumpers: Array<{ x: number; y: number; r: number }>;
}

export interface GuessAnswerRecord {
  correct: boolean;
  points: number;
  order: number;
}

export interface GuessState {
  kind: 'guess';
  round: number;
  totalRounds: number;
  phase: 'clues' | 'reveal' | 'gameover';
  cluesRevealed: number;
  clues: string[];
  options: string[];
  correctOption: string | null;
  category: string;
  endsAt: number;
  roundAnswered: Record<string, GuessAnswerRecord>;
  firstCorrectPlayerId: string | null;
}

export interface RaceObstacle {
  id: number;
  distance: number;
  lane: number;
  type: 'cone' | 'oil' | 'boost';
}

export interface RaceCar {
  playerId: string;
  name: string;
  color: string;
  avatarId: number;
  distance: number;
  lane: number;
  speed: number;
  stunUntil: number;
  boostUntil: number;
  finishedRank: number | null;
}

export interface RaceState {
  kind: 'race';
  phase: 'countdown' | 'racing' | 'gameover';
  countdown: number;
  trackLength: number;
  obstacles: RaceObstacle[];
  cars: Record<string, RaceCar>;
  finishOrder: string[];
}

export interface FarmPlot {
  id: number;
  cropId: string | null;
  plantedAt: number;
  growMs: number;
  watered: boolean;
}

export interface PlayerFarm {
  playerId: string;
  coins: number;
  harvestedCount: number;
  plots: FarmPlot[];
}

export interface FarmState {
  kind: 'farm';
  phase: 'playing' | 'gameover';
  endsAt: number;
  farms: Record<string, PlayerFarm>;
  winnerIds: string[];
}

export type GameState =
  | DrawingState
  | PongState
  | GuessState
  | RaceState
  | FarmState;

export interface RoomState {
  code: string;
  hostId: string;
  maxPlayers: number;
  stage: RoomStage;
  currentGame: GameId | null;
  players: Player[];
  gameState: GameState | null;
  serverTime: number;
}

export type ClientMessage =
  | { type: 'rooms:subscribe' }
  | { type: 'room:create'; playerId: string; name: string; avatarId: number }
  | { type: 'room:join'; roomCode: string; playerId: string; name: string; avatarId: number }
  | { type: 'room:rejoin'; roomCode: string; playerId: string }
  | { type: 'room:leave'; roomCode: string; playerId: string }
  | { type: 'room:open_game_select'; roomCode: string; playerId: string }
  | { type: 'room:back_to_lobby'; roomCode: string; playerId: string }
  | { type: 'room:select_game'; roomCode: string; playerId: string; gameId: GameId }
  | { type: 'drawing:submit'; roomCode: string; playerId: string; imageData: string }
  | { type: 'drawing:vote'; roomCode: string; playerId: string; targetPlayerId: string }
  | { type: 'drawing:next_round'; roomCode: string; playerId: string }
  | { type: 'pong:move'; roomCode: string; playerId: string; y: number }
  | { type: 'pong:restart'; roomCode: string; playerId: string }
  | { type: 'guess:answer'; roomCode: string; playerId: string; option: string }
  | { type: 'guess:restart'; roomCode: string; playerId: string }
  | { type: 'race:input'; roomCode: string; playerId: string; lane?: number; accelerate?: boolean }
  | { type: 'race:restart'; roomCode: string; playerId: string }
  | { type: 'farm:plant'; roomCode: string; playerId: string; plotId: number; cropId: string }
  | { type: 'farm:water'; roomCode: string; playerId: string; plotId: number }
  | { type: 'farm:harvest'; roomCode: string; playerId: string; plotId: number }
  | { type: 'farm:restart'; roomCode: string; playerId: string };

export type ServerMessage =
  | { type: 'rooms:list'; rooms: PublicRoomSummary[] }
  | { type: 'room:state'; room: RoomState }
  | { type: 'room:error'; message: string; code?: string }
  | { type: 'room:kicked' }
  | { type: 'room:left' };
