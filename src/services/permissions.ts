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
    return {granted: true, message: `${kind} permission granted`};
  }

  if (result === RESULTS.BLOCKED) {
    return {granted: false, message: `${kind} permission blocked`};
  }

  return {granted: false, message: `${kind} permission not granted`};
}

export async function ensurePermission(kind: PermissionKind) {
  const permission = permissionFor(kind);
  const existing = await check(permission);

  if (existing === RESULTS.GRANTED || existing === RESULTS.LIMITED) {
    return {granted: true, message: `${kind} granted`};
  }

  if (existing === RESULTS.BLOCKED) {
    showSettingsDialog(kind);
    return {granted: false, message: `${kind} permanently denied. Open Settings to enable it.`};
  }

  const rationale = await showRationale(kind);
  if (!rationale) {
    return {granted: false, message: `${kind} permission rationale dismissed`};
  }

  const result = await request(permission);
  if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
    return {granted: true, message: `${kind} granted`};
  }

  if (result === RESULTS.BLOCKED) {
    showSettingsDialog(kind);
    return {granted: false, message: `${kind} permanently denied. Open Settings to enable it.`};
  }

  return {granted: false, message: `${kind} denied. You can try again when ready.`};
}

function showRationale(kind: PermissionKind) {
  return new Promise<boolean>(resolve => {
    Alert.alert(
      `${kind === 'camera' ? 'Camera' : 'Location'} permission needed`,
      kind === 'camera'
        ? 'A check-in needs a site photo so reviewers can verify the visit.'
        : 'A check-in needs GPS coordinates for auditability and route tracking.',
      [
        {text: 'Not now', style: 'cancel', onPress: () => resolve(false)},
        {text: 'Continue', onPress: () => resolve(true)},
      ],
    );
  });
}

function showSettingsDialog(kind: PermissionKind) {
  Alert.alert(
    `${kind === 'camera' ? 'Camera' : 'Location'} blocked`,
    'Permission is permanently denied. Open Settings and enable it to continue.',
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
