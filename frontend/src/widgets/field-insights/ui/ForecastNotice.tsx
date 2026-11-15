import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import { formatObservationDate, type SoilForecast } from '@/entities/field';
import { ForecastDetails } from './ForecastDetails';
import { InfoTip } from '@/shared/ui';

type ForecastNoticeProps = {
  forecast: SoilForecast | undefined;
  state: 'pending' | 'error' | 'success';
  forecastStart: string | null;
  onRetry: () => void;
};

export function ForecastNotice({ forecast, state, forecastStart, onRetry }: ForecastNoticeProps) {
  const [showValues, setShowValues] = useState(false);

  if (state === 'pending') {
    return (
      <p role="status" className="text-ui-xs text-text-secondary">
        Loading forecast…
      </p>
    );
  }

  if (state === 'error' || !forecast) {
    return (
      <p role="alert" className="text-ui-xs text-text-secondary">
        Forecast unavailable.{' '}
        <button
          type="button"
          onClick={onRetry}
          className="font-medium text-primary hover:underline"
        >
          Retry
        </button>
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {forecast.proactive72hStressWarning && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-control bg-status-warning-bg px-3 py-2"
        >
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            className="mt-0.5 text-status-warning"
            aria-hidden="true"
          />
          <p className="text-ui-sm text-text-primary">
            <span className="font-semibold">72-hour water stress warning. </span>
            {forecast.proactiveRecommendation}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ui-xs text-text-secondary">
        <span className="inline-flex items-center">
          {forecastStart
            ? `Model forecast from ${formatObservationDate(forecastStart)}`
            : 'Model forecast'}
          <InfoTip
            label="the forecast"
            text={`7-day rootzone moisture from the ONNX soil model (${forecast.modelName}), starting after the last observation. Day 3 water deficit index ${forecast.forecastedDay3WaterDeficitIndex.toFixed(2)}. It is a model projection, not a weather forecast.`}
          />
        </span>
        <button
          type="button"
          aria-expanded={showValues}
          onClick={() => setShowValues((value) => !value)}
          className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {showValues ? 'Hide values' : 'Show values'}
        </button>
      </div>
      {showValues && <ForecastDetails forecast={forecast} />}
    </div>
  );
}
