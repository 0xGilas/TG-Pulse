import React, { useEffect, useState } from 'react';
import type { ChannelSummary } from '../../types/analytics';

interface ChannelAvatarProps {
  channel: Pick<ChannelSummary, 'title' | 'avatarColor' | 'avatarUrl'>;
  size?: number;
  className?: string;
}

export const ChannelAvatar: React.FC<ChannelAvatarProps> = React.memo(
  ({ channel, size = 36, className = '' }) => {
    const [imgFailed, setImgFailed] = useState(false);

    useEffect(() => {
      setImgFailed(false);
    }, [channel.avatarUrl]);

    const initials = channel.title.trim().slice(0, 2).toUpperCase() || 'CH';
    const showImage = Boolean(channel.avatarUrl) && !imgFailed;

    return (
      <div
        className={`rounded-full overflow-hidden flex items-center justify-center font-bold text-white shrink-0 select-none ring-1 ring-white/15 ${className}`}
        style={{
          width: size,
          height: size,
          fontSize: Math.max(10, Math.round(size * 0.34)),
          backgroundColor: showImage ? '#0D1218' : channel.avatarColor,
        }}
      >
        {showImage ? (
          <img
            src={channel.avatarUrl}
            alt={channel.title}
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
    );
  },
);

ChannelAvatar.displayName = 'ChannelAvatar';
