import nationalParkUrl from '../../../assets/stickers/national_park.png?url';
import satelliteUrl from '../../../assets/stickers/satellite.png?url';
import seedlingUrl from '../../../assets/stickers/seedling.png?url';
import sunBehindCloudUrl from '../../../assets/stickers/sun_behind_small_cloud.png?url';
import tractorUrl from '../../../assets/stickers/tractor.png?url';

const stickerUrls = {
  landscape: nationalParkUrl,
  satellite: satelliteUrl,
  seedling: seedlingUrl,
  sunnyCloud: sunBehindCloudUrl,
  tractor: tractorUrl,
} as const;

export type StickerName = keyof typeof stickerUrls;

type StickerProps = {
  name: StickerName;
  size?: number;
  className?: string;
};

export function Sticker({ name, size = 56, className = '' }: StickerProps) {
  return (
    <img
      src={stickerUrls[name]}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`select-none drop-shadow-sm ${className}`}
    />
  );
}
