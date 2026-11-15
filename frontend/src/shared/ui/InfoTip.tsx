import { faCircleInfo } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type InfoTipProps = {
  label: string;
  text: string;
  align?: 'center' | 'end';
};

type Position = { top: number; left: number; width: number };

const tipWidth = 256;
const gap = 6;
const edge = 16;

export function InfoTip({ label, text, align = 'center' }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const anchor = buttonRef.current.getBoundingClientRect();
    const width = Math.min(tipWidth, window.innerWidth - edge * 2);
    const preferred =
      align === 'end' ? anchor.right - width : anchor.left + anchor.width / 2 - width / 2;
    const left = Math.min(Math.max(preferred, edge), window.innerWidth - edge - width);
    const height = tipRef.current?.offsetHeight ?? 0;
    const below = anchor.bottom + gap;
    const top =
      below + height > window.innerHeight - edge && anchor.top - gap - height > edge
        ? anchor.top - gap - height
        : below;
    setPosition((current) =>
      current && current.top === top && current.left === left && current.width === width
        ? current
        : { top, left, width },
    );
  }, [open, align, text]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <span className="relative inline-flex align-middle">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${label}`}
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        className="ml-1 grid size-5 place-items-center rounded-full text-ui-xs text-text-secondary/70 transition-colors duration-150 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
      >
        <FontAwesomeIcon icon={faCircleInfo} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <span
            ref={tipRef}
            id={tipId}
            role="tooltip"
            style={{
              top: position?.top ?? 0,
              left: position?.left ?? 0,
              width: position?.width ?? tipWidth,
              visibility: position ? 'visible' : 'hidden',
            }}
            className="pointer-events-none fixed z-[1100] rounded-control border border-border bg-surface px-3 py-2 text-left text-ui-xs font-normal normal-case leading-snug tracking-normal text-text-primary shadow-lg"
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
