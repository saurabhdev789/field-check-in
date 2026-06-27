import {Coordinates} from '../types/checkIn';
import {localStorage} from './localStorage';

const ROUTE_POINTS_KEY = 'field-check-in.route-points.v1';
const ROUTE_SESSION_KEY = 'field-check-in.route-session-id.v1';
const MAX_SAVED_ROUTE_POINTS = 1000;

function createRouteSessionId() {
  return `route-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getSavedRoutePoints() {
  const raw = await localStorage.getString(ROUTE_POINTS_KEY);
  return raw ? (JSON.parse(raw) as Coordinates[]) : [];
}

export async function saveRoutePoints(points: Coordinates[]) {
  const pointsToSave = points.slice(-MAX_SAVED_ROUTE_POINTS);
  await localStorage.set(ROUTE_POINTS_KEY, JSON.stringify(pointsToSave));
}

export async function getRouteSessionId() {
  const existing = await localStorage.getString(ROUTE_SESSION_KEY);
  if (existing) {
    return existing;
  }

  const sessionId = createRouteSessionId();
  await localStorage.set(ROUTE_SESSION_KEY, sessionId);
  return sessionId;
}
