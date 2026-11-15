import { AVATAR_OPTIONS } from '../gameData';

interface PlayerAvatarProps {
  avatarId: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  ringColor?: string;
  showHostCrown?: boolean;
}

const SIZE_CLASSES = {
  sm: 'w-9 h-9 text-lg border-2',
  md: 'w-12 h-12 text-2xl border-2',
  lg: 'w-16 h-16 text-3xl border-[3px]',
  xl: 'w-20 h-20 text-4xl border-[3px]',
};

export function PlayerAvatar({
  avatarId,
  size = 'md',
  ringColor,
  showHostCrown = false,
}: PlayerAvatarProps) {
  const avatar = AVATAR_OPTIONS[avatarId % AVATAR_OPTIONS.length] || AVATAR_OPTIONS[0];

  return (
    <div className="relative inline-flex shrink-0 select-none">
      <div
        className={`${SIZE_CLASSES[size]} rounded-2xl flex items-center justify-center shadow-[0_3px_0_rgba(15,23,42,0.12)] transition-transform`}
        style={{
          backgroundColor: avatar.bg,
          borderColor: ringColor || avatar.border,
        }}
        title={avatar.label}
      >
        <span className="leading-none" role="img" aria-label={avatar.label}>
          {avatar.emoji}
        </span>
      </div>
      {showHostCrown && (
        <span
          className="absolute -top-2.5 -right-2 text-base drop-shadow-sm"
          title="قائد الغرفة"
        >
          👑
        </span>
      )}
    </div>
  );
}
