export type UploadStatus = 'pending' | 'uploading' | 'success' | 'failed';

export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt: string;
};

export type CheckInItem = {
  id: string;
  note: string;
  photoUri: string;
  photoFileName?: string;
  photoType?: string;
  location: Coordinates;
  status: UploadStatus;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string;
  auditTrail: AuditEvent[];
};

export type AuditEvent = {
  type:
    | 'created'
    | 'queued'
    | 'upload_started'
    | 'upload_success'
    | 'upload_failed'
    | 'permission_denied'
    | 'permission_blocked';
  at: string;
  message?: string;
};

export type PermissionUiState = {
  camera: string;
  location: string;
};
