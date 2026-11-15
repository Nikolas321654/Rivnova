import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

type ResizeHandleProps = {
  label: string;
  controls: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onReset: () => void;
  className?: string;
};

const keyboardStep = 24;

export function ResizeHandle({
  label,
  controls,
  value,
  min,
  max,
  onChange,
  onReset,
  className = '',
}: ResizeHandleProps) {
  const drag = useRef<{ startX: number; startValue: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startX: event.clientX, startValue: value };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    onChange(drag.current.startValue + (drag.current.startX - event.clientX));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next =
      event.key === 'ArrowLeft'
        ? value + keyboardStep
        : event.key === 'ArrowRight'
          ? value - keyboardStep
          : event.key === 'Home'
            ? max
            : event.key === 'End'
              ? min
              : null;
    if (next === null) return;
    event.preventDefault();
    onChange(next);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={controls}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title="Drag to resize, double-click to reset"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={`group touch-none cursor-col-resize select-none focus-visible:outline-none ${className}`}
    >
      <span className="mx-auto block h-full w-0.5 rounded-full bg-transparent transition-colors duration-150 group-hover:bg-primary/40 group-focus-visible:bg-primary group-active:bg-primary motion-reduce:transition-none" />
    </div>
  );
}
