import { useState } from 'react';
import { ArrowRight, LayoutGrid, LogOut, Trophy, Volume2, VolumeX } from 'lucide-react';
import type { GameId, RoomState } from '../types';
import { GAME_CATALOG } from '../gameData';
import { PlayerAvatar } from './PlayerAvatar';
import { soundFX } from '../utils/sound';

interface GameTopBarProps {
  room: RoomState;
  playerId: string;
  currentGame: GameId;
  onChangeGame: () => void;
  onBackToLobby: () => void;
  onTempStepOut: () => void;
  onLeaveRoom: () => void;
}

export function GameTopBar({
  room,
  playerId,
  currentGame,
  onChangeGame,
  onBackToLobby,
  onTempStepOut,
  onLeaveRoom,
}: GameTopBarProps) {
  const [muted, setMuted] = useState(soundFX.muted);
  const isHost = room.hostId === playerId;
  const meta = GAME_CATALOG.find((g) => g.id === currentGame);

  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);

  const toggleMute = () => {
    soundFX.muted = !soundFX.muted;
    setMuted(soundFX.muted);
    if (!soundFX.muted) soundFX.playClick();
  };

  return (
    <div className="space-y-3">
      {/* Main Control Row */}
      <div className="toy-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 whitespace-nowrap">
            {meta?.title}
          </h2>
          <span className="text-xs font-bold text-slate-500 font-mono-num">
            غرفة {room.code}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            title={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
            className="toy-btn bg-slate-100 border-slate-300 text-slate-700 p-2 rounded-xl cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {isHost ? (
            <>
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  onChangeGame();
                }}
                className="toy-btn bg-amber-400 border-amber-600 text-slate-900 font-extrabold px-3 py-1.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <LayoutGrid className="w-4 h-4" />
                <span>لعبة أخرى</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  onBackToLobby();
                }}
                className="toy-btn bg-sky-500 border-sky-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>العودة للغرفة</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onTempStepOut();
              }}
              className="toy-btn bg-sky-500 border-sky-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للغرفة</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              onLeaveRoom();
            }}
            className="toy-btn bg-rose-50 border-rose-200 text-rose-700 font-bold px-3 py-1.5 rounded-xl text-xs sm:text-sm flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>خروج</span>
          </button>
        </div>
      </div>

      {/* Live Leaderboard Strip */}
      <div className="toy-card px-3 py-2.5 flex items-center gap-2 overflow-x-auto">
        <div className="flex items-center gap-1 text-xs font-extrabold text-amber-600 shrink-0 pl-2 border-l-2 border-slate-100">
          <Trophy className="w-4 h-4" />
          <span>الترتيب</span>
        </div>

        <div className="flex items-center gap-2.5">
          {sortedPlayers.map((p, index) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border shrink-0 ${
                p.id === playerId
                  ? 'bg-sky-50 border-sky-300'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <span className="font-mono-num text-xs font-black text-slate-500">
                #{index + 1}
              </span>
              <PlayerAvatar avatarId={p.avatarId} size="sm" ringColor={p.color} showHostCrown={p.isHost} />
              <div className="leading-tight">
                <div className="text-xs font-extrabold text-slate-900 max-w-[90px] truncate">
                  {p.name}
                </div>
                <div className="font-mono-num text-xs font-black text-amber-600">
                  {p.score} ن
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
