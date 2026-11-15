import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BasemapStoreContext, basemapStorageKey, createBasemapStore } from '@/shared/lib/basemap';
import { BasemapLayer } from './BasemapLayer';
import { BasemapToggle } from './BasemapToggle';

type TileProps = { url: string; eventHandlers: Record<string, () => void> };
const tiles: TileProps[] = [];

vi.mock('react-leaflet', () => ({
  TileLayer: (props: TileProps) => {
    tiles.push(props);
    return <div data-testid="tile-layer" data-url={props.url} />;
  },
  useMap: () => ({
    _controlCorners: { bottomright: document.createElement('div') },
    on: () => undefined,
    off: () => undefined,
  }),
}));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(null, { status: 200 }))),
  );
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

function lastTile() {
  return tiles[tiles.length - 1];
}

function Overlay() {
  const mounted = vi.fn();
  useEffect(() => mounted(), [mounted]);
  return <div data-testid="overlay">polygon</div>;
}

function renderWith(store: ReturnType<typeof createBasemapStore>, children: ReactNode) {
  return render(
    <BasemapStoreContext.Provider value={store}>{children}</BasemapStoreContext.Provider>,
  );
}

describe('BasemapLayer', () => {
  it('shows satellite tiles and keeps them after successful loads and a single error', () => {
    const store = createBasemapStore('key', memoryStorage());
    renderWith(store, <BasemapLayer />);
    act(() => {
      for (let i = 0; i < 12; i += 1) lastTile().eventHandlers.tileload();
      lastTile().eventHandlers.tileerror();
    });
    expect(store.effective()).toBe('satellite');
    expect(screen.getByTestId('tile-layer').dataset.url).toContain('maptiler');
  });

  it('falls back to the street map when satellite tiles keep failing', () => {
    const store = createBasemapStore('key', memoryStorage());
    renderWith(
      store,
      <>
        <BasemapLayer />
        <BasemapToggle />
      </>,
    );
    act(() => {
      for (let i = 0; i < 4; i += 1) lastTile().eventHandlers.tileerror();
    });
    expect(screen.getByTestId('tile-layer').dataset.url).not.toContain('maptiler');
    expect(screen.getByText('Satellite imagery unavailable. Switched to map view.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Map' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('reports street map tile errors without switching layers', () => {
    const onMapTileError = vi.fn();
    const store = createBasemapStore('', memoryStorage());
    renderWith(store, <BasemapLayer onMapTileError={onMapTileError} />);
    act(() => lastTile().eventHandlers.tileerror());
    expect(onMapTileError).toHaveBeenCalledTimes(1);
  });

  it('replaces only the tile layer when switching, keeping overlays mounted', () => {
    const store = createBasemapStore('key', memoryStorage());
    renderWith(
      store,
      <>
        <BasemapLayer />
        <Overlay />
        <BasemapToggle />
      </>,
    );
    const overlay = screen.getByTestId('overlay');
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByTestId('overlay')).toBe(overlay);
    expect(screen.getByTestId('tile-layer').dataset.url).not.toContain('maptiler');
  });
});

describe('BasemapToggle', () => {
  it('disables Satellite with an explanation when no key is configured', () => {
    renderWith(createBasemapStore('', memoryStorage()), <BasemapToggle />);
    const satellite = screen.getByRole('button', { name: /Satellite/ });
    expect(satellite.hasAttribute('disabled')).toBe(true);
    expect(satellite.textContent).toContain('VITE_MAPTILER_API_KEY');
    expect(screen.getByRole('button', { name: 'Map' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shares and persists the choice across every map', () => {
    const storage = memoryStorage();
    const store = createBasemapStore('key', storage);
    renderWith(
      store,
      <>
        <BasemapToggle />
        <BasemapToggle size="sm" />
      </>,
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Map' })[0]);
    screen
      .getAllByRole('button', { name: 'Map' })
      .forEach((button) => expect(button.getAttribute('aria-pressed')).toBe('true'));
    expect(storage.data.get(basemapStorageKey)).toBe('map');
  });

  it('lets the user dismiss the fallback notice', () => {
    const store = createBasemapStore('key', memoryStorage());
    store.reportSatelliteFailure();
    renderWith(store, <BasemapToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notice' }));
    expect(screen.queryByText(/Satellite imagery unavailable/)).toBeNull();
  });
});
