import { InfoTip } from '@/shared/ui';

type MetricProps = {
  label: string;
  info?: string;
  active?: boolean;
  onHighlight?: (active: boolean) => void;
  value: string;
  unit?: string;
  hint?: string;
  tone?: 'default' | 'warning' | 'danger' | 'success';
};

const toneClass = {
  default: '',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
  success: 'text-status-success',
} as const;

export function Metric({
  label,
  value,
  unit,
  hint,
  tone = 'default',
  info,
  active,
  onHighlight,
}: MetricProps) {
  return (
    <div
      className={`-mx-2 min-w-0 rounded-control px-2 py-1 transition-colors duration-150 ${onHighlight ? 'hover:bg-surface-muted' : ''} ${active ? 'bg-surface-muted' : ''}`}
      onMouseEnter={onHighlight ? () => onHighlight(true) : undefined}
      onMouseLeave={onHighlight ? () => onHighlight(false) : undefined}
    >
      <dt className="flex items-center type-label">
        {label}
        {info && <InfoTip label={label} text={info} />}
      </dt>
      <dd className={`mt-0.5 text-ui-base type-value ${toneClass[tone]}`}>
        {value}
        {unit && <span className="ml-1 text-ui-xs font-normal text-text-secondary">{unit}</span>}
      </dd>
      {hint && <dd className="type-label">{hint}</dd>}
    </div>
  );
}
