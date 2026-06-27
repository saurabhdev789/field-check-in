/* global jest */

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() =>
    Promise.resolve({isConnected: true, isInternetReachable: true}),
  ),
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('react-native-geolocation-service', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
}));

jest.mock('react-native-fs', () => ({
  readFile: jest.fn(() => Promise.resolve('base64-photo')),
}));

jest.mock('react-native-sqlite-storage', () => {
  const store = new Map();
  const db = {
    executeSql: jest.fn((sql, params = []) => {
      const normalized = sql.trim().toUpperCase();

      if (normalized.startsWith('SELECT')) {
        const value = store.get(params[0]);
        return Promise.resolve([
          {
            rows: {
              length: value === undefined ? 0 : 1,
              item: jest.fn(() => ({value})),
            },
          },
        ]);
      }

      if (normalized.startsWith('INSERT')) {
        store.set(params[0], params[1]);
      }

      if (normalized.startsWith('DELETE')) {
        store.delete(params[0]);
      }

      return Promise.resolve([{rows: {length: 0, item: jest.fn()}}]);
    }),
  };

  return {
    enablePromise: jest.fn(),
    openDatabase: jest.fn(() => Promise.resolve(db)),
  };
});

jest.mock('react-native-biometrics', () =>
  jest.fn().mockImplementation(() => ({
    isSensorAvailable: jest.fn(() => Promise.resolve({available: true})),
    simplePrompt: jest.fn(() => Promise.resolve({success: true})),
  })),
);

jest.mock('react-native-background-fetch', () => ({
  configure: jest.fn(() => Promise.resolve()),
  start: jest.fn(() => Promise.resolve()),
  finish: jest.fn(),
  NETWORK_TYPE_ANY: 0,
}));

jest.mock('react-native-permissions', () => ({
  check: jest.fn(() => Promise.resolve('granted')),
  request: jest.fn(() => Promise.resolve('granted')),
  openSettings: jest.fn(() => Promise.resolve()),
  PERMISSIONS: {
    ANDROID: {
      CAMERA: 'android.permission.CAMERA',
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    },
    IOS: {
      CAMERA: 'ios.permission.CAMERA',
      LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    LIMITED: 'limited',
    BLOCKED: 'blocked',
  },
}));

jest.mock('react-native-maps', () => {
  const React = require('react');
  const {View} = require('react-native');
  const MapView = props => React.createElement(View, props);
  return {
    __esModule: true,
    default: MapView,
    Marker: props => React.createElement(View, props),
    Polyline: props => React.createElement(View, props),
  };
});

jest.mock('@react-native-firebase/firestore', () => {
  const set = jest.fn(() => Promise.resolve());
  const doc = jest.fn(() => ({set}));
  const collection = jest.fn(() => ({doc}));
  const firestore = jest.fn(() => ({collection}));
  firestore.FieldValue = {
    serverTimestamp: jest.fn(() => 'server-timestamp'),
  };
  return firestore;
});
