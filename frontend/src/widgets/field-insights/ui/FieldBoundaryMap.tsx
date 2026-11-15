import { latLngBounds } from 'leaflet';
import { MapContainer, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoJsonPolygon } from '@/entities/field';
import { useBasemap } from '@/shared/lib/basemap';
import { polygonPositions } from '@/shared/lib/geo';
import { BasemapLayer, BasemapToggle } from '@/shared/ui/basemap';

type FieldBoundaryMapProps = {
  boundary: GeoJsonPolygon;
  label: string;
};

export function FieldBoundaryMap({ boundary, label }: FieldBoundaryMapProps) {
  const positions = polygonPositions(boundary);
  const { effective } = useBasemap();

  if (!positions) {
    return (
      <div className="grid h-full min-h-48 place-items-center rounded-control bg-surface-muted p-4 text-center text-ui-sm text-text-secondary">
        Field boundary unavailable.
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={`Map of ${label}`}
      className="relative isolate h-full min-h-48 overflow-hidden rounded-card border border-border/60"
    >
      <MapContainer
        bounds={latLngBounds(positions.flat())}
        boundsOptions={{ padding: [28, 28], maxZoom: 16 }}
        scrollWheelZoom={false}
        className="h-full w-full"
      >
        <BasemapLayer />
        <Polygon
          positions={positions}
          interactive={false}
          pathOptions={
            effective === 'satellite'
              ? { color: '#f6f1ea', weight: 3, fillColor: '#357646', fillOpacity: 0.22 }
              : { color: '#24543a', weight: 2.5, fillColor: '#357646', fillOpacity: 0.18 }
          }
        />
      </MapContainer>
      <BasemapToggle size="sm" className="absolute right-2 top-2 z-[1000]" />
    </div>
  );
}
