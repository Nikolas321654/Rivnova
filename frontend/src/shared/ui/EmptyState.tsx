import type { ReactNode } from 'react';
import { Sticker, type StickerName } from './Sticker';

type EmptyStateProps = {
  stickers: [StickerName, ...StickerName[]];
  title: string;
  text?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

const companionPlacement = ['-bottom-1 -right-3', '-left-3 top-0'] as const;

export function EmptyState({ stickers, title, text, actions, className = '' }: EmptyStateProps) {
  const [main, ...companions] = stickers;

  return (
    <div className={`group flex flex-col items-center px-2 py-5 text-center ${className}`}>
      <div className="relative motion-safe:animate-[sticker-in_420ms_ease-out_both]">
        <Sticker
          name={main}
          size={56}
          className="transition-transform duration-300 ease-out motion-safe:group-hover:-translate-y-0.5"
        />
        {companions.slice(0, 2).map((name, index) => (
          <Sticker
            key={name}
            name={name}
            size={30}
            className={`absolute ${companionPlacement[index]} transition-transform duration-300 ease-out motion-safe:group-hover:-rotate-6`}
          />
        ))}
      </div>
      <p className="mt-3 font-display text-ui-lg text-navy">{title}</p>
      {text && <p className="mt-1 max-w-xs text-ui-sm text-text-secondary">{text}</p>}
      {actions && (
        <div className="mt-4 flex w-full max-w-xs flex-col items-stretch gap-2">{actions}</div>
      )}
    </div>
  );
}
