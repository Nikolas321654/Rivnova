import { useCallback, useEffect, useState } from 'react';

export const defaultPanelWidth = 304;
export const minPanelWidth = 304;
export const maxPanelWidth = 640;

const storageKey = 'rivnova.fieldPanelWidth';

function clamp(width: number): number {
  return Math.round(Math.min(Math.max(width, minPanelWidth), maxPanelWidth));
}

function readStoredWidth(): number {
  try {
    const stored = Number(window.localStorage.getItem(storageKey));
    return Number.isFinite(stored) && stored > 0 ? clamp(stored) : defaultPanelWidth;
  } catch {
    return defaultPanelWidth;
  }
}

export function usePanelWidth() {
  const [width, setWidth] = useState(readStoredWidth);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(width));
    } catch {
      return;
    }
  }, [width]);

  const resize = useCallback((next: number) => setWidth(clamp(next)), []);
  const reset = useCallback(() => setWidth(defaultPanelWidth), []);

  return { width, resize, reset };
}
