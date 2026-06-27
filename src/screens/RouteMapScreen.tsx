import React, {useEffect, useRef, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import MapView, {Marker, Polyline, Region} from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';

import {ensurePermission, getPermissionState} from '../services/permissions';
import {saveLastKnownCoordinates} from '../services/location';
import {uploadRoutePoint} from '../services/backend';
import {Coordinates} from '../types/checkIn';
import {
  getRouteSessionId,
  getSavedRoutePoints,
  saveRoutePoints,
} from '../services/routeStore';

const initialRegion: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};
const MIN_ROUTE_DISTANCE_METERS = 1;
const MAX_NOISE_DISTANCE_METERS = 10;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function toDegrees(value: number) {
  return (value * 180) / Math.PI;
}

function bearingBetween(from: Coordinates, to: Coordinates) {
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function distanceBetween(from: Coordinates, to: Coordinates) {
  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) *
      Math.cos(toLat) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function shouldSaveRoutePoint(previous: Coordinates | undefined, next: Coordinates) {
  if (!previous) {
    return true;
  }

  const movedMeters = distanceBetween(previous, next);
  const accuracyMeters = next.accuracy ?? 0;
  const jitterLimit = Math.min(Math.max(accuracyMeters, MIN_ROUTE_DISTANCE_METERS), MAX_NOISE_DISTANCE_METERS);

  return movedMeters >= jitterLimit;
}

function formatDirection(heading?: number) {
  if (heading === undefined) {
    return 'Direction pending';
  }

  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(heading / 45) % labels.length;
  return `${labels[index]} ${Math.round(heading)}°`;
}

export default function RouteMapScreen() {
  const [points, setPoints] = useState<Coordinates[]>([]);
  const [status, setStatus] = useState('Waiting for location permission');
  const [watchId, setWatchId] = useState<number | null>(null);
  const pointsRef = useRef<Coordinates[]>([]);

  useEffect(() => {
    let isMounted = true;

    getSavedRoutePoints()
      .then(savedPoints => {
        if (!isMounted || savedPoints.length === 0) {
          return;
        }

        pointsRef.current = savedPoints;
        setPoints(savedPoints);
      })
      .catch(() => undefined);

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
    const sessionId = await getRouteSessionId();
    const permission = await ensurePermission('location');
    if (!permission.granted) {
      setStatus(permission.message);
      return;
    }

    const id = Geolocation.watchPosition(
      position => {
        const rawHeading =
          typeof position.coords.heading === 'number' && position.coords.heading >= 0
            ? position.coords.heading
            : undefined;
        const nextPoint: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: rawHeading,
          capturedAt: new Date(position.timestamp).toISOString(),
        };
        const previous = pointsRef.current[pointsRef.current.length - 1];
        if (!shouldSaveRoutePoint(previous, nextPoint)) {
          setStatus('Waiting for movement');
          return;
        }

        const pointToSave = {
          ...nextPoint,
          heading: nextPoint.heading ?? (previous ? bearingBetween(previous, nextPoint) : undefined),
        };

        setStatus('Live tracking');
        pointsRef.current = [...pointsRef.current, pointToSave];
        setPoints(pointsRef.current);
        saveLastKnownCoordinates(pointToSave).catch(() => undefined);
        saveRoutePoints(pointsRef.current).catch(() => undefined);
        uploadRoutePoint(sessionId, pointToSave).catch(() => undefined);
      },
      error => setStatus(error.message),
      {
        enableHighAccuracy: true,
        distanceFilter: 1,
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
  const directionLabel = formatDirection(latest?.heading);
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
        {latest ? (
          <Marker
            coordinate={latest}
            rotation={latest.heading}
            title="Current location"
            description={directionLabel}
          />
        ) : null}
        {points.length > 1 ? (
          <Polyline coordinates={points} strokeColor="#1d6f61" strokeWidth={5} />
        ) : null}
      </MapView>
      <View style={styles.controls}>
        <View>
          <Text style={styles.status}>{status}</Text>
          <Text style={styles.meta}>{points.length} route points captured</Text>
          <Text style={styles.meta}>{directionLabel}</Text>
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
