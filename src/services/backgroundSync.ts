import BackgroundFetch from 'react-native-background-fetch';
import {syncQueue} from './syncQueue';

export async function initBackgroundSync() {
  await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
    },
    async taskId => {
      await syncQueue();
      BackgroundFetch.finish(taskId);
    },
    taskId => {
      BackgroundFetch.finish(taskId);
    },
  );

  await BackgroundFetch.start();
}
