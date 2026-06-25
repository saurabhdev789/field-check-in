import Geolocation from 'react-native-geolocation-service';
import {Coordinates} from '../types/checkIn';
import {localStorage} from './localStorage';

const LAST_KNOWN_LOCATION_KEY = 'field-check-in.last-known-location.v1';

type LocationOptions = Parameters<typeof Geolocation.getCurrentPosition>[2];

function toCoordinates(position: {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
    heading?: number | null;
  };
  timestamp: number;
}): Coordinates {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading:
      typeof position.coords.heading === 'number' && position.coords.heading >= 0
        ? position.coords.heading
        : undefined,
    capturedAt: new Date(position.timestamp).toISOString(),
  };
}

function requestCoordinates(options: LocationOptions): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      async position => {
        const coordinates = toCoordinates(position);
        await saveLastKnownCoordinates(coordinates);
        resolve(coordinates);
      },
      reject,
      options,
    );
  });
}

export async function saveLastKnownCoordinates(coordinates: Coordinates) {
  localStorage.set(LAST_KNOWN_LOCATION_KEY, JSON.stringify(coordinates));
}

export async function getLastKnownCoordinates() {
  const raw = localStorage.getString(LAST_KNOWN_LOCATION_KEY);
  return raw ? (JSON.parse(raw) as Coordinates) : undefined;
}

export async function getCurrentCoordinates(): Promise<Coordinates> {
  const attempts: LocationOptions[] = [
    {
      enableHighAccuracy: true,
      timeout: 3000,
      maximumAge: 60 * 60 * 1000,
      forceRequestLocation: false,
      showLocationDialog: true,
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 30000,
      forceRequestLocation: true,
      showLocationDialog: true,
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60 * 60 * 1000,
      forceRequestLocation: false,
      showLocationDialog: true,
    },
  ];

  let lastError: unknown;
  for (const options of attempts) {
    try {
      return await requestCoordinates(options);
    } catch (error) {
      lastError = error;
    }
  }

  const cached = await getLastKnownCoordinates();
  if (cached) {
    return {
      ...cached,
      capturedAt: new Date().toISOString(),
    };
  }

  throw lastError;
}
