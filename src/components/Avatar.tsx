import { useEffect, useState } from 'react';
import type { PublicGroup, PublicUser } from '../types.ts';
import { fullName, getGroupInitials, getInitials } from '../utils/format.ts';

interface AvatarProps {
  user: Pick<PublicUser, 'name' | 'surname' | 'avatar' | 'avatarColor' | 'online'>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showOnline?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

const DOT_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'w-2 h-2 border',
  sm: 'w-2.5 h-2.5 border-2',
  md: 'w-3 h-3 border-2',
  lg: 'w-3.5 h-3.5 border-2',
  xl: 'w-4 h-4 border-[3px]',
};

export function Avatar({ user, size = 'md', showOnline = false, className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user.avatar]);

  const hasPhoto = Boolean(user.avatar) && !imgError;

  return (
    <div className={`relative inline-flex shrink-0 select-none ${className}`}>
      {hasPhoto ? (
        <img
          key={user.avatar}
          src={user.avatar}
          alt={fullName(user)}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`${SIZE_CLASSES[size]} rounded-full object-cover bg-[#1D2733]`}
        />
      ) : (
        <div
          style={{ backgroundColor: user.avatarColor || '#4E8FD9' }}
          className={`${SIZE_CLASSES[size]} rounded-full flex items-center justify-center font-display font-semibold text-white tracking-tight`}
        >
          {getInitials(user)}
        </div>
      )}

      {showOnline && user.online && (
        <span
          aria-label="online"
          className={`absolute bottom-0 right-0 rounded-full bg-[#34C77B] border-[#151E27] ${DOT_CLASSES[size]}`}
        />
      )}
    </div>
  );
}

interface GroupAvatarProps {
  group: Pick<PublicGroup, 'name' | 'avatar' | 'avatarColor'>;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function GroupAvatar({ group, size = 'md', className = '' }: GroupAvatarProps) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [group.avatar]);

  const hasPhoto = Boolean(group.avatar) && !imgError;

  return (
    <div className={`relative inline-flex shrink-0 select-none ${className}`}>
      {hasPhoto ? (
        <img
          key={group.avatar}
          src={group.avatar}
          alt={group.name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`${SIZE_CLASSES[size]} rounded-full object-cover bg-[#1D2733]`}
        />
      ) : (
        <div
          style={{ backgroundColor: group.avatarColor || '#3C9FB8' }}
          className={`${SIZE_CLASSES[size]} rounded-full flex items-center justify-center font-display font-semibold text-white tracking-tight`}
        >
          {getGroupInitials(group)}
        </div>
      )}
    </div>
  );
}
