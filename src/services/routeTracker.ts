import Geolocation from 'react-native-geolocation-service';

import {Coordinates} from '../types/checkIn';
import {uploadRoutePoint} from './backend';
import {saveLastKnownCoordinates} from './location';
import {ensurePermission} from './permissions';
import {getRouteSessionId, getSavedRoutePoints, saveRoutePoints} from './routeStore';

const MIN_ROUTE_DISTANCE_METERS = 1;
const MAX_NOISE_DISTANCE_METERS = 10;

type RouteTrackerSnapshot = {
  points: Coordinates[];
  status: string;
  isTracking: boolean;
};

type Listener = (snapshot: RouteTrackerSnapshot) => void;

let watchId: number | null = null;
let points: Coordinates[] = [];
let status = 'Waiting for location permission';
let hasHydrated = false;
const listeners = new Set<Listener>();

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
  const jitterLimit = Math.min(
    Math.max(accuracyMeters, MIN_ROUTE_DISTANCE_METERS),
    MAX_NOISE_DISTANCE_METERS,
  );

  return movedMeters >= jitterLimit;
}

function getSnapshot(): RouteTrackerSnapshot {
  return {
    points,
    status,
    isTracking: watchId !== null,
  };
}

function notify() {
  const snapshot = getSnapshot();
  listeners.forEach(listener => listener(snapshot));
}

async function hydrate() {
  if (hasHydrated) {
    return;
  }

  hasHydrated = true;
  points = await getSavedRoutePoints();
  status = watchId === null ? 'Ready to start tracking' : status;
  notify();
}

function savePoint(sessionId: string, nextPoint: Coordinates) {
  const previous = points[points.length - 1];
  if (!shouldSaveRoutePoint(previous, nextPoint)) {
    status = 'Waiting for movement';
    notify();
    return;
  }

  const pointToSave = {
    ...nextPoint,
    heading: nextPoint.heading ?? (previous ? bearingBetween(previous, nextPoint) : undefined),
  };

  status = 'Live tracking';
  points = [...points, pointToSave];
  notify();
  saveLastKnownCoordinates(pointToSave).catch(() => undefined);
  saveRoutePoints(points).catch(() => undefined);
  uploadRoutePoint(sessionId, pointToSave).catch(() => undefined);
}

export const routeTracker = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    listener(getSnapshot());

    hydrate().catch(() => {
      status = 'Unable to load saved route';
      notify();
    });

    return () => {
      listeners.delete(listener);
    };
  },

  async start() {
    await hydrate();

    if (watchId !== null) {
      status = 'Live tracking';
      notify();
      return;
    }

    const permission = await ensurePermission('location');
    if (!permission.granted) {
      status = permission.message;
      notify();
      return;
    }

    const sessionId = await getRouteSessionId();
    watchId = Geolocation.watchPosition(
      position => {
        const rawHeading =
          typeof position.coords.heading === 'number' && position.coords.heading >= 0
            ? position.coords.heading
            : undefined;
        savePoint(sessionId, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          heading: rawHeading,
          capturedAt: new Date(position.timestamp).toISOString(),
        });
      },
      error => {
        status = error.message;
        notify();
      },
      {
        enableHighAccuracy: true,
        distanceFilter: MIN_ROUTE_DISTANCE_METERS,
        interval: 7000,
        fastestInterval: 4000,
        showLocationDialog: true,
      },
    );

    status = 'Live tracking';
    notify();
  },

  stop() {
    if (watchId !== null) {
      Geolocation.clearWatch(watchId);
      watchId = null;
      status = 'Tracking paused';
      notify();
    }
  },
};
