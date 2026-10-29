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

export interface InviteMemberInfo {
  id?: string;
  name: string;
  isOwner?: boolean;
}

export function makeInviteUrl(
  groupId: string,
  groupName?: string,
  currency?: string,
  members?: InviteMemberInfo[]
): string {
  const params: string[] = [];
  if (groupName) params.push(`name=${encodeURIComponent(groupName)}`);
  if (currency) params.push(`currency=${encodeURIComponent(currency)}`);
  if (members && members.length > 0) {
    params.push(`members=${encodeURIComponent(JSON.stringify(members))}`);
  }
  return params.length > 0
    ? `valortrip://join/${groupId}?${params.join('&')}`
    : `valortrip://join/${groupId}`;
}

export function parseValortripUrl(url: string):
  | {
      type: 'join';
      groupId: string;
      groupName?: string;
      currency?: string;
      members?: InviteMemberInfo[];
    }
  | { type: 'snapshot'; snapshot: GroupSnapshot }
  | null {
  const cleanUrl = (url ?? '').trim();
  if (cleanUrl.startsWith('valortrip://join/')) {
    const rest = cleanUrl.replace('valortrip://join/', '');
    const [rawGroupId, queryString] = rest.split('?');
    const groupId = (rawGroupId ?? '').trim();
    if (!groupId) return null;

    let groupName: string | undefined;
    let currency: string | undefined;
    let members: InviteMemberInfo[] | undefined;
    if (queryString) {
      for (const part of queryString.split('&')) {
        const eqIdx = part.indexOf('=');
        const k = eqIdx >= 0 ? part.slice(0, eqIdx) : part;
        const v = eqIdx >= 0 ? part.slice(eqIdx + 1) : '';
        try {
          if (k === 'name' && v) groupName = decodeURIComponent(v);
          if (k === 'currency' && v) currency = decodeURIComponent(v);
          if (k === 'members' && v) {
            const parsedMembers = JSON.parse(decodeURIComponent(v));
            if (Array.isArray(parsedMembers)) {
              members = parsedMembers.filter(
                (m) => m && typeof m.name === 'string' && m.name.trim().length > 0
              );
            }
          }
        } catch {
          // ignore malformed query param
        }
      }
    }
    return { type: 'join', groupId, groupName, currency, members };
  }
  if (cleanUrl.startsWith('valortrip://snapshot/')) {
    const encoded = cleanUrl.replace('valortrip://snapshot/', '').trim();
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
