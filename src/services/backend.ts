import firestore from '@react-native-firebase/firestore';
import RNFS from 'react-native-fs';

import {CheckInItem, Coordinates} from '../types/checkIn';
import {getAgentId} from './agentIdentity';

const CHECK_INS_COLLECTION = 'checkIns';
const ROUTE_POINTS_COLLECTION = 'routePoints';
const MAX_FIRESTORE_PHOTO_BASE64_BYTES = 700_000;

function normalizeFilePath(uri: string) {
  return uri.startsWith('file://') ? uri.replace('file://', '') : uri;
}

export async function uploadCheckIn(item: CheckInItem) {
  const photoBase64 = await RNFS.readFile(normalizeFilePath(item.photoUri), 'base64');

  if (photoBase64.length > MAX_FIRESTORE_PHOTO_BASE64_BYTES) {
    throw new Error('Photo is too large for Firestore. Retake a smaller photo.');
  }

  await firestore()
    .collection(CHECK_INS_COLLECTION)
    .doc(item.id)
    .set(
      {
        id: item.id,
        agentId: item.agentId ?? getAgentId(),
        note: item.note,
        photo: {
          base64: photoBase64,
          contentType: item.photoType ?? 'image/jpeg',
          fileName: item.photoFileName ?? `${item.id}.jpg`,
        },
        location: {
          latitude: item.location.latitude,
        longitude: item.location.longitude,
        accuracy: item.location.accuracy ?? null,
        heading: item.location.heading ?? null,
        capturedAt: item.location.capturedAt,
      },
        clientCreatedAt: item.createdAt,
        clientUpdatedAt: item.updatedAt,
        attempts: item.attempts,
        auditTrail: item.auditTrail,
        uploadedAt: firestore.FieldValue.serverTimestamp(),
      },
      {merge: true},
    );
}

export async function uploadRoutePoint(sessionId: string, point: Coordinates) {
  await firestore()
    .collection(ROUTE_POINTS_COLLECTION)
    .add({
      agentId: getAgentId(),
      sessionId,
      location: {
        latitude: point.latitude,
        longitude: point.longitude,
        accuracy: point.accuracy ?? null,
        heading: point.heading ?? null,
        capturedAt: point.capturedAt,
      },
      clientCreatedAt: point.capturedAt,
      uploadedAt: firestore.FieldValue.serverTimestamp(),
    });
}
