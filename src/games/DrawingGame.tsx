import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Eraser, Paintbrush, RotateCcw, Send, ThumbsUp, Trash2, Trophy } from 'lucide-react';
import type { ClientMessage, DrawingState, Player } from '../types';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { soundFX } from '../utils/sound';

interface DrawingGameProps {
  roomCode: string;
  playerId: string;
  isHost: boolean;
  players: Player[];
  state: DrawingState;
  timeOffset: number;
  sendMessage: (msg: ClientMessage) => void;
}

const COLORS = [
  '#0F172A',
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#10B981',
  '#0EA5E9',
  '#6366F1',
  '#EC4899',
  '#8B5CF6',
  '#92400E',
];

const BRUSH_SIZES = [4, 10, 18];

export function DrawingGame({
  roomCode,
  playerId,
  isHost,
  players,
  state,
  timeOffset,
  sendMessage,
}: DrawingGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const historyRef = useRef<string[]>([]);

  const [color, setColor] = useState(COLORS[0]);
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(45);
  const autoSubmittedRef = useRef(false);
  const celebratedRef = useRef(false);

  const hasSubmitted = Boolean(state.submissions[playerId]);
  const myVote = state.voters[playerId];
  const submissionsList = Object.values(state.submissions);

  // Initialize white canvas on new drawing round
  useEffect(() => {
    if (state.phase !== 'drawing') return;
    autoSubmittedRef.current = false;
    celebratedRef.current = false;
    historyRef.current = [];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    historyRef.current.push(canvas.toDataURL('image/jpeg', 0.72));
  }, [state.round, state.phase]);

  const submitDrawing = useCallback(() => {
    if (hasSubmitted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    soundFX.playScore();
    sendMessage({
      type: 'drawing:submit',
      roomCode,
      playerId,
      imageData: dataUrl,
    });
  }, [hasSubmitted, playerId, roomCode, sendMessage]);

  // Countdown timer + auto-submit 1s before end
  useEffect(() => {
    const update = () => {
      const serverNow = Date.now() + timeOffset;
      const rem = Math.max(0, Math.ceil((state.endsAt - serverNow) / 1000));
      setSecondsLeft(rem);
      if (state.phase === 'drawing' && rem <= 1 && !hasSubmitted && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        submitDrawing();
      }
    };
    update();
    const id = setInterval(update, 300);
    return () => clearInterval(id);
  }, [state.endsAt, state.phase, timeOffset, hasSubmitted, submitDrawing]);

  // Results sound & confetti
  useEffect(() => {
    if (state.phase === 'results' && !celebratedRef.current) {
      celebratedRef.current = true;
      if (state.winnerIds.includes(playerId)) {
        soundFX.playWin();
        confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      } else if (state.winnerIds.length > 0) {
        soundFX.playScore();
      }
    }
  }, [state.phase, state.winnerIds, playerId]);

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (hasSubmitted || state.phase !== 'drawing') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getCanvasPoint(e);
    isDrawingRef.current = true;
    lastPosRef.current = pt;

    ctx.beginPath();
    ctx.fillStyle = isEraser ? '#FFFFFF' : color;
    ctx.arc(pt.x, pt.y, (isEraser ? brushSize * 1.6 : brushSize) / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || hasSubmitted || state.phase !== 'drawing') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPosRef.current) return;

    const pt = getCanvasPoint(e);
    ctx.beginPath();
    ctx.strokeStyle = isEraser ? '#FFFFFF' : color;
    ctx.lineWidth = isEraser ? brushSize * 1.6 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    lastPosRef.current = pt;
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPosRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      historyRef.current.push(canvas.toDataURL('image/jpeg', 0.72));
      if (historyRef.current.length > 15) historyRef.current.shift();
    }
  };

  const handleUndo = () => {
    if (hasSubmitted || historyRef.current.length <= 1) return;
    soundFX.playClick();
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !prev) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = prev;
  };

  const handleClear = () => {
    if (hasSubmitted) return;
    soundFX.playClick();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    historyRef.current.push(canvas.toDataURL('image/jpeg', 0.72));
  };

  return (
    <div className="toy-card p-4 sm:p-6 space-y-5">
      {/* Phase Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-l from-pink-50 to-amber-50 border-2 border-pink-200 rounded-2xl p-4">
        <div>
          <div className="text-xs font-extrabold text-pink-600">
            الجولة <span className="font-mono-num">{state.round}</span> ·{' '}
            {state.phase === 'drawing'
              ? 'ارسم الموضوع التالي'
              : state.phase === 'voting'
              ? 'صوّت لأجمل رسمة'
              : 'نتائج التصويت'}
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
            {state.prompt}
          </h3>
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-2xl px-4 py-2 text-center min-w-[88px]">
          <div className="text-[11px] font-bold text-slate-500">الوقت المتبقي</div>
          <div className="font-mono-num text-2xl font-black text-rose-600">
            {secondsLeft}ث
          </div>
        </div>
      </div>

      {/* PHASE 1: DRAWING */}
      {state.phase === 'drawing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-8">
            <div className="relative rounded-3xl overflow-hidden border-[3px] border-slate-300 bg-white shadow-inner">
              <canvas
                ref={canvasRef}
                width={640}
                height={420}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="w-full h-auto block touch-none cursor-crosshair bg-white"
              />
              {hasSubmitted && (
                <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-6 text-center">
                  <CheckCircle2 className="w-14 h-14 text-emerald-400 mb-2" />
                  <p className="text-xl font-black">تم إرسال رسمتك بنجاح!</p>
                  <p className="text-sm text-slate-200 mt-1">
                    بانتظار بقية اللاعبين ({Object.keys(state.submissions).length}/{players.filter((p) => p.connected).length})
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Drawing Tools */}
          <div className="lg:col-span-4 space-y-4 bg-slate-50 border-2 border-slate-200 rounded-2xl p-4">
            <div>
              <span className="text-xs font-extrabold text-slate-600 block mb-2">الألوان</span>
              <div className="grid grid-cols-5 gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={hasSubmitted}
                    onClick={() => {
                      soundFX.playClick();
                      setIsEraser(false);
                      setColor(c);
                    }}
                    className={`h-10 rounded-xl border-2 transition-transform cursor-pointer ${
                      !isEraser && color === c
                        ? 'scale-110 border-slate-900 ring-2 ring-sky-400'
                        : 'border-white shadow-sm'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`لون ${c}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <span className="text-xs font-extrabold text-slate-600 block mb-2">حجم الفرشاة</span>
              <div className="grid grid-cols-3 gap-2">
                {BRUSH_SIZES.map((sz, i) => (
                  <button
                    key={sz}
                    type="button"
                    disabled={hasSubmitted}
                    onClick={() => {
                      soundFX.playClick();
                      setBrushSize(sz);
                    }}
                    className={`py-2.5 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer ${
                      brushSize === sz
                        ? 'bg-sky-100 border-sky-500 text-sky-900'
                        : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <span
                      className="rounded-full bg-slate-800 inline-block"
                      style={{ width: sz / 1.5 + 4, height: sz / 1.5 + 4 }}
                    />
                    <span>{i === 0 ? 'رفيع' : i === 1 ? 'وسط' : 'عريض'}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={hasSubmitted}
                onClick={() => {
                  soundFX.playClick();
                  setIsEraser(!isEraser);
                }}
                className={`toy-btn py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer ${
                  isEraser
                    ? 'bg-amber-400 border-amber-600 text-slate-900'
                    : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                {isEraser ? <Paintbrush className="w-4 h-4" /> : <Eraser className="w-4 h-4" />}
                <span>{isEraser ? 'فرشاة' : 'ممحاة'}</span>
              </button>

              <button
                type="button"
                disabled={hasSubmitted}
                onClick={handleUndo}
                className="toy-btn bg-white border-slate-300 text-slate-700 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>تراجع</span>
              </button>

              <button
                type="button"
                disabled={hasSubmitted}
                onClick={handleClear}
                className="toy-btn bg-rose-50 border-rose-200 text-rose-700 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>مسح</span>
              </button>
            </div>

            <button
              type="button"
              disabled={hasSubmitted}
              onClick={submitDrawing}
              className="toy-btn w-full bg-emerald-500 border-emerald-700 text-white font-display font-black text-lg py-3.5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-5 h-5" />
              <span>{hasSubmitted ? 'تم الإرسال' : 'إرسال الرسمة'}</span>
            </button>
          </div>
        </div>
      )}

      {/* PHASE 2: VOTING */}
      {state.phase === 'voting' && (
        <div className="space-y-4">
          <p className="text-center text-sm sm:text-base font-extrabold text-slate-700">
            {myVote
              ? 'تم تسجيل صوتك! بانتظار تصويت بقية اللاعبين...'
              : 'اضغط على الرسمة التي أعجبتك لمنحها صوتك'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {submissionsList.map((sub) => {
              const isMine = sub.playerId === playerId;
              const disableVote = Boolean(myVote) || (submissionsList.length > 1 && isMine);
              const isVoted = myVote === sub.playerId;

              return (
                <div
                  key={sub.playerId}
                  className={`rounded-2xl border-2 overflow-hidden bg-white transition-all ${
                    isVoted ? 'border-emerald-500 ring-2 ring-emerald-300' : 'border-slate-200'
                  }`}
                >
                  <img
                    src={sub.imageData}
                    alt="رسمة لاعب"
                    className="w-full aspect-[640/420] object-contain bg-white border-b-2 border-slate-100"
                  />
                  <div className="p-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      {isMine ? 'رسمتك أنت' : 'فنان مجهول'}
                    </span>

                    <button
                      type="button"
                      disabled={disableVote}
                      onClick={() => {
                        soundFX.playJoin();
                        sendMessage({
                          type: 'drawing:vote',
                          roomCode,
                          playerId,
                          targetPlayerId: sub.playerId,
                        });
                      }}
                      className={`toy-btn px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 cursor-pointer ${
                        isVoted
                          ? 'bg-emerald-500 border-emerald-700 text-white'
                          : disableVote
                          ? 'bg-slate-100 border-slate-200 text-slate-400'
                          : 'bg-amber-400 border-amber-600 text-slate-900'
                      }`}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span>{isVoted ? 'تم التصويت' : isMine && submissionsList.length > 1 ? 'رسمتك' : 'تصويت'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PHASE 3: RESULTS */}
      {state.phase === 'results' && (
        <div className="space-y-5">
          {submissionsList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 font-bold">
              لم يرسل أحد رسمة في هذه الجولة!
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {submissionsList
                .slice()
                .sort((a, b) => b.votes - a.votes)
                .map((sub) => {
                  const artist = players.find((p) => p.id === sub.playerId);
                  const isWinner = state.winnerIds.includes(sub.playerId);
                  return (
                    <div
                      key={sub.playerId}
                      className={`rounded-2xl border-2 overflow-hidden bg-white ${
                        isWinner ? 'border-amber-400 ring-2 ring-amber-300' : 'border-slate-200'
                      }`}
                    >
                      <img
                        src={sub.imageData}
                        alt={artist?.name || 'رسمة'}
                        className="w-full aspect-[640/420] object-contain bg-white border-b-2 border-slate-100"
                      />
                      <div className="p-3.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {artist && <PlayerAvatar avatarId={artist.avatarId} size="sm" ringColor={artist.color} />}
                          <div className="min-w-0">
                            <div className="font-extrabold text-sm text-slate-900 truncate">
                              {artist?.name || 'لاعب'}
                            </div>
                            <div className="text-xs font-bold text-slate-500 font-mono-num">
                              {sub.votes} أصوات
                            </div>
                          </div>
                        </div>

                        {isWinner && (
                          <div className="flex items-center gap-1 text-amber-600 font-black text-xs shrink-0">
                            <Trophy className="w-4 h-4" />
                            <span>الأفضل!</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {isHost && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  soundFX.playJoin();
                  sendMessage({ type: 'drawing:next_round', roomCode, playerId });
                }}
                className="toy-btn bg-emerald-500 border-emerald-700 text-white font-display font-black text-base px-8 py-3 rounded-2xl cursor-pointer"
              >
                جولة رسم جديدة
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
