import { faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useEffect } from 'react';
import { useBasemap, type BasemapId } from '@/shared/lib/basemap';

type BasemapToggleProps = {
  size?: 'md' | 'sm';
  className?: string;
};

const options: { id: BasemapId; label: string }[] = [
  { id: 'satellite', label: 'Satellite' },
  { id: 'map', label: 'Map' },
];

const noticeDurationMs = 6000;
const unavailableHint = 'Satellite imagery needs a MapTiler key (VITE_MAPTILER_API_KEY).';

export function BasemapToggle({ size = 'md', className = '' }: BasemapToggleProps) {
  const { effective, satelliteAvailable, notice, choose, dismissNotice } = useBasemap();

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(dismissNotice, noticeDurationMs);
    return () => window.clearTimeout(timer);
  }, [notice, dismissNotice]);

  return (
    <div className={`flex flex-col items-end gap-1.5 ${className}`}>
      <div
        role="group"
        aria-label="Basemap"
        className="flex rounded-control border border-border bg-surface p-0.5 shadow-sm"
      >
        {options.map((option) => {
          const disabled = option.id === 'satellite' && !satelliteAvailable;
          const selected = effective === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              title={disabled ? unavailableHint : undefined}
              onClick={() => choose(option.id)}
              className={`rounded-[calc(var(--radius-control)-2px)] font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none ${size === 'sm' ? 'min-h-7 px-2 text-ui-xs' : 'min-h-9 px-3 text-ui-sm'} ${selected ? 'bg-selection text-primary' : 'text-text-secondary enabled:hover:bg-surface-muted enabled:hover:text-text-primary'}`}
            >
              {option.label}
              {disabled && <span className="sr-only">, unavailable. {unavailableHint}</span>}
            </button>
          );
        })}
      </div>
      {notice && (
        <p
          role="status"
          className="flex max-w-64 items-start gap-2 rounded-control border border-border bg-surface px-2.5 py-1.5 text-ui-xs text-text-primary shadow-sm"
        >
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="mt-0.5 text-status-warning"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1">
            Satellite imagery unavailable. Switched to map view.
          </span>
          <button
            type="button"
            onClick={dismissNotice}
            aria-label="Dismiss notice"
            className="grid size-4 place-items-center rounded text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-primary"
          >
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          </button>
        </p>
      )}
    </div>
  );
}
