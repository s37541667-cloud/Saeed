import { useCallback, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { ArrowLeft, ArrowRight, Flag, RotateCcw, Trophy, Zap } from 'lucide-react';
import type { ClientMessage, RaceState } from '../types';
import { soundFX } from '../utils/sound';

interface RaceGameProps {
  roomCode: string;
  playerId: string;
  isHost: boolean;
  state: RaceState;
  sendMessage: (msg: ClientMessage) => void;
}

export function RaceGame({
  roomCode,
  playerId,
  isHost,
  state,
  sendMessage,
}: RaceGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const myCar = state.cars[playerId];
  const myLaneRef = useRef<number>(myCar?.lane ?? 1);
  const celebratedRef = useRef(false);
  const lastStunRef = useRef(0);
  const lastBoostRef = useRef(0);

  useEffect(() => {
    if (myCar) {
      myLaneRef.current = myCar.lane;
    }
  }, [myCar]);

  useEffect(() => {
    if (state.phase === 'countdown') {
      celebratedRef.current = false;
    }
    if (myCar) {
      const now = Date.now();
      if (myCar.stunUntil > now && myCar.stunUntil !== lastStunRef.current) {
        lastStunRef.current = myCar.stunUntil;
        soundFX.playWrong();
      }
      if (myCar.boostUntil > now && myCar.boostUntil !== lastBoostRef.current) {
        lastBoostRef.current = myCar.boostUntil;
        soundFX.playScore();
      }
    }
    if (state.phase === 'gameover' && !celebratedRef.current) {
      celebratedRef.current = true;
      if (state.finishOrder[0] === playerId) {
        soundFX.playWin();
        confetti({ particleCount: 100, spread: 75, origin: { y: 0.6 } });
      } else {
        soundFX.playScore();
      }
    }
  }, [state.phase, state.finishOrder, playerId, myCar]);

  const moveLane = useCallback(
    (delta: -1 | 1) => {
      if (state.phase !== 'racing') return;
      const next = Math.max(0, Math.min(2, myLaneRef.current + delta));
      if (next !== myLaneRef.current) {
        myLaneRef.current = next;
        soundFX.playClick();
        sendMessage({ type: 'race:input', roomCode, playerId, lane: next });
      }
    },
    [playerId, roomCode, sendMessage, state.phase]
  );

  const triggerGas = useCallback(() => {
    if (state.phase !== 'racing') return;
    soundFX.playHit();
    sendMessage({ type: 'race:input', roomCode, playerId, accelerate: true });
  }, [playerId, roomCode, sendMessage, state.phase]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        moveLane(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        moveLane(1);
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        triggerGas();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moveLane, triggerGas]);

  // Render vertical 3-lane track canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const roadLeft = 140;
    const roadWidth = W - 280;
    const laneW = roadWidth / 3;

    const myDist = myCar?.distance ?? 0;
    const cameraBase = myDist - 120; // car sits near bottom (y = H - 105)
    const distToY = (d: number) => H - 105 - (d - myDist) * 0.78;
    const laneToX = (lane: number) => roadLeft + laneW * lane + laneW / 2;

    // Grass background
    ctx.fillStyle = '#4ADE80';
    ctx.fillRect(0, 0, W, H);

    // Scrolling roadside trees
    ctx.fillStyle = '#16A34A';
    const treeStep = 140;
    const startTree = Math.floor(cameraBase / treeStep) * treeStep;
    for (let d = startTree; d < cameraBase + 900; d += treeStep) {
      const ty = distToY(d);
      if (ty < -40 || ty > H + 40) continue;
      ctx.beginPath();
      ctx.arc(65, ty, 24, 0, Math.PI * 2);
      ctx.arc(W - 65, ty + 45, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Road curbs
    ctx.fillStyle = '#EF4444';
    ctx.fillRect(roadLeft - 14, 0, 14, H);
    ctx.fillRect(roadLeft + roadWidth, 0, 14, H);

    // Asphalt
    ctx.fillStyle = '#334155';
    ctx.fillRect(roadLeft, 0, roadWidth, H);

    // Moving lane dashes
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 5;
    const dashOffset = (myDist * 0.78) % 60;
    ctx.setLineDash([30, 30]);
    ctx.lineDashOffset = dashOffset;
    for (let i = 1; i <= 2; i++) {
      const lx = roadLeft + laneW * i;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Finish line
    const finishY = distToY(state.trackLength);
    if (finishY > -50 && finishY < H + 50) {
      const sq = 20;
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < Math.ceil(roadWidth / sq); col++) {
          ctx.fillStyle = (row + col) % 2 === 0 ? '#FFFFFF' : '#0F172A';
          ctx.fillRect(roadLeft + col * sq, finishY + row * sq, sq, sq);
        }
      }
    }

    // Obstacles & Boosts
    for (const obs of state.obstacles) {
      const oy = distToY(obs.distance);
      if (oy < -40 || oy > H + 40) continue;
      const ox = laneToX(obs.lane);
      if (obs.type === 'boost') {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.roundRect(ox - 26, oy - 16, 52, 32, 8);
        ctx.fill();
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#0F172A';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡', ox, oy + 6);
      } else if (obs.type === 'cone') {
        ctx.beginPath();
        ctx.arc(ox, oy, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#F97316';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(ox, oy, 26, 15, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#0F172A';
        ctx.fill();
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw all cars
    const now = Date.now();
    const carsList = Object.values(state.cars);
    for (const car of carsList) {
      const cy = distToY(car.distance);
      if (cy < -80 || cy > H + 80) continue;
      const cx = laneToX(car.lane);
      const isMe = car.playerId === playerId;
      const isBoosted = car.boostUntil > now;
      const isStunned = car.stunUntil > now;

      ctx.save();
      ctx.translate(cx, cy);
      if (isStunned) {
        ctx.rotate(Math.sin(now * 0.03) * 0.2);
      }

      // Boost flame
      if (isBoosted) {
        ctx.fillStyle = '#FACC15';
        ctx.beginPath();
        ctx.moveTo(-10, 34);
        ctx.lineTo(10, 34);
        ctx.lineTo(0, 58 + Math.random() * 12);
        ctx.closePath();
        ctx.fill();
      }

      // Wheels
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-26, -24, 7, 14);
      ctx.fillRect(19, -24, 7, 14);
      ctx.fillRect(-26, 10, 7, 14);
      ctx.fillRect(19, 10, 7, 14);

      // Car body
      ctx.fillStyle = car.color;
      ctx.beginPath();
      ctx.roundRect(-22, -34, 44, 68, 12);
      ctx.fill();
      ctx.lineWidth = isMe ? 4 : 2;
      ctx.strokeStyle = isMe ? '#FEF08A' : '#FFFFFF';
      ctx.stroke();

      // Windshield
      ctx.fillStyle = '#E0F2FE';
      ctx.beginPath();
      ctx.roundRect(-15, -16, 30, 18, 6);
      ctx.fill();

      // Racing stripe
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(-4, -34, 8, 16);

      ctx.restore();

      // Name label above car
      ctx.font = 'bold 13px Cairo, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(car.name, cx, cy - 42);
    }
  }, [state, playerId, myCar]);

  const sortedCars = Object.values(state.cars).sort((a, b) => b.distance - a.distance);

  return (
    <div className="toy-card p-4 sm:p-6 space-y-4">
      {/* Live Mini-Map Progress Strip */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 space-y-2">
        <div className="flex items-center justify-between text-xs font-extrabold text-slate-600">
          <span>خط البداية</span>
          <span className="flex items-center gap-1 text-emerald-600">
            <Flag className="w-4 h-4" /> خط النهاية
          </span>
        </div>
        <div className="space-y-1.5">
          {sortedCars.map((car) => {
            const pct = Math.min(100, Math.round((car.distance / state.trackLength) * 100));
            return (
              <div key={car.playerId} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 w-20 truncate">{car.name}</span>
                <div className="flex-1 h-4 bg-slate-200 rounded-full overflow-hidden relative" dir="ltr">
                  <div
                    className="h-full rounded-full transition-all duration-100"
                    style={{ width: `${Math.max(4, pct)}%`, backgroundColor: car.color }}
                  />
                </div>
                <span className="font-mono-num text-xs font-black text-slate-600 w-10 text-left">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Highway Canvas */}
      <div className="relative rounded-3xl overflow-hidden border-4 border-slate-800 shadow-lg bg-emerald-500">
        <canvas
          ref={canvasRef}
          width={760}
          height={440}
          onClick={(e) => {
            if (state.phase !== 'racing') return;
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;
            if (relX < 0.38) moveLane(-1);
            else if (relX > 0.62) moveLane(1);
            else triggerGas();
          }}
          className="w-full h-auto block touch-manipulation cursor-pointer"
        />

        {state.phase === 'countdown' && (
          <div className="absolute inset-0 bg-slate-900/55 flex flex-col items-center justify-center text-white">
            <span className="text-lg font-extrabold mb-1">اربطوا الأحزمة!</span>
            <span className="font-mono-num text-7xl font-black text-amber-300">
              {state.countdown}
            </span>
          </div>
        )}

        {state.phase === 'gameover' && (
          <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-6 text-center gap-3">
            <Trophy className="w-16 h-16 text-amber-400" />
            <h3 className="text-2xl sm:text-3xl font-black">انتهى السباق!</h3>
            <div className="space-y-1 text-sm font-bold">
              {state.finishOrder.map((pid, idx) => {
                const c = state.cars[pid];
                return (
                  <div key={pid}>
                    #{idx + 1} · {c?.name || 'متسابق'}
                  </div>
                );
              })}
            </div>
            {isHost && (
              <button
                type="button"
                onClick={() => {
                  soundFX.playJoin();
                  sendMessage({ type: 'race:restart', roomCode, playerId });
                }}
                className="toy-btn bg-emerald-500 border-emerald-700 text-white font-display font-black px-6 py-3 rounded-2xl flex items-center gap-2 mt-2 cursor-pointer"
              >
                <RotateCcw className="w-5 h-5" />
                <span>سباق جديد</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Physical Left-Center-Right Steering Controls (LTR spatial order) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs sm:text-sm font-bold text-slate-500">
          تفادَ الأقماع وبقع الزيت والتقط ⚡ التوربو للوصول أولاً!
        </p>

        <div className="grid grid-cols-3 gap-2.5 w-full sm:w-auto" dir="ltr">
          <button
            type="button"
            onClick={() => moveLane(-1)}
            className="toy-btn bg-sky-500 border-sky-700 text-white font-black px-5 py-3.5 rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer select-none"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>يسار</span>
          </button>

          <button
            type="button"
            onClick={triggerGas}
            className="toy-btn bg-amber-400 border-amber-600 text-slate-900 font-black px-5 py-3.5 rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer select-none"
          >
            <Zap className="w-5 h-5 fill-current" />
            <span>سرعة</span>
          </button>

          <button
            type="button"
            onClick={() => moveLane(1)}
            className="toy-btn bg-sky-500 border-sky-700 text-white font-black px-5 py-3.5 rounded-2xl flex items-center justify-center gap-1.5 cursor-pointer select-none"
          >
            <span>يمين</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
