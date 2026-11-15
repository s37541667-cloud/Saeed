import { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Download, LogOut, Play, Share2, Users } from 'lucide-react';
import type { RoomState } from '../types';
import { PlayerAvatar } from './PlayerAvatar';
import { soundFX } from '../utils/sound';

interface RoomLobbyScreenProps {
  room: RoomState;
  playerId: string;
  onStartGameSelect: () => void;
  onLeaveRoom: () => void;
}

export function RoomLobbyScreen({
  room,
  playerId,
  onStartGameSelect,
  onLeaveRoom,
}: RoomLobbyScreenProps) {
  const [copiedType, setCopiedType] = useState<'code' | 'link' | null>(null);
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);
  const isHost = room.hostId === playerId;
  const inviteUrl = `${window.location.origin}/?room=${room.code}`;
  const emptySlots = Math.max(0, room.maxPlayers - room.players.length);

  const copyText = async (text: string, kind: 'code' | 'link') => {
    soundFX.playClick();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(kind);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleShare = async () => {
    soundFX.playClick();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'انضم إليّ في مهرجان الألعاب!',
          text: `انضم لغرفتي برمز: ${room.code}`,
          url: inviteUrl,
        });
        return;
      } catch {
        // fallback to copy
      }
    }
    copyText(inviteUrl, 'link');
  };

  const handleDownloadQr = () => {
    soundFX.playClick();
    const svg = qrWrapperRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `room-${room.code}-qr.png`;
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="min-h-screen party-bg py-6 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Top Bar */}
        <div className="toy-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 border-2 border-amber-300 flex items-center justify-center text-2xl">
              🎪
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">صالة الغرفة</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-bold">
                اللاعبون المتواجدون: <span className="font-mono-num text-slate-800">{room.players.length}/{room.maxPlayers}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              onLeaveRoom();
            }}
            className="toy-btn bg-rose-50 border-rose-200 text-rose-700 font-extrabold px-4 py-2 rounded-xl text-sm flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>مغادرة الغرفة</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Invite & QR Card */}
          <div className="lg:col-span-5 toy-card p-6 flex flex-col items-center text-center gap-4">
            <div>
              <span className="text-xs font-extrabold text-slate-500">رمز الغرفة للمشاركة</span>
              <div className="mt-1.5 flex items-center justify-center gap-2">
                <span
                  dir="ltr"
                  className="font-mono-num text-3xl sm:text-4xl font-black tracking-[0.2em] text-slate-900 bg-amber-50 border-2 border-amber-300 px-5 py-2 rounded-2xl select-all"
                >
                  {room.code}
                </span>
              </div>
            </div>

            {/* Real QR Code */}
            <div
              ref={qrWrapperRef}
              className="bg-white p-3 rounded-3xl border-2 border-slate-200 shadow-inner"
            >
              <QRCodeSVG
                value={inviteUrl}
                size={180}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="M"
                includeMargin={true}
              />
            </div>

            <p className="text-xs text-slate-500 font-bold max-w-xs">
              امسح الباركود بكاميرا الجوال أو من داخل زر &quot;مسح الباركود&quot; في اللعبة للانضمام فوراً
            </p>

            <div className="w-full grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => copyText(room.code, 'code')}
                className="toy-btn bg-slate-100 border-slate-300 text-slate-800 font-extrabold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                {copiedType === 'code' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copiedType === 'code' ? 'تم!' : 'نسخ الرمز'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadQr}
                className="toy-btn bg-amber-400 border-amber-600 text-slate-900 font-extrabold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>حفظ QR</span>
              </button>

              <button
                type="button"
                onClick={handleShare}
                className="toy-btn bg-sky-500 border-sky-700 text-white font-extrabold py-2.5 px-2 rounded-xl text-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                {copiedType === 'link' ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedType === 'link' ? 'نُسخ!' : 'مشاركة'}</span>
              </button>
            </div>
          </div>

          {/* Players Roster & Start Game */}
          <div className="lg:col-span-7 toy-card p-6 flex flex-col justify-between gap-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-sky-500" />
                  <span>قائمة اللاعبين ({room.players.length} / {room.maxPlayers})</span>
                </h3>
                <span className="text-xs font-bold text-slate-500">الحد الأدنى 1 · الأقصى 6</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {room.players.map((p) => (
                  <div
                    key={p.id}
                    className={`rounded-2xl border-2 p-3.5 flex items-center justify-between gap-3 transition-all ${
                      p.id === playerId
                        ? 'bg-sky-50 border-sky-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <PlayerAvatar
                        avatarId={p.avatarId}
                        size="md"
                        ringColor={p.color}
                        showHostCrown={p.isHost}
                      />
                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 truncate flex items-center gap-1.5">
                          <span>{p.name}</span>
                          {p.id === playerId && (
                            <span className="text-xs text-sky-600 font-bold">(أنت)</span>
                          )}
                        </div>
                        <div className="text-xs font-bold text-slate-500 mt-0.5">
                          {p.isHost ? 'قائد الغرفة' : 'لاعب'} · {p.connected ? 'متصل' : 'يعيد الاتصال'}
                        </div>
                      </div>
                    </div>

                    <div className="text-left shrink-0">
                      <div className="font-mono-num text-sm font-black text-amber-600">
                        {p.score}
                      </div>
                      <div className="text-[11px] text-slate-400 font-bold">نقطة</div>
                    </div>
                  </div>
                ))}

                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <div
                    key={`empty-${idx}`}
                    className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-3.5 flex items-center gap-3 text-slate-400"
                  >
                    <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center text-lg font-bold">
                      +
                    </div>
                    <span className="text-sm font-bold">بانتظار انضمام لاعب...</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t-2 border-slate-100">
              {isHost ? (
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playWin();
                    onStartGameSelect();
                  }}
                  className="toy-btn w-full bg-emerald-500 border-emerald-700 text-white font-display font-black text-xl py-4 px-6 rounded-2xl flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  <Play className="w-6 h-6 fill-current" />
                  <span>ابدأ واختر اللعبة</span>
                </button>
              ) : (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 text-center">
                  <p className="text-sm sm:text-base font-extrabold text-amber-900">
                    بانتظار قائد الغرفة ليضغط &quot;ابدأ&quot; ويختار اللعبة...
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
