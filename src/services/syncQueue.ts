import NetInfo from '@react-native-community/netinfo';

import {uploadCheckIn} from './backend';
import {queueStore} from './queueStore';

let isSyncing = false;

export async function syncQueue() {
  if (isSyncing) {
    return;
  }

  const network = await NetInfo.fetch();
  if (!network.isConnected || network.isInternetReachable !== true) {
    return;
  }

  isSyncing = true;
  queueStore.resetFailedToPending();

  const readyItems = queueStore
    .getItems()
    .filter(
      item =>
        item.status !== 'success' &&
        item.status !== 'uploading' &&
        item.nextAttemptAt <= Date.now(),
    )
    .slice(0, 5);

  for (const item of readyItems) {
    try {
      queueStore.markUploading(item.id);
      await uploadCheckIn(item);
      queueStore.markSuccess(item.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown upload error';
      queueStore.markFailure(item.id, message);
    }
  }

  isSyncing = false;
}

export function watchConnectivity() {
  return NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable === true) {
      syncQueue().catch(() => undefined);
    }
  });
}
