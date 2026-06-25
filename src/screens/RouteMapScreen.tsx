import React, {useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import MapView, {Marker, Polyline, Region} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';

import {ensurePermission, getPermissionState} from '../services/permissions';
import {saveLastKnownCoordinates} from '../services/location';
import {Coordinates} from '../types/checkIn';

const initialRegion: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

export default function RouteMapScreen() {
  const [points, setPoints] = useState<Coordinates[]>([]);
  const [status, setStatus] = useState('Waiting for location permission');
  const [watchId, setWatchId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    getPermissionState('location')
      .then(permission => {
        if (!isMounted) {
          return;
        }

        setStatus(
          permission.granted
            ? 'Ready to start tracking'
            : 'Location permission not granted',
        );
      })
      .catch(() => {
        if (isMounted) {
          setStatus('Unable to check location permission');
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  async function startTracking() {
    const permission = await ensurePermission('location');
    if (!permission.granted) {
      setStatus(permission.message);
      return;
    }

    const id = Geolocation.watchPosition(
      position => {
        const nextPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        };

        setStatus('Live tracking');
        saveLastKnownCoordinates(nextPoint).catch(() => undefined);
        setPoints(current => [...current, nextPoint]);
      },
      error => setStatus(error.message),
      {
        enableHighAccuracy: true,
        distanceFilter: 2,
        interval: 7000,
        fastestInterval: 4000,
        showLocationDialog: true,
      },
    );

    setWatchId(id);
  }

  function stopTracking() {
    if (watchId !== null) {
      Geolocation.clearWatch(watchId);
      setWatchId(null);
      setStatus('Tracking paused');
    }
  }

  const latest = points[points.length - 1];
  const region = latest
    ? {
        latitude: latest.latitude,
        longitude: latest.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }
    : initialRegion;

  return (
    <View style={styles.container}>
      <MapView style={styles.map} region={region} showsUserLocation>
        {latest ? <Marker coordinate={latest} title="Current location" /> : null}
        {points.length > 1 ? (
          <Polyline coordinates={points} strokeColor="#1d6f61" strokeWidth={5} />
        ) : null}
      </MapView>
      <View style={styles.controls}>
        <View>
          <Text style={styles.status}>{status}</Text>
          <Text style={styles.meta}>{points.length} route points captured</Text>
        </View>
        <Pressable
          style={watchId === null ? styles.startButton : styles.stopButton}
          onPress={watchId === null ? startTracking : stopTracking}>
          <Text style={styles.buttonText}>{watchId === null ? 'Start' : 'Stop'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7f8',
  },
  map: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#dce5e1',
  },
  status: {
    color: '#14322e',
    fontSize: 17,
    fontWeight: '800',
  },
  meta: {
    color: '#60736d',
    marginTop: 2,
  },
  startButton: {
    backgroundColor: '#1d6f61',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  stopButton: {
    backgroundColor: '#c33d2f',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
