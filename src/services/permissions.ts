import {Alert, Linking, Platform} from 'react-native';
import {
  check,
  openSettings,
  PERMISSIONS,
  request,
  RESULTS,
} from 'react-native-permissions';

type PermissionKind = 'camera' | 'location';

const androidPermission = {
  camera: PERMISSIONS.ANDROID.CAMERA,
  location: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
};

const iosPermission = {
  camera: PERMISSIONS.IOS.CAMERA,
  location: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
};

function permissionFor(kind: PermissionKind) {
  return Platform.OS === 'android' ? androidPermission[kind] : iosPermission[kind];
}

export async function getPermissionState(kind: PermissionKind) {
  const result = await check(permissionFor(kind));

  if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
    return {granted: true, message: `${labelFor(kind)} allowed`};
  }

  if (result === RESULTS.BLOCKED) {
    return {granted: false, message: 'Allow in Settings'};
  }

  return {granted: false, message: `Please allow ${labelFor(kind).toLowerCase()}`};
}

export async function ensurePermission(kind: PermissionKind) {
  const permission = permissionFor(kind);
  const existing = await check(permission);

  if (existing === RESULTS.GRANTED || existing === RESULTS.LIMITED) {
    return {granted: true, message: `${labelFor(kind)} allowed`};
  }

  if (existing === RESULTS.BLOCKED) {
    showSettingsDialog(kind);
    return {granted: false, message: 'Allow in Settings'};
  }

  const rationale = await showRationale(kind);
  if (!rationale) {
    return {granted: false, message: `Please allow ${labelFor(kind).toLowerCase()}`};
  }

  const result = await request(permission);
  if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
    return {granted: true, message: `${labelFor(kind)} allowed`};
  }

  if (result === RESULTS.BLOCKED) {
    showSettingsDialog(kind);
    return {granted: false, message: 'Allow in Settings'};
  }

  return {granted: false, message: `Please allow ${labelFor(kind).toLowerCase()}`};
}

function labelFor(kind: PermissionKind) {
  return kind === 'camera' ? 'Camera' : 'Location';
}

function showRationale(kind: PermissionKind) {
  return new Promise<boolean>(resolve => {
    Alert.alert(
      `Allow ${labelFor(kind)}`,
      kind === 'camera'
        ? 'The app needs camera access for check-in photos.'
        : 'The app needs location access for check-ins and routes.',
      [
        {text: 'Not now', style: 'cancel', onPress: () => resolve(false)},
        {text: 'Continue', onPress: () => resolve(true)},
      ],
    );
  });
}

function showSettingsDialog(kind: PermissionKind) {
  Alert.alert(
    `Allow ${labelFor(kind)} in Settings`,
    `Open Settings, then turn on ${labelFor(kind).toLowerCase()} access.`,
    [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Open Settings',
        onPress: () => {
          openSettings().catch(() => Linking.openSettings());
        },
      },
    ],
  );
}
