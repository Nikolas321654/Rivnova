import { Control, DomUtil } from 'leaflet';
import { useEffect, useRef } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import { isBasemapFailing, useBasemap, type TileStats } from '@/shared/lib/basemap';

type BasemapLayerProps = {
  onMapTileError?: () => void;
};

function MapTilerLogo() {
  const map = useMap();

  useEffect(() => {
    const control = new Control({ position: 'bottomright' });
    control.onAdd = () => {
      const link = DomUtil.create('a', 'rivnova-maptiler-logo');
      link.href = 'https://www.maptiler.com/';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.style.display = 'block';
      link.style.lineHeight = '0';
      const logo = DomUtil.create('img', '', link);
      logo.src = 'https://api.maptiler.com/resources/logo.svg';
      logo.alt = 'MapTiler logo';
      logo.width = 67;
      logo.height = 20;
      return link;
    };
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map]);

  return null;
}

export function BasemapLayer({ onMapTileError }: BasemapLayerProps) {
  const { source, reportSatelliteFailure, verifySatellite } = useBasemap();
  const stats = useRef<TileStats>({ loaded: 0, failed: 0 });

  useEffect(() => {
    stats.current = { loaded: 0, failed: 0 };
    if (source.id === 'satellite') void verifySatellite();
  }, [source.id, verifySatellite]);

  return (
    <>
      <TileLayer
        key={source.id}
        url={source.url}
        attribution={source.attribution}
        maxZoom={source.maxZoom}
        maxNativeZoom={source.maxNativeZoom}
        eventHandlers={{
          tileload: () => {
            stats.current.loaded += 1;
          },
          tileerror: () => {
            if (source.id !== 'satellite') {
              onMapTileError?.();
              return;
            }
            stats.current.failed += 1;
            if (isBasemapFailing(stats.current)) reportSatelliteFailure();
          },
        }}
      />
      {source.id === 'satellite' && <MapTilerLogo />}
    </>
  );
}
