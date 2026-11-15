import { faChartLine, faFlask } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useState } from 'react';
import type { YieldPrediction } from '@/entities/field';
import { yieldView } from '../model/yield';
import { Button, Card, InfoTip } from '@/shared/ui';
import { Metric } from './Metric';

type YieldEstimateProps = {
  prediction: YieldPrediction | undefined;
  state: 'pending' | 'error' | 'success';
  simulated: boolean;
  onRetry: () => void;
};

const deltaCaption = {
  above: 'Above the regional average',
  below: 'Below the regional average',
  level: 'Same as the regional average',
} as const;

const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

export function YieldEstimate({ prediction, state, simulated, onRetry }: YieldEstimateProps) {
  const [showDetails, setShowDetails] = useState(false);

  if (state === 'pending') {
    return (
      <p role="status" className="text-ui-sm text-text-secondary">
        Loading yield estimate…
      </p>
    );
  }

  if (state === 'error' || !prediction) {
    return (
      <div role="alert" className="text-ui-sm text-text-secondary">
        <p>Yield estimate unavailable right now.</p>
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  const view = yieldView(prediction);
  if (!view) {
    return (
      <p role="status" className="text-ui-sm text-text-secondary">
        The model did not return a usable yield estimate for this field.
      </p>
    );
  }

  const features = prediction.featuresUsed as YieldPrediction['featuresUsed'] | undefined;
  const featureValue = (value: number | undefined) =>
    typeof value === 'number' && Number.isFinite(value) ? number.format(value) : 'n/a';

  return (
    <Card className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <p className="type-label">Predicted yield</p>
          <p className="mt-0.5 type-metric text-navy">
            {view.predicted}
            <span className="ml-1 text-ui-sm font-normal text-text-secondary">t/ha</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-badge border border-border bg-surface px-2.5 py-0.5 text-ui-xs font-medium text-text-secondary">
            <FontAwesomeIcon icon={faChartLine} aria-hidden="true" />
            Model estimate
          </span>
          {simulated && (
            <span className="inline-flex items-center gap-1.5 rounded-badge bg-status-neutral-bg px-2.5 py-0.5 text-ui-xs font-medium text-status-neutral">
              <FontAwesomeIcon icon={faFlask} aria-hidden="true" />
              Simulated inputs
            </span>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        <Metric
          label="Estimated harvest"
          value={view.harvest ?? 'n/a'}
          unit={view.harvest ? 't' : undefined}
          info="Predicted yield multiplied by the field area, as returned by the backend."
        />
        <Metric
          label="Regional baseline"
          value={view.baseline ?? 'n/a'}
          unit={view.baseline ? 't/ha' : undefined}
          info="National average yield for this crop in Ukraine, 2020 to 2024 (FAOSTAT)."
        />
        <div className="col-span-2 sm:col-span-1">
          <Metric
            label="Versus baseline"
            value={view.delta ?? 'n/a'}
            hint={view.deltaDirection ? deltaCaption[view.deltaDirection] : undefined}
          />
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ui-xs text-text-secondary">
        <span className="inline-flex items-center">
          Estimate, not a measured or guaranteed harvest
          <InfoTip
            label="the yield estimate"
            text="A machine learning model estimates end-of-season yield from the last 30 days of field signals. Unlike the satellite observations above, it is a prediction and can differ from the actual harvest."
          />
        </span>
        <button
          type="button"
          aria-expanded={showDetails}
          onClick={() => setShowDetails((value) => !value)}
          className="font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {showDetails ? 'Hide model details' : 'Show model details'}
        </button>
      </div>

      {showDetails && (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border/60 pt-3 sm:grid-cols-3">
          <Metric label="Model" value={prediction.modelName} />
          <Metric label="Crop" value={prediction.cropType} />
          <Metric
            label="Precipitation, 30 days"
            value={featureValue(features?.accumulatedPrecipMm30d)}
            unit="mm"
          />
          <Metric
            label="Avg rootzone moisture"
            value={featureValue(features?.avgRootzoneMoisture30d)}
          />
          <Metric label="Peak NDVI" value={featureValue(features?.peakNdvi30d)} />
          <Metric label="Water stress days" value={featureValue(features?.stressDaysCount30d)} />
        </dl>
      )}
    </Card>
  );
}
