export type CachedScreenshotSlot = 'data' | 'overview';

interface CachedScreenshotRecord {
  key: string;
  gameId: string;
  slot: CachedScreenshotSlot;
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
  updatedAt: number;
}

const DATABASE_NAME = 'chalize-scrim-screenshots';
const DATABASE_VERSION = 1;
const STORE_NAME = 'screenshots';

export async function loadCachedScreenshot(
  gameId: string,
  slot: CachedScreenshotSlot,
) {
  const database = await openDatabase();
  try {
    const record = await new Promise<CachedScreenshotRecord | undefined>(
      (resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(cacheKey(gameId, slot));
        request.onsuccess = () =>
          resolve(request.result as CachedScreenshotRecord | undefined);
        request.onerror = () => reject(request.error);
      },
    );
    if (!record) return null;
    return new File([record.blob], record.name, {
      type: record.type || record.blob.type,
      lastModified: record.lastModified,
    });
  } finally {
    database.close();
  }
}

export async function saveCachedScreenshot(
  gameId: string,
  slot: CachedScreenshotSlot,
  file: File,
) {
  const database = await openDatabase();
  try {
    await completeTransaction(database, 'readwrite', (store) => {
      store.put({
        key: cacheKey(gameId, slot),
        gameId,
        slot,
        blob: file,
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
        updatedAt: Date.now(),
      } satisfies CachedScreenshotRecord);
    });
  } finally {
    database.close();
  }
}

export async function deleteCachedScreenshot(
  gameId: string,
  slot: CachedScreenshotSlot,
) {
  const database = await openDatabase();
  try {
    await completeTransaction(database, 'readwrite', (store) => {
      store.delete(cacheKey(gameId, slot));
    });
  } finally {
    database.close();
  }
}

function cacheKey(gameId: string, slot: CachedScreenshotSlot) {
  return `${gameId}:${slot}`;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser does not provide screenshot storage.'));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('gameId', 'gameId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error('Screenshot storage is temporarily blocked by another tab.'));
  });
}

function completeTransaction(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    action(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
