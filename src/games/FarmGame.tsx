import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Coins, Droplets, RotateCcw, ShoppingBag, Sparkles, Sprout, Trophy } from 'lucide-react';
import type { ClientMessage, FarmState, Player } from '../types';
import { FARM_CROPS } from '../gameData';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { soundFX } from '../utils/sound';

interface FarmGameProps {
  roomCode: string;
  playerId: string;
  isHost: boolean;
  players: Player[];
  state: FarmState;
  timeOffset: number;
  sendMessage: (msg: ClientMessage) => void;
}

export function FarmGame({
  roomCode,
  playerId,
  isHost,
  players,
  state,
  timeOffset,
  sendMessage,
}: FarmGameProps) {
  const [selectedCropId, setSelectedCropId] = useState<string>(FARM_CROPS[0].id);
  const [nowTick, setNowTick] = useState(() => Date.now() + timeOffset);
  const celebratedRef = useRef(false);

  const myFarm = state.farms[playerId];

  useEffect(() => {
    if (state.phase === 'playing') {
      celebratedRef.current = false;
    }
    const id = setInterval(() => {
      setNowTick(Date.now() + timeOffset);
    }, 150);
    return () => clearInterval(id);
  }, [state.phase, timeOffset]);

  useEffect(() => {
    if (state.phase === 'gameover' && !celebratedRef.current) {
      celebratedRef.current = true;
      if (state.winnerIds.includes(playerId)) {
        soundFX.playWin();
        confetti({ particleCount: 95, spread: 75, origin: { y: 0.6 } });
      } else {
        soundFX.playScore();
      }
    }
  }, [state.phase, state.winnerIds, playerId]);

  const secondsLeft = Math.max(0, Math.ceil((state.endsAt - nowTick) / 1000));

  if (!myFarm) {
    return (
      <div className="toy-card p-8 text-center font-bold text-slate-600">
        جاري تجهيز مزرعتك...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Farm HUD */}
      <div className="toy-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-l from-emerald-50 to-amber-50">
        <div className="flex items-center gap-4">
          <div className="bg-white border-2 border-amber-300 rounded-2xl px-4 py-2 flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            <div>
              <div className="text-[11px] font-bold text-slate-500">نقودك</div>
              <div className="font-mono-num text-xl font-black text-amber-600">{myFarm.coins}</div>
            </div>
          </div>

          <div className="bg-white border-2 border-emerald-200 rounded-2xl px-4 py-2 flex items-center gap-2">
            <Sprout className="w-5 h-5 text-emerald-600" />
            <div>
              <div className="text-[11px] font-bold text-slate-500">المحاصيل</div>
              <div className="font-mono-num text-xl font-black text-emerald-700">{myFarm.harvestedCount}</div>
            </div>
          </div>
        </div>

        <div className="bg-white border-2 border-slate-200 rounded-2xl px-5 py-2 text-center">
          <div className="text-[11px] font-bold text-slate-500">وقت الحصاد</div>
          <div className="font-mono-num text-2xl font-black text-rose-600">{secondsLeft}ث</div>
        </div>
      </div>

      {/* Game Over Banner */}
      {state.phase === 'gameover' && (
        <div className="toy-card p-6 bg-amber-50 border-amber-300 text-center space-y-3">
          <Trophy className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-2xl font-black text-slate-900">انتهى موسم الزراعة!</h3>
          <p className="text-sm font-bold text-slate-700">
            أغنى مزارع:{' '}
            {state.winnerIds
              .map((id) => players.find((p) => p.id === id)?.name || '')
              .filter(Boolean)
              .join('، ')}
          </p>
          {isHost && (
            <button
              type="button"
              onClick={() => {
                soundFX.playJoin();
                sendMessage({ type: 'farm:restart', roomCode, playerId });
              }}
              className="toy-btn bg-emerald-500 border-emerald-700 text-white font-display font-black px-6 py-3 rounded-2xl inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              <span>موسم زراعة جديد</span>
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Seed Shop */}
        <div className="lg:col-span-4 toy-card p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-900 font-black text-lg">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            <span>متجر البذور</span>
          </div>
          <p className="text-xs font-bold text-slate-500">
            اختر البذرة ثم اضغط على أي حوض تربة فارغ للزراعة
          </p>

          <div className="space-y-2.5">
            {FARM_CROPS.map((crop) => {
              const selected = selectedCropId === crop.id;
              const canAfford = myFarm.coins >= crop.cost;
              return (
                <button
                  key={crop.id}
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    setSelectedCropId(crop.id);
                  }}
                  className={`w-full rounded-2xl border-2 p-3 flex items-center justify-between gap-3 text-right transition-all cursor-pointer ${
                    selected
                      ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-white'
                  } ${!canAfford ? 'opacity-65' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl border border-slate-200"
                      style={{ backgroundColor: crop.bgColor }}
                    >
                      {crop.emoji}
                    </span>
                    <div>
                      <div className="font-extrabold text-sm text-slate-900">{crop.name}</div>
                      <div className="text-[11px] font-bold text-slate-500 font-mono-num">
                        ينمو في {crop.growMs / 1000}ث · البيع {crop.sellPrice}🪙
                      </div>
                    </div>
                  </div>
                  <div className="font-mono-num font-black text-sm text-amber-600 shrink-0">
                    {crop.cost} 🪙
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* My 6-Plot Interactive Farm */}
        <div className="lg:col-span-8 toy-card p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg sm:text-xl font-black text-slate-900">مزرعتك الخاصة</h3>
            <span className="text-xs font-bold text-emerald-700">
              نصيحة: اسقِ النباتات لتنمو بسرعة مضاعفة!
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            {myFarm.plots.map((plot) => {
              const crop = plot.cropId ? FARM_CROPS.find((c) => c.id === plot.cropId) : null;
              const elapsed = crop ? Math.max(0, nowTick - plot.plantedAt) : 0;
              const progress = crop ? Math.min(1, elapsed / plot.growMs) : 0;
              const isReady = Boolean(crop && progress >= 1);

              return (
                <div
                  key={plot.id}
                  className={`rounded-3xl border-[3px] p-4 flex flex-col items-center justify-between gap-3 min-h-[175px] transition-all ${
                    isReady
                      ? 'bg-amber-50 border-amber-400 shadow-md'
                      : crop
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : 'bg-[#F5EBE0] border-[#D5BDAF]'
                  }`}
                >
                  {!crop ? (
                    <>
                      <div className="text-3xl opacity-60 mt-3">🕳️</div>
                      <button
                        type="button"
                        disabled={state.phase !== 'playing'}
                        onClick={() => {
                          const targetCrop = FARM_CROPS.find((c) => c.id === selectedCropId) || FARM_CROPS[0];
                          if (myFarm.coins < targetCrop.cost) {
                            soundFX.playWrong();
                            return;
                          }
                          soundFX.playClick();
                          sendMessage({
                            type: 'farm:plant',
                            roomCode,
                            playerId,
                            plotId: plot.id,
                            cropId: targetCrop.id,
                          });
                        }}
                        className="toy-btn w-full bg-emerald-500 border-emerald-700 text-white font-extrabold text-xs sm:text-sm py-2.5 px-3 rounded-xl cursor-pointer"
                      >
                        ازرع هنا
                      </button>
                    </>
                  ) : isReady ? (
                    <>
                      <div className="text-5xl animate-bounce mt-1">{crop.emoji}</div>
                      <div className="text-xs font-black text-amber-800">{crop.name} جاهز!</div>
                      <button
                        type="button"
                        disabled={state.phase !== 'playing'}
                        onClick={() => {
                          soundFX.playHarvest();
                          sendMessage({
                            type: 'farm:harvest',
                            roomCode,
                            playerId,
                            plotId: plot.id,
                          });
                        }}
                        className="toy-btn w-full bg-amber-400 border-amber-600 text-slate-900 font-black text-xs sm:text-sm py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>حصاد +{crop.sellPrice}🪙</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-4xl mt-1">🌱</div>
                      <div className="w-full space-y-1">
                        <div className="flex justify-between text-[11px] font-bold text-slate-600">
                          <span>{crop.name}</span>
                          <span className="font-mono-num">{Math.round(progress * 100)}%</span>
                        </div>
                        <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-emerald-200">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-150"
                            style={{ width: `${Math.round(progress * 100)}%` }}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={plot.watered || state.phase !== 'playing'}
                        onClick={() => {
                          soundFX.playWater();
                          sendMessage({
                            type: 'farm:water',
                            roomCode,
                            playerId,
                            plotId: plot.id,
                          });
                        }}
                        className={`toy-btn w-full font-extrabold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer ${
                          plot.watered
                            ? 'bg-sky-100 border-sky-200 text-sky-600'
                            : 'bg-sky-500 border-sky-700 text-white'
                        }`}
                      >
                        <Droplets className="w-3.5 h-3.5" />
                        <span>{plot.watered ? 'تم السقي' : 'سقي النبات'}</span>
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Other Players' Farms Live Strip */}
      {players.length > 1 && (
        <div className="toy-card p-4 space-y-3">
          <h4 className="text-sm font-black text-slate-700">مزارع اللاعبين الآخرين</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {players
              .filter((p) => p.id !== playerId)
              .map((p) => {
                const pf = state.farms[p.id];
                return (
                  <div
                    key={p.id}
                    className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <PlayerAvatar avatarId={p.avatarId} size="sm" ringColor={p.color} />
                      <div className="min-w-0">
                        <div className="text-sm font-extrabold text-slate-900 truncate">{p.name}</div>
                        <div className="text-xs font-bold text-slate-500 font-mono-num">
                          {pf ? `${pf.coins} 🪙 · ${pf.harvestedCount} محصول` : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 text-base">
                      {(pf?.plots || []).slice(0, 6).map((pl) => {
                        const c = pl.cropId ? FARM_CROPS.find((x) => x.id === pl.cropId) : null;
                        return <span key={pl.id}>{c ? c.emoji : '▫️'}</span>;
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
