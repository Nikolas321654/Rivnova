import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { defaultPanelWidth, maxPanelWidth, minPanelWidth, usePanelWidth } from './usePanelWidth';

describe('usePanelWidth', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts at the default width and keeps the chosen width within limits', () => {
    const { result } = renderHook(() => usePanelWidth());
    expect(result.current.width).toBe(defaultPanelWidth);

    act(() => result.current.resize(9999));
    expect(result.current.width).toBe(maxPanelWidth);
    act(() => result.current.resize(10));
    expect(result.current.width).toBe(minPanelWidth);
  });

  it('remembers the width and resets to the default', () => {
    const first = renderHook(() => usePanelWidth());
    act(() => first.result.current.resize(420));
    first.unmount();

    const second = renderHook(() => usePanelWidth());
    expect(second.result.current.width).toBe(420);
    act(() => second.result.current.reset());
    expect(second.result.current.width).toBe(defaultPanelWidth);
  });
});
