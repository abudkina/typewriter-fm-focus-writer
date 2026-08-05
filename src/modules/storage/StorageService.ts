import { logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';

const DB_NAME = 'typewriter-fm';
const DB_VERSION = 1;
const STORE_DOCS = 'documents';
const STORE_META = 'meta';

export interface StoredDocument {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
}

/**
 * Обёртка над IndexedDB для документов и метаданных.
 * LocalStorage используется для лёгких настроек.
 */
export class StorageService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      logger.warn('IndexedDB недоступен, документы только в памяти сессии');
      return;
    }
    this.db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        reject(new AppError('IDB_OPEN', 'Не удалось открыть локальное хранилище.'));
      };
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_DOCS)) {
          db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };
    });
  }

  getSetting<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`twfm:${key}`);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.warn('Ошибка чтения настройки', { key, err });
      return fallback;
    }
  }

  setSetting<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`twfm:${key}`, JSON.stringify(value));
    } catch (err) {
      logger.error('Ошибка сохранения настройки', { key, err });
      throw new AppError(
        'STORAGE_FULL',
        'Не удалось сохранить настройки. Возможно, хранилище переполнено.'
      );
    }
  }

  async saveDocument(doc: StoredDocument): Promise<void> {
    if (!this.db) {
      this.setSetting('draft', doc);
      return;
    }
    await this.idbPut(STORE_DOCS, doc);
  }

  async loadDocument(id: string): Promise<StoredDocument | null> {
    if (!this.db) {
      return this.getSetting<StoredDocument | null>('draft', null);
    }
    return this.idbGet<StoredDocument>(STORE_DOCS, id);
  }

  async listDocuments(): Promise<StoredDocument[]> {
    if (!this.db) {
      const draft = this.getSetting<StoredDocument | null>('draft', null);
      return draft ? [draft] : [];
    }
    return this.idbGetAll<StoredDocument>(STORE_DOCS);
  }

  private idbPut(store: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readwrite');
      tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(new AppError('IDB_WRITE', 'Не удалось сохранить документ.'));
    });
  }

  private idbGet<T>(store: string, key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () =>
        reject(new AppError('IDB_READ', 'Не удалось прочитать документ.'));
    });
  }

  private idbGetAll<T>(store: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve((req.result as T[]) ?? []);
      req.onerror = () =>
        reject(new AppError('IDB_LIST', 'Не удалось получить список документов.'));
    });
  }
}

export const storage = new StorageService();
