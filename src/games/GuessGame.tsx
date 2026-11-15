import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Lightbulb, RotateCcw, Trophy, XCircle } from 'lucide-react';
import type { ClientMessage, GuessState, Player } from '../types';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { soundFX } from '../utils/sound';

interface GuessGameProps {
  roomCode: string;
  playerId: string;
  isHost: boolean;
  players: Player[];
  state: GuessState;
  timeOffset: number;
  sendMessage: (msg: ClientMessage) => void;
}

export function GuessGame({
  roomCode,
  playerId,
  isHost,
  players,
  state,
  timeOffset,
  sendMessage,
}: GuessGameProps) {
  const [secondsLeft, setSecondsLeft] = useState(24);
  const [pickedOption, setPickedOption] = useState<string | null>(null);
  const celebratedRef = useRef(false);

  useEffect(() => {
    setPickedOption(null);
    if (state.round === 1 && state.phase === 'clues') {
      celebratedRef.current = false;
    }
  }, [state.round, state.phase]);

  useEffect(() => {
    const update = () => {
      const serverNow = Date.now() + timeOffset;
      setSecondsLeft(Math.max(0, Math.ceil((state.endsAt - serverNow) / 1000)));
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [state.endsAt, timeOffset]);

  const myAnswer = state.roundAnswered[playerId];

  // Play sound on reveal / gameover
  useEffect(() => {
    if (state.phase === 'reveal' && myAnswer) {
      if (myAnswer.correct) soundFX.playScore();
    }
    if (state.phase === 'gameover' && !celebratedRef.current) {
      celebratedRef.current = true;
      const topScore = Math.max(...players.map((p) => p.score));
      const me = players.find((p) => p.id === playerId);
      if (me && me.score === topScore) {
        soundFX.playWin();
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } else {
        soundFX.playScore();
      }
    }
  }, [state.phase, myAnswer, players, playerId]);

  if (state.phase === 'gameover') {
    const ranked = [...players].sort((a, b) => b.score - a.score);
    return (
      <div className="toy-card p-6 sm:p-8 text-center space-y-6">
        <Trophy className="w-16 h-16 text-amber-400 mx-auto" />
        <div>
          <h3 className="text-2xl sm:text-3xl font-black text-slate-900">انتهت لعبة خمن الشخص!</h3>
          <p className="text-sm text-slate-500 font-bold mt-1">الترتيب النهائي للاعبين</p>
        </div>

        <div className="max-w-md mx-auto space-y-2.5">
          {ranked.map((p, idx) => (
            <div
              key={p.id}
              className={`rounded-2xl border-2 p-3.5 flex items-center justify-between ${
                idx === 0 ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono-num text-lg font-black text-slate-600">#{idx + 1}</span>
                <PlayerAvatar avatarId={p.avatarId} size="sm" ringColor={p.color} />
                <span className="font-extrabold text-slate-900">{p.name}</span>
              </div>
              <span className="font-mono-num font-black text-amber-600">{p.score} نقطة</span>
            </div>
          ))}
        </div>

        {isHost && (
          <button
            type="button"
            onClick={() => {
              soundFX.playJoin();
              sendMessage({ type: 'guess:restart', roomCode, playerId });
            }}
            className="toy-btn bg-emerald-500 border-emerald-700 text-white font-display font-black px-8 py-3.5 rounded-2xl inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-5 h-5" />
            <span>جولة أسئلة جديدة</span>
          </button>
        )}
      </div>
    );
  }

  const firstSolver = state.firstCorrectPlayerId
    ? players.find((p) => p.id === state.firstCorrectPlayerId)
    : null;

  return (
    <div className="toy-card p-4 sm:p-6 space-y-5">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
        <div>
          <div className="text-xs font-extrabold text-amber-700">
            الجولة <span className="font-mono-num">{state.round} / {state.totalRounds}</span> · الفئة: {state.category}
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
            من هي الشخصية المقصودة؟
          </h3>
        </div>

        <div className="bg-white border-2 border-amber-200 rounded-2xl px-4 py-2 text-center min-w-[84px]">
          <div className="text-[11px] font-bold text-slate-500">المتبقي</div>
          <div className="font-mono-num text-2xl font-black text-amber-600">{secondsLeft}ث</div>
        </div>
      </div>

      {/* Progressive Clues */}
      <div className="space-y-2.5">
        {state.clues.slice(0, state.cluesRevealed).map((clue, idx) => (
          <div
            key={idx}
            className="bg-sky-50 border-2 border-sky-200 rounded-2xl px-4 py-3 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-xl bg-sky-500 text-white font-mono-num font-black text-sm flex items-center justify-center shrink-0">
              {idx + 1}
            </div>
            <p className="text-sm sm:text-base font-extrabold text-slate-800">{clue}</p>
          </div>
        ))}

        {state.cluesRevealed < 4 && state.phase === 'clues' && (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 px-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <span>يظهر التلميح التالي خلال لحظات... كلما أسرعت بالإجابة حصلت على نقاط أعلى!</span>
          </div>
        )}
      </div>

      {firstSolver && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl px-4 py-2.5 text-sm font-extrabold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>أول من أجاب إجابة صحيحة: {firstSolver.name}!</span>
        </div>
      )}

      {/* 4 Choice Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {state.options.map((opt) => {
          const isRevealed = state.phase === 'reveal';
          const isCorrectOption = isRevealed && state.correctOption === opt;
          const isMyPick = pickedOption === opt;

          let btnStyle = 'bg-white border-slate-300 text-slate-900 hover:bg-sky-50';
          if (isRevealed) {
            if (isCorrectOption) {
              btnStyle = 'bg-emerald-500 border-emerald-700 text-white';
            } else if (isMyPick && !myAnswer?.correct) {
              btnStyle = 'bg-rose-500 border-rose-700 text-white';
            } else {
              btnStyle = 'bg-slate-100 border-slate-200 text-slate-400';
            }
          } else if (myAnswer) {
            if (isMyPick) {
              btnStyle = myAnswer.correct
                ? 'bg-emerald-500 border-emerald-700 text-white'
                : 'bg-rose-500 border-rose-700 text-white';
            } else {
              btnStyle = 'bg-slate-100 border-slate-200 text-slate-400';
            }
          }

          return (
            <button
              key={opt}
              type="button"
              disabled={Boolean(myAnswer) || state.phase !== 'clues'}
              onClick={() => {
                setPickedOption(opt);
                sendMessage({ type: 'guess:answer', roomCode, playerId, option: opt });
              }}
              className={`toy-btn rounded-2xl p-4 sm:p-5 font-display font-black text-lg flex items-center justify-between gap-2 cursor-pointer ${btnStyle}`}
            >
              <span>{opt}</span>
              {myAnswer && isMyPick && (
                myAnswer.correct ? (
                  <span className="flex items-center gap-1 text-sm">
                    <CheckCircle2 className="w-5 h-5" /> +{myAnswer.points}
                  </span>
                ) : (
                  <XCircle className="w-5 h-5" />
                )
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
