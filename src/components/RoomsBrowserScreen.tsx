import { useState } from 'react';
import { ArrowRight, KeyRound, QrCode, RefreshCw, Users } from 'lucide-react';
import type { PublicRoomSummary } from '../types';
import { GAME_CATALOG } from '../gameData';
import { PlayerAvatar } from './PlayerAvatar';
import { QrScannerModal } from './QrScannerModal';
import { soundFX } from '../utils/sound';

interface RoomsBrowserScreenProps {
  playerName: string;
  playerAvatar: number;
  rooms: PublicRoomSummary[];
  errorMsg: string | null;
  onBack: () => void;
  onRefresh: () => void;
  onJoinRoom: (roomCode: string) => void;
}

export function RoomsBrowserScreen({
  playerName,
  playerAvatar,
  rooms,
  errorMsg,
  onBack,
  onRefresh,
  onJoinRoom,
}: RoomsBrowserScreenProps) {
  const [manualCode, setManualCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <div className="min-h-screen party-bg py-6 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Top Header */}
        <div className="toy-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onBack();
              }}
              className="toy-btn bg-slate-100 border-slate-300 text-slate-700 font-bold px-3.5 py-2 rounded-xl text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>رجوع</span>
            </button>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">الغرف المتاحة</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-bold">
                مرحباً {playerName} · اختر غرفة للانضمام أو امسح الباركود
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <PlayerAvatar avatarId={playerAvatar} size="sm" />
            <button
              type="button"
              onClick={() => {
                soundFX.playClick();
                onRefresh();
              }}
              className="toy-btn bg-sky-50 border-sky-200 text-sky-700 font-bold px-3.5 py-2 rounded-xl text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>تحديث</span>
            </button>
          </div>
        </div>

        {/* Manual Room Code & QR Scanner Entry */}
        <div className="toy-card p-4 sm:p-5 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualCode.trim()) return;
              soundFX.playJoin();
              onJoinRoom(manualCode.trim().toUpperCase());
            }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <div className="flex items-center gap-2 text-slate-700 font-extrabold text-sm shrink-0">
              <KeyRound className="w-5 h-5 text-amber-500" />
              <span>الدخول برمز أو باركود:</span>
            </div>
            <input
              type="text"
              maxLength={6}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="مثال: AB3K9"
              dir="ltr"
              className="flex-1 bg-slate-50 border-2 border-slate-200 focus:border-sky-500 rounded-xl px-4 py-2.5 text-center font-mono-num text-lg font-bold tracking-widest text-slate-900 outline-none uppercase"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="toy-btn flex-1 sm:flex-initial bg-emerald-500 border-emerald-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-sm cursor-pointer whitespace-nowrap"
              >
                دخول بالرمز
              </button>
              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setScannerOpen(true);
                }}
                className="toy-btn flex-1 sm:flex-initial bg-amber-400 border-amber-600 text-slate-900 font-extrabold px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <QrCode className="w-4 h-4" />
                <span>مسح الباركود</span>
              </button>
            </div>
          </form>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="bg-rose-50 border-2 border-rose-300 text-rose-800 rounded-2xl px-4 py-3 text-sm font-bold"
          >
            {errorMsg}
          </div>
        )}

        {/* Rooms List */}
        {rooms.length === 0 ? (
          <div className="toy-card p-10 text-center space-y-3">
            <div className="text-5xl">🎪</div>
            <h3 className="text-xl font-black text-slate-800">لا توجد غرف مفتوحة حالياً</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              يمكنك العودة للشاشة الرئيسية والضغط على &quot;صنع غرفة&quot; لإنشاء غرفتك ودعوة أصدقائك فوراً.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((r) => {
              const isFull = r.playerCount >= r.maxPlayers;
              const gameMeta = r.currentGame
                ? GAME_CATALOG.find((g) => g.id === r.currentGame)
                : null;
              return (
                <div
                  key={r.code}
                  className="toy-card p-5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <PlayerAvatar avatarId={r.hostAvatarId} size="md" showHostCrown />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-slate-900 truncate">
                          غرفة {r.hostName}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-bold mt-1">
                        <span className="font-mono-num text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          {r.code}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="flex items-center gap-1 font-mono-num">
                          <Users className="w-3.5 h-3.5 text-sky-500" />
                          {r.playerCount}/{r.maxPlayers}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {gameMeta
                            ? `يلعبون: ${gameMeta.title}`
                            : 'في صالة الانتظار'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isFull}
                    onClick={() => {
                      soundFX.playJoin();
                      onJoinRoom(r.code);
                    }}
                    className={`toy-btn px-4 py-2.5 rounded-xl font-extrabold text-sm whitespace-nowrap shrink-0 cursor-pointer ${
                      isFull
                        ? 'bg-slate-200 border-slate-300 text-slate-500'
                        : 'bg-emerald-500 border-emerald-700 text-white'
                    }`}
                  >
                    {isFull ? 'ممتلئة' : 'دخول الغرفة'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setScannerOpen(false);
          onJoinRoom(code);
        }}
      />
    </div>
  );
}
