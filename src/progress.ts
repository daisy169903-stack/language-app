import { initialProgress, validateProgress, type Progress } from "./domain";

const DATABASE = "vietlingo-hu";
const STORE = "progress";
const KEY = "learner";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("A böngésző nem támogatja a helyi adattárolást."));
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE))
        request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        request.error ?? new Error("Nem sikerült megnyitni a helyi adattárat."),
      );
    request.onblocked = () =>
      reject(new Error("A helyi adattár frissítését egy másik lap blokkolja."));
  });
}

export async function loadProgress(): Promise<Progress> {
  const database = await openDatabase();
  try {
    return await new Promise<Progress>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readonly");
      const request = transaction.objectStore(STORE).get(KEY);
      let stored: unknown;
      request.onsuccess = () => {
        stored = request.result;
      };
      transaction.oncomplete = () => {
        try {
          resolve(
            stored === undefined ? initialProgress() : validateProgress(stored),
          );
        } catch (error) {
          reject(error);
        }
      };
      transaction.onerror = () =>
        reject(
          transaction.error ??
            request.error ??
            new Error("Nem sikerült beolvasni a haladást."),
        );
      transaction.onabort = () =>
        reject(
          transaction.error ?? new Error("A haladás beolvasása megszakadt."),
        );
    });
  } finally {
    database.close();
  }
}

export async function saveProgress(progress: Progress): Promise<void> {
  const validated = validateProgress(progress);
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, "readwrite");
      const request = transaction.objectStore(STORE).put(validated, KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(
          transaction.error ??
            request.error ??
            new Error("Nem sikerült menteni a haladást."),
        );
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("A haladás mentése megszakadt."));
    });
  } finally {
    database.close();
  }
}
