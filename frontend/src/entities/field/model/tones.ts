import {
  faChartLine,
  faCheck,
  faCircleExclamation,
  faCircleInfo,
  faDroplet,
  faMagnifyingGlass,
  faQuestion,
  faSprayCan,
  faTractor,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { AlertSeverity, ForecastStatus } from './types';
import type { FieldActionKind } from './actions';

export const severityTone: Record<
  AlertSeverity,
  { icon: typeof faCheck; text: string; bg: string; fill: string }
> = {
  Critical: {
    icon: faCircleExclamation,
    text: 'text-status-danger',
    bg: 'bg-status-danger-bg',
    fill: 'bg-status-danger',
  },
  Warning: {
    icon: faTriangleExclamation,
    text: 'text-status-warning',
    bg: 'bg-status-warning-bg',
    fill: 'bg-status-warning',
  },
  Info: {
    icon: faCircleInfo,
    text: 'text-status-neutral',
    bg: 'bg-status-neutral-bg',
    fill: 'bg-status-success',
  },
};

export const workabilityTone: Record<
  ForecastStatus,
  { icon: typeof faCheck; text: string; bg: string }
> = {
  Optimal: { icon: faCheck, text: 'text-status-success', bg: 'bg-status-success-bg' },
  Marginal: {
    icon: faTriangleExclamation,
    text: 'text-status-warning',
    bg: 'bg-status-warning-bg',
  },
  Blocked: { icon: faXmark, text: 'text-status-danger', bg: 'bg-status-danger-bg' },
  Unknown: { icon: faQuestion, text: 'text-status-neutral', bg: 'bg-status-neutral-bg' },
};

export const actionIcon: Record<FieldActionKind, typeof faCheck> = {
  irrigate: faDroplet,
  forecast: faChartLine,
  spray: faSprayCan,
  machinery: faTractor,
  scout: faMagnifyingGlass,
};
