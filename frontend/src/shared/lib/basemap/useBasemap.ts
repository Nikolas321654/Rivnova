import { createContext, useContext, useSyncExternalStore } from 'react';
import { basemapStore, type BasemapStore } from './basemapStore';

export const BasemapStoreContext = createContext<BasemapStore>(basemapStore);

export function useBasemap() {
  const store = useContext(BasemapStoreContext);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return {
    ...state,
    effective: store.effective(),
    source: store.source(),
    choose: store.choose,
    reportSatelliteFailure: store.reportSatelliteFailure,
    dismissNotice: store.dismissNotice,
    verifySatellite: store.verifySatellite,
  };
}
