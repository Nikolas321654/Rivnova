import { formatObservationDate, type SoilForecast } from '@/entities/field';
import { Metric } from './Metric';

type ForecastDetailsProps = {
  forecast: SoilForecast;
};

export function ForecastDetails({ forecast }: ForecastDetailsProps) {
  const days = [...forecast.forecastSeries].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="grid gap-5">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Metric label="Model" value={forecast.modelName} />
        <Metric
          label="Day 3 water deficit index"
          value={forecast.forecastedDay3WaterDeficitIndex.toFixed(2)}
          tone={forecast.proactive72hStressWarning ? 'warning' : 'default'}
          hint={
            forecast.proactive72hStressWarning
              ? 'Above the alert threshold'
              : 'Below the alert threshold'
          }
        />
      </dl>
      {days.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-ui-sm tabular-nums">
            <caption className="sr-only">Predicted soil conditions for the next days</caption>
            <thead>
              <tr className="type-label">
                <th scope="col" className="py-1.5 pr-4 font-normal">
                  Date
                </th>
                <th scope="col" className="py-1.5 pr-4 font-normal">
                  Rootzone moisture
                </th>
                <th scope="col" className="py-1.5 pr-4 font-normal">
                  Evaporative stress
                </th>
                <th scope="col" className="py-1.5 font-normal">
                  Water deficit index
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date} className="border-t border-border/60">
                  <td className="py-1.5 pr-4">{formatObservationDate(day.date)}</td>
                  <td className="py-1.5 pr-4">{day.predictedRootzoneMoisture.toFixed(2)}</td>
                  <td className="py-1.5 pr-4">{day.predictedEsi.toFixed(2)}</td>
                  <td className="py-1.5">{day.predictedWaterDeficitIndex.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="type-label">The model returned no forecast days.</p>
      )}
      <p className="type-label">{forecast.proactiveRecommendation}</p>
    </div>
  );
}
