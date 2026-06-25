# Field Check-In

React Native Android app for field agents to capture a photo, GPS coordinate, and short note, then upload the check-in with an offline-first queue.

## Features

- Camera and location permission flows with rationale, first denial, permanent denial, and Settings redirect.
- Persistent offline queue backed by AsyncStorage, surviving app restarts.
- Visible queue status for `pending`, `uploading`, `success`, and `failed`.
- Automatic sync on connectivity changes with NetInfo.
- Firebase Firestore backend storing compressed photo payloads, check-in records, and route points.
- Background sync/retry awareness through `react-native-background-fetch`.
- Exponential retry backoff with jitter and a 30 minute cap.
- Partial failure safe uploads: each queued item is uploaded independently, so successful items are marked `success` and are not retried when other items fail.
- Biometric setup prompt through `react-native-biometrics`.
- Live route map screen using `react-native-geolocation-service` and `react-native-maps`.

## Setup

```bash
npm install
npm run android
```

For Maps, replace `YOUR_GOOGLE_MAPS_API_KEY` in `android/app/src/main/res/values/strings.xml` with a Google Maps Android SDK key.

For Firebase:

1. Create a Firebase project.
2. Add an Android app with package name `com.fieldagentcheckin`.
3. Download `google-services.json`.
4. Place it at `android/app/google-services.json`.
5. Enable Firestore in the Firebase console. Firebase Storage is not required for this demo build.

Backend writes are centralized in `src/services/backend.ts`. The offline queue stores the local photo URI, then upload reads the file and stores a compressed base64 photo directly in the Firestore `checkIns` collection with the note, location, retry metadata, and audit trail. Live route tracking writes each captured point to the Firestore `routePoints` collection with a route session id, coordinate, accuracy, client timestamp, and server timestamp.

## Android APK

Build a debug APK:

```bash
cd android
./gradlew assembleDebug
```

APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Google Drive APK link: add the uploaded APK URL here before submission.

## Queue State Machine

```text
created -> pending -> uploading -> success
                     -> failed -> pending after nextAttemptAt
```

`pending` items are eligible for sync when the device is online. `uploading` is a transient in-flight state. `success` items stay in the local history and are skipped by future syncs. `failed` items store `attempts`, `lastError`, and `nextAttemptAt`; once the backoff window expires, they return to `pending`.

The sync worker processes at most 5 ready items per pass. Each item is committed independently, so if a batch of 5 has 3 successful uploads and 2 failures, only the 2 failures get retry metadata. The 3 successful items remain `success` and are never re-uploaded.

## Permission Handling

`src/services/permissions.ts` centralizes camera and location checks:

- Shows a rationale dialog before asking the OS.
- Handles first denial with a visible status message.
- Handles permanent denial by opening the app Settings screen.
- Writes current camera/location state into the check-in screen UI.

## PII Handling Strategy

- Photos are compressed on capture. The AsyncStorage queue stores the photo URI, and Firestore stores the base64 image for this assignment build.
- Firestore documents have a 1 MiB size limit, so production photo uploads should use Firebase Storage, Cloud Storage, or another object store.
- GPS coordinates are captured when the agent submits or starts route tracking. Check-in coordinates are queued locally; route points are sent to Firestore as live tracking events.
- The queue stores the minimum fields needed for retry and auditability: note, photo URI, coordinate, timestamps, attempts, and upload status.
- No tokens or secrets are hardcoded. The Firebase Android config is supplied through `android/app/google-services.json`, and the Google Maps key should be build-time configuration in production.
- The README intentionally documents where PII flows: `src/services/backend.ts`, `src/services/location.ts`, and `src/services/queueStore.ts`.

## Audit Trail Design

Each `CheckInItem` includes an `auditTrail` array with timestamped events:

- `created`
- `queued`
- `upload_started`
- `upload_success`
- `upload_failed`
- `permission_denied`
- `permission_blocked`

This gives reviewers a local chronological record for every check-in. A production backend should persist these audit events server-side after upload and include the authenticated agent ID.

## Document Cleanup Approach

Before release:

- Move backend URL and Google Maps key to environment-specific config.
- Confirm Firebase Security Rules restrict `checkIns` and `routePoints` to authenticated field agents and reviewers.
- Move full-resolution photos from Firestore documents to object storage in production.
- Replace the debug signing config with a release keystore.
- Decide queue retention policy for successful items, such as keeping the last 30 days or clearing after server acknowledgement.
- Add encrypted-at-rest policy for sensitive queues if required by the deployment environment.
- Remove development endpoints and generated sample comments.

## Test And Verification

```bash
npx tsc --noEmit
npm run lint
npm test
```

Manual Android checks:

- Fresh install, grant camera/location, submit while online.
- Deny camera once and confirm the visible denial state.
- Permanently deny location, then confirm Settings redirect.
- Submit several check-ins while offline, kill and reopen the app, then verify queue persistence.
- Restore connectivity and confirm only failed items retry after backoff.
- Start and stop live route tracking on the Route Map screen, then confirm route points are written to the `routePoints` Firestore collection.
