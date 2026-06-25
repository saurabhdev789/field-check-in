import ReactNativeBiometrics from 'react-native-biometrics';

const rnBiometrics = new ReactNativeBiometrics({
  allowDeviceCredentials: true,
});

export async function setupBiometrics() {
  const availability = await rnBiometrics.isSensorAvailable();
  if (!availability.available) {
    return {ok: false, message: availability.error ?? 'Biometrics unavailable'};
  }

  const result = await rnBiometrics.simplePrompt({
    promptMessage: 'Confirm identity to enable field check-ins',
    cancelButtonText: 'Cancel',
  });

  return {
    ok: result.success,
    message: result.success ? 'Biometric authentication enabled' : 'Biometric setup cancelled',
  };
}
