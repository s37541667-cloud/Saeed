import { useState } from 'react';
import { DoorOpen, PlusCircle, QrCode, RotateCcw, Sparkles, Users } from 'lucide-react';
import { AVATAR_OPTIONS } from '../gameData';
import { HERO_ISLAND_IMAGE, ResilientArtwork } from './GameArtwork';
import { PlayerAvatar } from './PlayerAvatar';
import { QrScannerModal } from './QrScannerModal';
import { soundFX } from '../utils/sound';

interface StartScreenProps {
  initialName: string;
  initialAvatar: number;
  inviteRoomCode: string | null;
  lastRoomCode: string | null;
  connected: boolean;
  errorMsg: string | null;
  onClearError: () => void;
  onCreateRoom: (name: string, avatarId: number) => void;
  onOpenRooms: (name: string, avatarId: number) => void;
  onJoinInvitedRoom: (code: string, name: string, avatarId: number) => void;
  onRejoinLastRoom: (code: string) => void;
  onSetInviteCode: (code: string) => void;
}

export function StartScreen({
  initialName,
  initialAvatar,
  inviteRoomCode,
  lastRoomCode,
  connected,
  errorMsg,
  onClearError,
  onCreateRoom,
  onOpenRooms,
  onJoinInvitedRoom,
  onRejoinLastRoom,
  onSetInviteCode,
}: StartScreenProps) {
  const [name, setName] = useState(initialName);
  const [avatarId, setAvatarId] = useState(initialAvatar);
  const [localError, setLocalError] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);

  const displayError = localError || errorMsg;

  const validateName = (): string | null => {
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError('من فضلك اكتب اسمك أولاً للبدء');
      return null;
    }
    setLocalError(null);
    onClearError();
    return trimmed;
  };

  const handleQrDetected = (scannedCode: string) => {
    setScannerOpen(false);
    const trimmed = name.trim();
    if (trimmed) {
      onJoinInvitedRoom(scannedCode, trimmed, avatarId);
    } else {
      onSetInviteCode(scannedCode);
      setLocalError(null);
    }
  };

  return (
    <div className="min-h-screen party-bg flex flex-col justify-center py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full mx-auto">
        <div className="toy-card overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
          {/* Right / Primary Form Column (RTL first) */}
          <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center justify-between gap-3 mb-3">
                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
                  مهرجان الألعاب
                </h1>
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                  {connected ? 'متصل أونلاين' : 'جاري الاتصال...'}
                </span>
              </div>
              <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed">
                العب مع أصدقائك أو عائلتك من 1 إلى 6 لاعبين في 5 ألعاب جماعية ممتعة ومباشرة على الجوال والآيباد والكمبيوتر.
              </p>
            </div>

            {inviteRoomCode && (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                <div>
                  <p className="text-sm font-extrabold text-amber-900">
                    تم قراءة باركود الغرفة{' '}
                    <span className="font-mono-num bg-white px-2 py-0.5 rounded-lg border border-amber-300">
                      {inviteRoomCode}
                    </span>
                  </p>
                  <p className="text-xs text-amber-800 mt-0.5">
                    اكتب اسمك واضغط &quot;دخول الغرفة&quot; للانضمام فوراً
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!connected}
                  onClick={() => {
                    const valid = validateName();
                    if (!valid) return;
                    soundFX.playJoin();
                    onJoinInvitedRoom(inviteRoomCode, valid, avatarId);
                  }}
                  className="toy-btn bg-emerald-500 border-emerald-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-sm whitespace-nowrap shrink-0 cursor-pointer"
                >
                  دخول الغرفة {inviteRoomCode}
                </button>
              </div>
            )}

            {lastRoomCode && !inviteRoomCode && (
              <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div className="text-sm font-bold text-sky-900">
                  غرفتك السابقة لا تزال نشطة:{' '}
                  <span className="font-mono-num font-extrabold">{lastRoomCode}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    onRejoinLastRoom(lastRoomCode);
                  }}
                  className="toy-btn bg-sky-500 border-sky-700 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>العودة للغرفة</span>
                </button>
              </div>
            )}

            {/* Player Name & Avatar Selector */}
            <div className="space-y-4">
              <div>
                <label htmlFor="player-name" className="block text-sm font-extrabold text-slate-800 mb-2">
                  اسم اللاعب
                </label>
                <div className="flex items-center gap-3">
                  <PlayerAvatar avatarId={avatarId} size="md" />
                  <input
                    id="player-name"
                    type="text"
                    maxLength={20}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (localError) setLocalError(null);
                      if (errorMsg) onClearError();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && inviteRoomCode && connected) {
                        const valid = validateName();
                        if (valid) {
                          soundFX.playJoin();
                          onJoinInvitedRoom(inviteRoomCode, valid, avatarId);
                        }
                      }
                    }}
                    placeholder="اكتب اسمك هنا..."
                    className="w-full bg-slate-50 border-2 border-slate-200 focus:border-sky-500 focus:bg-white rounded-2xl px-4 py-3 text-base font-bold text-slate-900 outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-slate-500 mb-2">اختر شخصيتك الرمزية</span>
                <div className="grid grid-cols-6 gap-2">
                  {AVATAR_OPTIONS.map((av) => {
                    const selected = avatarId === av.id;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        onClick={() => {
                          soundFX.playClick();
                          setAvatarId(av.id);
                        }}
                        title={av.label}
                        className={`h-11 rounded-xl border-2 flex items-center justify-center text-xl transition-transform cursor-pointer ${
                          selected
                            ? 'scale-105 ring-2 ring-sky-400 ring-offset-1 shadow-sm'
                            : 'opacity-80 hover:opacity-100 hover:scale-105'
                        }`}
                        style={{
                          backgroundColor: av.bg,
                          borderColor: selected ? '#0EA5E9' : av.border,
                        }}
                      >
                        {av.emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {displayError && (
              <div
                role="alert"
                className="bg-rose-50 border-2 border-rose-300 text-rose-800 rounded-xl px-4 py-2.5 text-sm font-bold"
              >
                {displayError}
              </div>
            )}

            {/* Main Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!connected}
                  onClick={() => {
                    const valid = validateName();
                    if (!valid) return;
                    soundFX.playJoin();
                    onCreateRoom(valid, avatarId);
                  }}
                  className="toy-btn bg-emerald-500 border-emerald-700 text-white font-display font-extrabold text-lg py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <PlusCircle className="w-5 h-5 shrink-0" />
                  <span className="whitespace-nowrap">صنع غرفة</span>
                </button>

                <button
                  type="button"
                  disabled={!connected}
                  onClick={() => {
                    const valid = validateName();
                    if (!valid) return;
                    soundFX.playClick();
                    onOpenRooms(valid, avatarId);
                  }}
                  className="toy-btn bg-sky-500 border-sky-700 text-white font-display font-extrabold text-lg py-3.5 px-5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
                >
                  <DoorOpen className="w-5 h-5 shrink-0" />
                  <span className="whitespace-nowrap">دخول الغرف</span>
                </button>
              </div>

              <button
                type="button"
                disabled={!connected}
                onClick={() => {
                  soundFX.playClick();
                  setScannerOpen(true);
                }}
                className="toy-btn w-full bg-amber-400 border-amber-600 text-slate-900 font-display font-extrabold text-base py-3 px-5 rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <QrCode className="w-5 h-5 shrink-0" />
                <span>مسح باركود الغرفة (QR)</span>
              </button>
            </div>
          </div>

          {/* Left / 3D Island Artwork Column */}
          <div className="lg:col-span-6 bg-gradient-to-b from-sky-100 to-blue-50 relative flex flex-col justify-between p-5 sm:p-6 border-t-2 lg:border-t-0 lg:border-r-2 border-slate-100">
            <div className="relative rounded-2xl overflow-hidden border-2 border-white shadow-md aspect-[16/10] lg:aspect-auto lg:flex-1">
              <ResilientArtwork
                src={HERO_ISLAND_IMAGE}
                alt="جزيرة مهرجان الألعاب"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-white/90 rounded-2xl p-3 border border-sky-100">
                <Users className="w-5 h-5 text-sky-600 mx-auto mb-1" />
                <div className="text-xs font-extrabold text-slate-800">1 إلى 6 لاعبين</div>
                <div className="text-[11px] text-slate-500">لعب جماعي مباشر</div>
              </div>
              <div className="bg-white/90 rounded-2xl p-3 border border-sky-100">
                <Sparkles className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                <div className="text-xs font-extrabold text-slate-800">5 ألعاب متنوعة</div>
                <div className="text-[11px] text-slate-500">رسم، مضارب، سباق</div>
              </div>
              <div className="bg-white/90 rounded-2xl p-3 border border-sky-100">
                <QrCode className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                <div className="text-xs font-extrabold text-slate-800">دعوة بـ QR</div>
                <div className="text-[11px] text-slate-500">جوال وآيباد وكمبيوتر</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleQrDetected}
      />
    </div>
  );
}
