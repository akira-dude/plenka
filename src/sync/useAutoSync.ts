import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { refreshSyncState, syncNow } from './engine';

export function useAutoSync(): void {
  const db = useSQLiteContext();

  useEffect(() => {
    void refreshSyncState(db).then(() => syncNow(db));

    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncNow(db);
    });

    let online = true;
    const unsubscribeNet = NetInfo.addEventListener((net) => {
      const now = Boolean(net.isConnected);
      if (now && !online) void syncNow(db);
      online = now;
    });

    return () => {
      appState.remove();
      unsubscribeNet();
    };
  }, [db]);
}
