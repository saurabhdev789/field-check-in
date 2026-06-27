import React, {useEffect, useMemo, useState} from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {launchCamera, Asset} from 'react-native-image-picker';
import NetInfo from '@react-native-community/netinfo';

import {RootStackParamList} from '../../App';
import {setupBiometrics} from '../services/biometrics';
import {ensurePermission} from '../services/permissions';
import {getCurrentCoordinates} from '../services/location';
import {getAgentId} from '../services/agentIdentity';
import {queueStore} from '../services/queueStore';
import {syncQueue, watchConnectivity} from '../services/syncQueue';
import {CheckInItem, PermissionUiState} from '../types/checkIn';

type Props = NativeStackScreenProps<RootStackParamList, 'CheckIn'>;

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openLocationSettings() {
  if (Platform.OS === 'android') {
    Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() =>
      Linking.openSettings(),
    );
    return;
  }

  Linking.openSettings();
}

function showLocationRequiredDialog() {
  Alert.alert(
    'Turn on Location',
    'Please turn on phone Location/GPS, then try check-in again.',
    [
      {text: 'Not now', style: 'cancel'},
      {text: 'Open Settings', onPress: openLocationSettings},
    ],
  );
}

export default function CheckInScreen({navigation}: Props) {
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<Asset>();
  const [items, setItems] = useState<CheckInItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionUiState>({
    camera: 'Not checked',
    location: 'Not checked',
  });
  const [networkLabel, setNetworkLabel] = useState('Checking network');
  const [agentId, setAgentId] = useState('Loading agent...');
  const [biometricLabel, setBiometricLabel] = useState('Not set up');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribeQueue = queueStore.subscribe(setItems);
    const unsubscribeNetwork = NetInfo.addEventListener(state => {
      setNetworkLabel(
        state.isConnected && state.isInternetReachable === true ? 'Online' : 'Offline',
      );
    });
    const unsubscribeWatch = watchConnectivity();
    getAgentId().then(setAgentId).catch(() => setAgentId('Agent unavailable'));
    ensurePermission('location')
      .then(result =>
        setPermissions(current => ({...current, location: result.message})),
      )
      .catch(() =>
        setPermissions(current => ({...current, location: 'Location not allowed'})),
      );
    syncQueue().catch(() => undefined);

    return () => {
      unsubscribeQueue();
      unsubscribeNetwork();
      unsubscribeWatch();
    };
  }, []);

  const queueSummary = useMemo(() => {
    const pending = items.filter(item => item.status === 'pending').length;
    const uploading = items.filter(item => item.status === 'uploading').length;
    const failed = items.filter(item => item.status === 'failed').length;
    const success = items.filter(item => item.status === 'success').length;
    return {pending, uploading, failed, success};
  }, [items]);

  async function handleBiometrics() {
    const result = await setupBiometrics();
    setBiometricLabel(result.message);
  }

  async function handleCamera() {
    const result = await ensurePermission('camera');
    setPermissions(current => ({...current, camera: result.message}));

    if (!result.granted) {
      return;
    }

    const cameraResult = await launchCamera({
      mediaType: 'photo',
      cameraType: 'front',
      quality: 0.3,
      maxWidth: 640,
      maxHeight: 640,
      saveToPhotos: false,
    });

    if (cameraResult.didCancel) {
      return;
    }

    if (cameraResult.errorMessage) {
      Alert.alert('Camera error', cameraResult.errorMessage);
      return;
    }

    setPhoto(cameraResult.assets?.[0]);
  }

  async function submitCheckIn() {
    if (!photo?.uri) {
      Alert.alert('Photo required', 'Capture a field photo before submitting.');
      return;
    }

    if (!note.trim()) {
      Alert.alert('Note required', 'Add a short note before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const locationPermission = await ensurePermission('location');
      setPermissions(current => ({...current, location: locationPermission.message}));

      if (!locationPermission.granted) {
        return;
      }

      let location;
      try {
        location = await getCurrentCoordinates({
          allowCachedFallback: false,
          requireFresh: true,
        });
      } catch {
        setPermissions(current => ({...current, location: 'Turn on Location/GPS'}));
        showLocationRequiredDialog();
        return;
      }

      const currentAgentId = await getAgentId();
      const now = new Date().toISOString();
      const checkIn: CheckInItem = {
        id: createId(),
        agentId: currentAgentId,
        note: note.trim(),
        photoUri: photo.uri,
        photoFileName: photo.fileName,
        photoType: photo.type,
        location,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        attempts: 0,
        nextAttemptAt: 0,
        auditTrail: [
          {type: 'created', at: now},
          {type: 'queued', at: now, message: 'Stored locally before upload'},
        ],
      };

      await queueStore.enqueue(checkIn);
      setNote('');
      setPhoto(undefined);
      syncQueue().catch(() => undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create check-in';
      Alert.alert('Check-in failed', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.agentStatus}>
          <Text style={styles.kicker}>Agent status</Text>
          <Text style={styles.network}>{networkLabel}</Text>
          <Text style={styles.agentId} numberOfLines={1} ellipsizeMode="middle">
            {agentId}
          </Text>
        </View>
        <Pressable
          style={[styles.secondaryButton, styles.routeButton]}
          onPress={() => navigation.navigate('RouteMap')}>
          <Text style={styles.secondaryButtonText}>Route Map</Text>
        </Pressable>
      </View>

      <View style={styles.panel}>
        <Text style={styles.heading}>New check-in</Text>
        <TextInput
          style={styles.input}
          placeholder="Short note"
          placeholderTextColor="#6d7d78"
          multiline
          value={note}
          onChangeText={setNote}
        />

        {photo?.uri ? (
          <Image source={{uri: photo.uri}} style={styles.preview} />
        ) : (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyPreviewText}>No photo captured</Text>
          </View>
        )}

        <View style={styles.buttonRow}>
          <Pressable style={styles.secondaryButton} onPress={handleCamera}>
            <Text style={styles.secondaryButtonText}>Camera</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={handleBiometrics}>
            <Text style={styles.secondaryButtonText}>Biometric</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.primaryButton, isSubmitting && styles.disabled]}
          onPress={submitCheckIn}
          disabled={isSubmitting}>
          <Text style={styles.primaryButtonText}>
            {isSubmitting ? 'Saving...' : 'Submit Check-In'}
          </Text>
        </Pressable>

        <View style={styles.permissionGrid}>
          <Text style={styles.meta}>Camera: {permissions.camera}</Text>
          <Text style={styles.meta}>Location: {permissions.location}</Text>
          <Text style={styles.meta}>Biometric: {biometricLabel}</Text>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.queueHeader}>
          <Text style={styles.heading}>Upload queue</Text>
          <Pressable style={styles.syncButton} onPress={syncQueue}>
            <Text style={styles.syncButtonText}>Sync</Text>
          </Pressable>
        </View>
        <View style={styles.stats}>
          <Text style={styles.stat}>Pending {queueSummary.pending}</Text>
          <Text style={styles.stat}>Uploading {queueSummary.uploading}</Text>
          <Text style={styles.stat}>Success {queueSummary.success}</Text>
          <Text style={styles.stat}>Failed {queueSummary.failed}</Text>
        </View>

        <FlatList
          data={items}
          scrollEnabled={false}
          keyExtractor={item => item.id}
          ListEmptyComponent={<Text style={styles.emptyText}>No queued check-ins yet.</Text>}
          renderItem={({item}) => (
            <View style={styles.queueItem}>
              <View style={[styles.statusDot, styles[item.status]]} />
              <View style={styles.queueBody}>
                <Text style={styles.queueTitle}>{item.status.toUpperCase()}</Text>
                <Text style={styles.queueText} numberOfLines={2}>
                  {item.note || 'No note'} | {item.location.latitude.toFixed(5)},{' '}
                  {item.location.longitude.toFixed(5)}
                </Text>
                <Text style={styles.queueMeta}>
                  Attempts {item.attempts}
                  {item.lastError ? ` | ${item.lastError}` : ''}
                </Text>
              </View>
            </View>
          )}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 16,
    backgroundColor: '#f5f7f8',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  agentStatus: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: '#60736d',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  network: {
    color: '#14322e',
    fontSize: 26,
    fontWeight: '800',
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dce5e1',
    gap: 12,
  },
  heading: {
    color: '#14322e',
    fontSize: 19,
    fontWeight: '800',
  },
  input: {
    borderColor: '#c9d8d2',
    borderWidth: 1,
    borderRadius: 8,
    color: '#173a35',
    minHeight: 88,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 16,
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: 8,
    backgroundColor: '#e8eeee',
  },
  emptyPreview: {
    height: 160,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d7e2de',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eef3f1',
  },
  emptyPreviewText: {
    color: '#6d7d78',
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#1d6f61',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#e5eeea',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  routeButton: {
    flexShrink: 0,
  },
  secondaryButtonText: {
    color: '#1d6f61',
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.55,
  },
  permissionGrid: {
    gap: 5,
  },
  meta: {
    color: '#4f625d',
    fontSize: 13,
  },
  agentId: {
    color: '#4f625d',
    fontSize: 12,
    maxWidth: '100%',
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#173a35',
  },
  syncButtonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stat: {
    backgroundColor: '#eef3f1',
    color: '#314b45',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontWeight: '700',
  },
  emptyText: {
    color: '#6d7d78',
    paddingVertical: 12,
  },
  queueItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#edf2f0',
  },
  statusDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    marginTop: 4,
  },
  pending: {
    backgroundColor: '#c39028',
  },
  uploading: {
    backgroundColor: '#2f73d9',
  },
  success: {
    backgroundColor: '#1d6f61',
  },
  failed: {
    backgroundColor: '#c33d2f',
  },
  queueBody: {
    flex: 1,
  },
  queueTitle: {
    color: '#14322e',
    fontWeight: '800',
  },
  queueText: {
    color: '#314b45',
  },
  queueMeta: {
    color: '#6d7d78',
    fontSize: 12,
    marginTop: 2,
  },
});
