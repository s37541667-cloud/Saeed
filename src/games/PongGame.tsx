import { useCallback, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ChevronDown, ChevronUp, RotateCcw, Trophy } from 'lucide-react';
import type { ClientMessage, PongState } from '../types';
import { soundFX } from '../utils/sound';

interface PongGameProps {
  roomCode: string;
  playerId: string;
  isHost: boolean;
  state: PongState;
  sendMessage: (msg: ClientMessage) => void;
}

export function PongGame({
  roomCode,
  playerId,
  isHost,
  state,
  sendMessage,
}: PongGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const myPaddle = state.paddles[playerId];
  const localYRef = useRef<number>(myPaddle?.y ?? 300);
  const lastEmitRef = useRef<number>(0);
  const prevScoresRef = useRef(state.scores);
  const celebratedRef = useRef(false);

  const emitY = useCallback(
    (newY: number) => {
      const clamped = Math.max(60, Math.min(540, newY));
      localYRef.current = clamped;
      const now = Date.now();
      if (now - lastEmitRef.current >= 28) {
        lastEmitRef.current = now;
        sendMessage({ type: 'pong:move', roomCode, playerId, y: clamped });
      }
    },
    [playerId, roomCode, sendMessage]
  );

  // Sync initial paddle height
  useEffect(() => {
    if (state.phase === 'countdown') {
      celebratedRef.current = false;
      localYRef.current = myPaddle?.y ?? 300;
    }
  }, [state.phase, myPaddle?.y]);

  // Audio feedback on score & gameover
  useEffect(() => {
    if (
      state.scores.left !== prevScoresRef.current.left ||
      state.scores.right !== prevScoresRef.current.right
    ) {
      soundFX.playScore();
      prevScoresRef.current = state.scores;
    }
    if (state.phase === 'gameover' && !celebratedRef.current) {
      celebratedRef.current = true;
      const myTeam = myPaddle?.team;
      if (myTeam && myTeam === state.winnerTeam) {
        soundFX.playWin();
        confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } });
      } else {
        soundFX.playLose();
      }
    }
  }, [state.scores, state.phase, state.winnerTeam, myPaddle?.team]);

  // Keyboard support
  useEffect(() => {
    const keys = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'w', 's', 'W', 'S'].includes(e.key)) {
        e.preventDefault();
        keys.add(e.key);
      }
    };
    const onUp = (e: KeyboardEvent) => keys.delete(e.key);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);

    const timer = setInterval(() => {
      if (state.phase !== 'playing') return;
      let delta = 0;
      if (keys.has('ArrowUp') || keys.has('w') || keys.has('W')) delta -= 14;
      if (keys.has('ArrowDown') || keys.has('s') || keys.has('S')) delta += 14;
      if (delta !== 0) {
        emitY(localYRef.current + delta);
      }
    }, 28);

    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      clearInterval(timer);
    };
  }, [emitY, state.phase]);

  // Render arena canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Court background
    ctx.fillStyle = '#0F766E';
    ctx.fillRect(0, 0, 1000, 600);

    // Subtle wooden/arena rim
    ctx.strokeStyle = '#14B8A6';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 992, 592);

    // Center dashed line & circle
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    ctx.moveTo(500, 16);
    ctx.lineTo(500, 584);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(500, 300, 68, 0, Math.PI * 2);
    ctx.stroke();

    // Bumpers
    for (const b of state.bumpers) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#FEF3C7';
      ctx.stroke();
    }

    // Draw player paddles
    for (const pad of Object.values(state.paddles)) {
      const x = pad.team === 'left' ? 40 : 944;
      const isMe = pad.playerId === playerId;
      ctx.fillStyle = pad.color || (pad.team === 'left' ? '#FB7185' : '#38BDF8');
      ctx.beginPath();
      ctx.roundRect(x, pad.y - 52, 16, 104, 8);
      ctx.fill();

      ctx.lineWidth = isMe ? 3 : 2;
      ctx.strokeStyle = isMe ? '#FEF08A' : '#FFFFFF';
      ctx.stroke();

      // Player label
      ctx.font = 'bold 14px Cairo, sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = pad.team === 'left' ? 'left' : 'right';
      ctx.fillText(pad.name, pad.team === 'left' ? x + 22 : x - 6, pad.y + 5);
    }

    // Draw Bot paddle if solo
    if (state.hasBot) {
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.roundRect(944, state.botY - 52, 16, 104, 8);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
      ctx.font = 'bold 14px Cairo, sans-serif';
      ctx.fillStyle = '#E0F2FE';
      ctx.textAlign = 'right';
      ctx.fillText('الخصم الآلي', 936, state.botY + 5);
    }

    // Draw glowing ball
    ctx.beginPath();
    ctx.arc(state.ball.x, state.ball.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#FDBA74';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
  }, [state, playerId]);

  const handleCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (state.phase !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const y = ((e.clientY - rect.top) / rect.height) * 600;
    emitY(y);
  };

  const holdStep = (dir: -1 | 1) => {
    if (state.phase !== 'playing') return;
    emitY(localYRef.current + dir * 36);
  };

  return (
    <div className="toy-card p-4 sm:p-6 space-y-4">
      {/* Scoreboard Header */}
      <div className="grid grid-cols-3 items-center bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 sm:p-4 text-center">
        <div>
          <div className="text-xs font-extrabold text-rose-600">الفريق البرتقالي (يسار)</div>
          <div className="font-mono-num text-3xl font-black text-slate-900">
            {state.scores.left}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold text-slate-500">الهدف: {state.targetScore} نقاط</div>
          <div className="text-sm font-black text-slate-800 mt-0.5">
            {myPaddle ? `فريقك: ${myPaddle.team === 'left' ? 'اليسار' : 'اليمين'}` : 'متفرج'}
          </div>
        </div>
        <div>
          <div className="text-xs font-extrabold text-sky-600">الفريق الأزرق (يمين)</div>
          <div className="font-mono-num text-3xl font-black text-slate-900">
            {state.scores.right}
          </div>
        </div>
      </div>

      {/* Arena Canvas */}
      <div className="relative rounded-3xl overflow-hidden border-4 border-slate-800 shadow-lg bg-teal-800">
        <canvas
          ref={canvasRef}
          width={1000}
          height={600}
          onPointerDown={handleCanvasPointer}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'touch') {
              handleCanvasPointer(e);
            }
          }}
          className="w-full h-auto block touch-none cursor-ns-resize"
        />

        {state.phase === 'countdown' && (
          <div className="absolute inset-0 bg-slate-900/55 flex flex-col items-center justify-center text-white">
            <span className="text-lg font-extrabold mb-1">استعد!</span>
            <span className="font-mono-num text-7xl font-black text-amber-300">
              {state.countdown}
            </span>
          </div>
        )}

        {state.phase === 'gameover' && (
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-6 text-center gap-3">
            <Trophy className="w-16 h-16 text-amber-400" />
            <h3 className="text-2xl sm:text-3xl font-black">
              فاز {state.winnerTeam === 'left' ? 'الفريق البرتقالي!' : 'الفريق الأزرق!'}
            </h3>
            <p className="text-sm text-slate-200 font-bold">
              النتيجة النهائية: {state.scores.left} - {state.scores.right}
            </p>
            {isHost && (
              <button
                type="button"
                onClick={() => {
                  soundFX.playJoin();
                  sendMessage({ type: 'pong:restart', roomCode, playerId });
                }}
                className="toy-btn bg-emerald-500 border-emerald-700 text-white font-display font-black px-6 py-3 rounded-2xl flex items-center gap-2 mt-2 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
                <span>مباراة جديدة</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mobile & Touch Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs sm:text-sm font-bold text-slate-500">
          اسحب إصبعك أو الماوس على الملعب، أو استخدم الأسهم لتحريك مضربك
        </p>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onPointerDown={() => holdStep(-1)}
            onClick={() => holdStep(-1)}
            className="toy-btn bg-sky-500 border-sky-700 text-white font-black px-5 py-3 rounded-2xl flex items-center gap-1 cursor-pointer select-none"
          >
            <ChevronUp className="w-5 h-5" />
            <span>أعلى</span>
          </button>
          <button
            type="button"
            onPointerDown={() => holdStep(1)}
            onClick={() => holdStep(1)}
            className="toy-btn bg-sky-500 border-sky-700 text-white font-black px-5 py-3 rounded-2xl flex items-center gap-1 cursor-pointer select-none"
          >
            <ChevronDown className="w-5 h-5" />
            <span>أسفل</span>
          </button>
        </div>
      </div>
    </div>
  );
}
