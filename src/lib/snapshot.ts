import { strToU8, strFromU8, deflateSync, inflateSync } from 'fflate';
import { SCHEMA_VERSION } from './money';

export interface SnapshotMember {
  id: string;
  name: string;
  isOwner: boolean;
  joinedAt: number;
  leftAt: number | null;
  returnedAt: number | null;
}

export interface SnapshotExpense {
  id: string;
  groupId: string;
  title: string;
  subtotal: number;
  tipAmount: number;
  totalAmount: number;
  category: string;
  createdAt: number;
  updatedAt: number;
}

export interface SnapshotPayer {
  id: string;
  expenseId: string;
  memberId: string;
  amount: number;
}

export interface SnapshotShare {
  id: string;
  expenseId: string;
  memberId: string;
  weight: number;
  amount: number;
}

export interface SnapshotConfirmation {
  id: string;
  expenseId: string;
  memberId: string;
  isConfirmed: boolean;
  confirmedAt: number | null;
}

export interface SnapshotSettlement {
  id: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  createdAt: number;
  note: string | null;
}

export interface GroupSnapshot {
  groupId: string;
  groupName: string;
  currency: string;
  isClosed: boolean;
  members: SnapshotMember[];
  expenses: SnapshotExpense[];
  payers: SnapshotPayer[];
  shares: SnapshotShare[];
  confirmations: SnapshotConfirmation[];
  settlements: SnapshotSettlement[];
  snapshotAt: string;
  schemaVersion: number;
}

export const QR_SIZE_LIMIT_BYTES = 2048;

/** Compress a snapshot to base64 string */
export function encodeSnapshot(snapshot: GroupSnapshot): string {
  const json = JSON.stringify(snapshot);
  const input = strToU8(json);
  const compressed = deflateSync(input, { level: 9 });
  // Convert to base64
  let binary = '';
  for (let i = 0; i < compressed.length; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  return btoa(binary);
}

/** Decompress a base64 string to snapshot */
export function decodeSnapshot(encoded: string): GroupSnapshot {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decompressed = inflateSync(bytes);
  const json = strFromU8(decompressed);
  return JSON.parse(json) as GroupSnapshot;
}

export function makeSnapshotUrl(snapshot: GroupSnapshot): string {
  const encoded = encodeSnapshot(snapshot);
  return `valortrip://snapshot/${encoded}`;
}

export function makeInviteUrl(groupId: string): string {
  return `valortrip://join/${groupId}`;
}

export function parseValortripUrl(url: string):
  | { type: 'join'; groupId: string }
  | { type: 'snapshot'; snapshot: GroupSnapshot }
  | null {
  if (url.startsWith('valortrip://join/')) {
    const groupId = url.replace('valortrip://join/', '');
    return { type: 'join', groupId };
  }
  if (url.startsWith('valortrip://snapshot/')) {
    const encoded = url.replace('valortrip://snapshot/', '');
    try {
      const snapshot = decodeSnapshot(encoded);
      if (snapshot.schemaVersion !== SCHEMA_VERSION) {
        throw new Error('Schema version mismatch');
      }
      return { type: 'snapshot', snapshot };
    } catch {
      return null;
    }
  }
  return null;
}

export function snapshotByteSize(snapshot: GroupSnapshot): number {
  const encoded = encodeSnapshot(snapshot);
  return encoded.length; // approx bytes
}

export function buildSnapshot(data: {
  groupId: string;
  groupName: string;
  currency: string;
  isClosed: boolean;
  members: SnapshotMember[];
  expenses: SnapshotExpense[];
  payers: SnapshotPayer[];
  shares: SnapshotShare[];
  confirmations: SnapshotConfirmation[];
  settlements: SnapshotSettlement[];
}): GroupSnapshot {
  return {
    ...data,
    snapshotAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
  };
}
