import { env } from '@/shared/config/env';

export type BasemapId = 'satellite' | 'map';

export type BasemapSource = {
  id: BasemapId;
  url: string;
  attribution: string;
  maxZoom: number;
  maxNativeZoom?: number;
};

const mapTilerAttribution =
  '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">&copy; MapTiler</a> ' +
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">&copy; OpenStreetMap contributors</a>';

export function satelliteSource(apiKey: string): BasemapSource {
  return {
    id: 'satellite',
    url: `https://api.maptiler.com/maps/hybrid/256/{z}/{x}/{y}.jpg?key=${encodeURIComponent(apiKey)}`,
    attribution: mapTilerAttribution,
    maxZoom: 20,
  };
}

export function streetMapSource(): BasemapSource {
  return {
    id: 'map',
    url: env.mapTileUrl,
    attribution: env.mapTileAttribution,
    maxZoom: 20,
    maxNativeZoom: 19,
  };
}

export function basemapSource(id: BasemapId, apiKey: string): BasemapSource {
  return id === 'satellite' && apiKey ? satelliteSource(apiKey) : streetMapSource();
}
