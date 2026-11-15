import { useState } from 'react';
import { Gamepad2, Palette, Sparkles, Car, Sprout, Search } from 'lucide-react';
import type { GameId } from '../types';

export const HERO_ISLAND_IMAGE = '/src/assets/images/lobby_party_island_1794751258160.jpg';

export const GAME_IMAGE_MAP: Record<GameId, string> = {
  drawing: '/src/assets/images/card_drawing_studio_1794751259329.jpg',
  pong: '/src/assets/images/card_paddle_arena_1794751258912.jpg',
  guess: '/src/assets/images/card_mystery_guess_1794751259481.jpg',
  race: '/src/assets/images/card_turbo_race_1794751261453.jpg',
  farm: '/src/assets/images/card_happy_farm_1794751261319.jpg',
};

interface ResilientArtworkProps {
  src: string;
  alt: string;
  gameId?: GameId;
  className?: string;
}

export function ResilientArtwork({ src, alt, gameId, className = '' }: ResilientArtworkProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-sky-100 via-amber-50 to-emerald-100 text-slate-700 ${className}`}
      >
        {gameId === 'drawing' && <Palette className="w-10 h-10 text-pink-500 mb-1" />}
        {gameId === 'pong' && <Gamepad2 className="w-10 h-10 text-sky-500 mb-1" />}
        {gameId === 'guess' && <Search className="w-10 h-10 text-amber-500 mb-1" />}
        {gameId === 'race' && <Car className="w-10 h-10 text-rose-500 mb-1" />}
        {gameId === 'farm' && <Sprout className="w-10 h-10 text-emerald-500 mb-1" />}
        {!gameId && <Sparkles className="w-10 h-10 text-amber-500 mb-1" />}
        <span className="text-xs font-bold text-slate-600">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
