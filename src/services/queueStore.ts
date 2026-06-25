import {CheckInItem, UploadStatus} from '../types/checkIn';
import {localStorage} from './localStorage';

type Listener = (items: CheckInItem[]) => void;

const QUEUE_KEY = 'field-check-in.queue.v1';

class QueueStore {
  private items: CheckInItem[] = [];
  private listeners = new Set<Listener>();

  async hydrate() {
    try {
      const raw = localStorage.getString(QUEUE_KEY);
      this.items = raw ? JSON.parse(raw) : [];
    } catch {
      this.items = [];
      localStorage.remove(QUEUE_KEY);
    }
    this.emit();
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.items);
    return () => this.listeners.delete(listener);
  }

  getItems() {
    return this.items;
  }

  async enqueue(item: CheckInItem) {
    this.items = [item, ...this.items];
    await this.persist();
  }

  updateStatus(id: string, status: UploadStatus, patch: Partial<CheckInItem> = {}) {
    const now = new Date().toISOString();
    this.items = this.items.map(item =>
      item.id === id
        ? {
            ...item,
            ...patch,
            status,
            updatedAt: now,
          }
        : item,
    );
    this.persist().catch(() => undefined);
  }

  markUploading(id: string) {
    this.updateStatus(id, 'uploading', {
      auditTrail: this.appendAudit(id, 'upload_started'),
    });
  }

  markSuccess(id: string) {
    this.updateStatus(id, 'success', {
      lastError: undefined,
      nextAttemptAt: 0,
      auditTrail: this.appendAudit(id, 'upload_success'),
    });
  }

  markFailure(id: string, error: string) {
    const item = this.items.find(entry => entry.id === id);
    const attempts = (item?.attempts ?? 0) + 1;
    const baseDelay = Math.min(30 * 60 * 1000, 2 ** attempts * 1000);
    const jitter = Math.floor(Math.random() * 1000);

    this.updateStatus(id, 'failed', {
      attempts,
      lastError: error,
      nextAttemptAt: Date.now() + baseDelay + jitter,
      auditTrail: this.appendAudit(id, 'upload_failed', error),
    });
  }

  resetFailedToPending() {
    this.items = this.items.map(item =>
      item.status === 'failed' && item.nextAttemptAt <= Date.now()
        ? {...item, status: 'pending'}
        : item,
    );
    this.persist().catch(() => undefined);
  }

  removeSuccessful() {
    this.items = this.items.filter(item => item.status !== 'success');
    this.persist().catch(() => undefined);
  }

  private appendAudit(
    id: string,
    type: CheckInItem['auditTrail'][number]['type'],
    message?: string,
  ) {
    const item = this.items.find(entry => entry.id === id);
    return [
      ...(item?.auditTrail ?? []),
      {type, at: new Date().toISOString(), message},
    ];
  }

  private async persist() {
    localStorage.set(QUEUE_KEY, JSON.stringify(this.items));
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) {
      listener(this.items);
    }
  }
}

export const queueStore = new QueueStore();
