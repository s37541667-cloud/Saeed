import { ArrowRight, Crown, Play } from 'lucide-react';
import type { GameId, RoomState } from '../types';
import { GAME_CATALOG } from '../gameData';
import { GAME_IMAGE_MAP, ResilientArtwork } from './GameArtwork';
import { soundFX } from '../utils/sound';

interface GameSelectScreenProps {
  room: RoomState;
  playerId: string;
  onSelectGame: (gameId: GameId) => void;
  onBackToLobby: () => void;
}

export function GameSelectScreen({
  room,
  playerId,
  onSelectGame,
  onBackToLobby,
}: GameSelectScreenProps) {
  const isHost = room.hostId === playerId;
  const hostPlayer = room.players.find((p) => p.id === room.hostId);

  return (
    <div className="min-h-screen party-bg py-6 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="toy-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isHost && (
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  onBackToLobby();
                }}
                className="toy-btn bg-slate-100 border-slate-300 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-sm flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة للغرفة</span>
              </button>
            )}
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">اختر اللعبة الجماعية</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-bold">
                {isHost
                  ? 'اختر إحدى الألعاب الخمس ليدخل جميع اللاعبين معك فوراً'
                  : `قائد الغرفة (${hostPlayer?.name || ''}) يختار اللعبة الآن...`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm font-extrabold text-slate-700 bg-amber-50 border-2 border-amber-200 px-4 py-2 rounded-xl">
            <Crown className="w-4 h-4 text-amber-500" />
            <span>غرفة</span>
            <span className="font-mono-num">{room.code}</span>
            <span>·</span>
            <span className="font-mono-num">{room.players.length} لاعبين</span>
          </div>
        </div>

        {/* 5 Games Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAME_CATALOG.map((game, idx) => (
            <div
              key={game.id}
              className={`toy-card overflow-hidden flex flex-col justify-between transition-transform ${
                isHost ? 'hover:-translate-y-1' : 'opacity-95'
              }`}
            >
              <div>
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 border-b-2 border-slate-100">
                  <ResilientArtwork
                    src={GAME_IMAGE_MAP[game.id]}
                    alt={game.title}
                    gameId={game.id}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-extrabold text-slate-500">
                      اللعبة {idx + 1} · {game.durationLabel}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-1.5">{game.title}</h3>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed">
                    {game.subtitle}
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5">
                {isHost ? (
                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playJoin();
                      onSelectGame(game.id);
                    }}
                    className="toy-btn w-full bg-sky-500 border-sky-700 text-white font-display font-extrabold py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>ابدأ {game.title}</span>
                  </button>
                ) : (
                  <div className="text-center py-2.5 rounded-xl bg-slate-100 text-slate-500 text-xs font-bold">
                    بانتظار اختيار القائد
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
