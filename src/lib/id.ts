import 'react-native-get-random-values';
import { customAlphabet } from 'nanoid';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const nanoid = customAlphabet(
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  21,
);

export function generateId(): string {
  return nanoid();
}

const DEVICE_ID_KEY = 'valortrip_owner_device_id';

let _cachedDeviceId: string | null = null;

export async function getOrCreateDeviceId(): Promise<string> {
  if (_cachedDeviceId) return _cachedDeviceId;

  try {
    const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (stored) {
      _cachedDeviceId = stored;
      return stored;
    }
  } catch {
    // SecureStore not available (e.g. simulator) — fall through
  }

  const uuid = Crypto.randomUUID();
  try {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, uuid);
  } catch {
    // ignore
  }
  _cachedDeviceId = uuid;
  return uuid;
}
