import { describe, expect, it, vi } from 'vitest';
import { basemapStorageKey, createBasemapStore } from './basemapStore';
import { isBasemapFailing } from './tileHealth';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('basemap store', () => {
  it('selects Satellite on the first visit when MapTiler is configured', () => {
    const store = createBasemapStore('key', memoryStorage());
    expect(store.effective()).toBe('satellite');
    expect(store.source().url).toContain('api.maptiler.com/maps/hybrid');
    expect(store.source().url).toContain('key=key');
  });

  it('uses the street map without an API key and keeps Satellite unavailable', () => {
    const storage = memoryStorage({ [basemapStorageKey]: 'satellite' });
    const store = createBasemapStore('', storage);
    expect(store.effective()).toBe('map');
    expect(store.getState().satelliteAvailable).toBe(false);
    store.choose('satellite');
    expect(store.effective()).toBe('map');
    expect(store.source().url).not.toContain('maptiler');
  });

  it('persists an explicit Map choice for the next visit', () => {
    const storage = memoryStorage();
    createBasemapStore('key', storage).choose('map');
    expect(storage.data.get(basemapStorageKey)).toBe('map');
    expect(createBasemapStore('key', storage).effective()).toBe('map');
  });

  it('falls back for the session without overwriting a stored Satellite preference', () => {
    const storage = memoryStorage({ [basemapStorageKey]: 'satellite' });
    const store = createBasemapStore('key', storage);
    store.reportSatelliteFailure();
    expect(store.effective()).toBe('map');
    expect(store.getState().notice).toBe(true);
    expect(storage.data.get(basemapStorageKey)).toBe('satellite');
    expect(createBasemapStore('key', storage).effective()).toBe('satellite');
  });

  it('retries Satellite when the user picks it after a fallback', () => {
    const store = createBasemapStore('key', memoryStorage());
    store.reportSatelliteFailure();
    store.choose('satellite');
    expect(store.effective()).toBe('satellite');
    expect(store.getState()).toMatchObject({ fallback: false, notice: false });
  });

  it('ignores unknown stored values and unavailable storage', () => {
    expect(
      createBasemapStore('key', memoryStorage({ [basemapStorageKey]: 'terrain' })).effective(),
    ).toBe('satellite');
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    const store = createBasemapStore('key', broken);
    store.choose('map');
    expect(store.effective()).toBe('map');
  });
});

describe('isBasemapFailing', () => {
  it('ignores a single isolated tile error', () => {
    expect(isBasemapFailing({ loaded: 0, failed: 1 })).toBe(false);
    expect(isBasemapFailing({ loaded: 30, failed: 1 })).toBe(false);
  });

  it('detects tiles failing before any tile loads', () => {
    expect(isBasemapFailing({ loaded: 0, failed: 4 })).toBe(true);
  });

  it('detects failures outnumbering successes over a meaningful sample', () => {
    expect(isBasemapFailing({ loaded: 5, failed: 7 })).toBe(false);
    expect(isBasemapFailing({ loaded: 5, failed: 9 })).toBe(true);
  });
});

describe('verifySatellite', () => {
  const response = (status: number) => Promise.resolve(new Response(null, { status }));

  it('falls back once when MapTiler rejects the key', async () => {
    const store = createBasemapStore('bad-key', memoryStorage());
    const fetcher = vi.fn(() => response(403));
    await store.verifySatellite(fetcher as unknown as typeof fetch);
    await store.verifySatellite(fetcher as unknown as typeof fetch);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0])).toContain('/0/0/0.jpg?key=bad-key');
    expect(store.effective()).toBe('map');
  });

  it('checks the key again when the user retries Satellite', async () => {
    const store = createBasemapStore('bad-key', memoryStorage());
    const fetcher = vi.fn(() => response(403)) as unknown as typeof fetch;
    await store.verifySatellite(fetcher);
    store.choose('satellite');
    await store.verifySatellite(fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(store.effective()).toBe('map');
  });

  it('keeps Satellite for a valid key and leaves network errors to the tile counter', async () => {
    const ok = createBasemapStore('key', memoryStorage());
    await ok.verifySatellite((() => response(200)) as unknown as typeof fetch);
    expect(ok.effective()).toBe('satellite');

    const offline = createBasemapStore('key', memoryStorage());
    await offline.verifySatellite((() =>
      Promise.reject(new TypeError('offline'))) as unknown as typeof fetch);
    expect(offline.effective()).toBe('satellite');
  });
});
