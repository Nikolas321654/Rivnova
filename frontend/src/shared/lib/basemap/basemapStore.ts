import { env } from '@/shared/config/env';
import { basemapSource, satelliteSource, type BasemapId, type BasemapSource } from './basemaps';

export type BasemapState = {
  preferred: BasemapId;
  fallback: boolean;
  notice: boolean;
  satelliteAvailable: boolean;
};

export const basemapStorageKey = 'rivnova.basemap';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function safeStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readStored(storage: StorageLike | null): BasemapId | null {
  try {
    const value = storage?.getItem(basemapStorageKey);
    return value === 'satellite' || value === 'map' ? value : null;
  } catch {
    return null;
  }
}

function writeStored(storage: StorageLike | null, id: BasemapId): boolean {
  try {
    storage?.setItem(basemapStorageKey, id);
    return true;
  } catch {
    return false;
  }
}

export function createBasemapStore(apiKey: string, storage: StorageLike | null = safeStorage()) {
  const satelliteAvailable = apiKey.length > 0;
  let state: BasemapState = {
    preferred: readStored(storage) ?? (satelliteAvailable ? 'satellite' : 'map'),
    fallback: false,
    notice: false,
    satelliteAvailable,
  };
  const listeners = new Set<() => void>();
  let verified = false;

  const effective = (): BasemapId =>
    state.satelliteAvailable && state.preferred === 'satellite' && !state.fallback
      ? 'satellite'
      : 'map';

  const set = (next: Partial<BasemapState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };

  const store = {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    effective,
    source: (): BasemapSource => basemapSource(effective(), apiKey),
    choose(id: BasemapId) {
      if (id === 'satellite' && !state.satelliteAvailable) return;
      writeStored(storage, id);
      if (id === 'satellite') verified = false;
      set({ preferred: id, fallback: false, notice: false });
    },
    reportSatelliteFailure() {
      if (state.fallback) return;
      set({ fallback: true, notice: true });
    },
    dismissNotice() {
      if (state.notice) set({ notice: false });
    },
    async verifySatellite(fetcher: typeof fetch = fetch) {
      if (verified || !state.satelliteAvailable) return;
      verified = true;
      try {
        const response = await fetcher(
          satelliteSource(apiKey).url.replace('{z}/{x}/{y}', '0/0/0'),
          { method: 'GET', cache: 'no-store' },
        );
        if (response.status === 401 || response.status === 403) store.reportSatelliteFailure();
      } catch {
        return;
      }
    },
  };
  return store;
}

export type BasemapStore = ReturnType<typeof createBasemapStore>;

export const basemapStore = createBasemapStore(env.mapTilerApiKey);
