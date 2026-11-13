import { CampaignBlueprintState, SimulationParams } from '../sim/types';

const DB_NAME = 'abyssal-frontier-db';
const DB_VERSION = 1;
const STORE_SETTINGS = 'settings';
const STORE_CAMPAIGN = 'campaign';

export interface PersistedLabState {
  params: SimulationParams;
  geoAuthorized: boolean;
  muted: boolean;
  savedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS);
      }
      if (!db.objectStoreNames.contains(STORE_CAMPAIGN)) {
        db.createObjectStore(STORE_CAMPAIGN);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function saveLabState(state: PersistedLabState): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readwrite');
      tx.objectStore(STORE_SETTINGS).put(state, 'lab-config');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Graceful fallback if IndexedDB is blocked in private mode
    try {
      localStorage.setItem('abyssal-lab-config', JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }
}

export async function loadLabState(): Promise<PersistedLabState | null> {
  try {
    const db = await openDB();
    const res = await new Promise<PersistedLabState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_SETTINGS, 'readonly');
      const req = tx.objectStore(STORE_SETTINGS).get('lab-config');
      req.onsuccess = () => resolve((req.result as PersistedLabState) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (res) return res;
  } catch {
    // Fallback below
  }
  try {
    const raw = localStorage.getItem('abyssal-lab-config');
    return raw ? (JSON.parse(raw) as PersistedLabState) : null;
  } catch {
    return null;
  }
}

export async function saveCampaignBlueprint(state: CampaignBlueprintState): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CAMPAIGN, 'readwrite');
      tx.objectStore(STORE_CAMPAIGN).put(state, 'kael-rivera-v1');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    try {
      localStorage.setItem('abyssal-campaign-v1', JSON.stringify(state));
    } catch {
      // Ignore
    }
  }
}

export async function loadCampaignBlueprint(): Promise<CampaignBlueprintState | null> {
  try {
    const db = await openDB();
    const res = await new Promise<CampaignBlueprintState | null>((resolve, reject) => {
      const tx = db.transaction(STORE_CAMPAIGN, 'readonly');
      const req = tx.objectStore(STORE_CAMPAIGN).get('kael-rivera-v1');
      req.onsuccess = () => resolve((req.result as CampaignBlueprintState) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (res) return res;
  } catch {
    // Fallback
  }
  try {
    const raw = localStorage.getItem('abyssal-campaign-v1');
    return raw ? (JSON.parse(raw) as CampaignBlueprintState) : null;
  } catch {
    return null;
  }
}
