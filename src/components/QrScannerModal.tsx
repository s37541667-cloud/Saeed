import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, ImageUp, X } from 'lucide-react';
import { soundFX } from '../utils/sound';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (roomCode: string) => void;
}

export function extractRoomCodeFromQr(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const param = url.searchParams.get('room');
    if (param && /^[A-Za-z0-9]{4,8}$/.test(param.trim())) {
      return param.trim().toUpperCase();
    }
  } catch {
    // not a full URL, check regex / plain code
  }

  const queryMatch = trimmed.match(/[?&]room=([A-Za-z0-9]{4,8})/i);
  if (queryMatch) {
    return queryMatch[1].toUpperCase();
  }

  if (/^[A-Za-z0-9]{4,8}$/.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return null;
}

export function QrScannerModal({ isOpen, onClose, onDetected }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let stopped = false;
    let rafId = 0;

    const stopCamera = () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };

    const startCamera = async () => {
      setCameraError(null);
      setScanError(null);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('المتصفح لا يدعم تشغيل الكاميرا مباشرة. يمكنك اختيار صورة الباركود أدناه.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const tick = () => {
          if (stopped) return;
          const v = videoRef.current;
          const c = canvasRef.current;
          if (v && c && v.readyState >= 2 && v.videoWidth > 0) {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(v, 0, 0, c.width, c.height);
              const imgData = ctx.getImageData(0, 0, c.width, c.height);
              const qr = jsQR(imgData.data, imgData.width, imgData.height, {
                inversionAttempts: 'attemptBoth',
              });
              if (qr?.data) {
                const code = extractRoomCodeFromQr(qr.data);
                if (code) {
                  soundFX.playJoin();
                  stopCamera();
                  onDetected(code);
                  return;
                }
              }
            }
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      } catch {
        if (!stopped) {
          setCameraError('تعذر الوصول إلى الكاميرا. اسمح بإذن الكاميرا أو اختر صورة الباركود.');
        }
      }
    };

    startCamera();

    return () => {
      stopped = true;
      stopCamera();
    };
  }, [isOpen, onDetected]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const qr = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (qr?.data) {
          const code = extractRoomCodeFromQr(qr.data);
          if (code) {
            URL.revokeObjectURL(objectUrl);
            soundFX.playJoin();
            onDetected(code);
            return;
          }
        }
      }
      URL.revokeObjectURL(objectUrl);
      soundFX.playWrong();
      setScanError('لم يتم العثور على باركود غرفة صالح في هذه الصورة.');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setScanError('تعذر قراءة الصورة.');
    };
    img.src = objectUrl;
    e.target.value = '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="toy-card w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-sky-500" />
            <h3 className="text-lg font-black text-slate-900">مسح باركود الغرفة (QR)</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-square flex items-center justify-center border-2 border-slate-200">
          {!cameraError ? (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-52 h-52 rounded-3xl border-4 border-amber-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
              </div>
              <span className="absolute bottom-3 bg-slate-900/80 text-white text-xs font-bold px-3 py-1 rounded-lg">
                وجّه الكاميرا نحو الباركود
              </span>
            </>
          ) : (
            <div className="p-6 text-center text-white space-y-2">
              <Camera className="w-10 h-10 text-amber-400 mx-auto" />
              <p className="text-sm font-bold leading-relaxed">{cameraError}</p>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {scanError && (
          <div className="bg-rose-50 border-2 border-rose-200 text-rose-700 text-xs font-bold px-3 py-2 rounded-xl">
            {scanError}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              fileInputRef.current?.click();
            }}
            className="toy-btn bg-amber-400 border-amber-600 text-slate-900 font-extrabold py-2.5 px-3 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ImageUp className="w-4 h-4" />
            <span>اختيار صورة QR</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFX.playClick();
              onClose();
            }}
            className="toy-btn bg-slate-100 border-slate-300 text-slate-700 font-extrabold py-2.5 px-3 rounded-xl text-xs sm:text-sm cursor-pointer"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
