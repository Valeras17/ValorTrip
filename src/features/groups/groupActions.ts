import { database, Group, Member, raw } from '@/db';
import { generateId, getOrCreateDeviceId } from '@/lib/id';

export interface CreateGroupInput {
  name: string;
  currency: string;
  ownerName: string;
}

export async function createGroup(input: CreateGroupInput): Promise<Group> {
  const deviceId = await getOrCreateDeviceId();
  const now = Date.now();

  return database.write(async () => {
    const group = await database.get<Group>('groups').create((g) => {
      g._raw.id = generateId();
      g.name = input.name;
      g.currency = input.currency;
      g.ownerDeviceId = deviceId;
      g.isOwner = true;
      g.isClosed = false;
      raw(g).created_at = now;
      raw(g).updated_at = now;
    });

    // Create the owner member
    await database.get<Member>('members').create((m) => {
      m._raw.id = generateId();
      m.groupId = group.id;
      m.name = input.ownerName;
      m.isOwner = true;
      raw(m).joined_at = now;
      raw(m).left_at = 0;
      raw(m).returned_at = 0;
      raw(m).created_at = now;
    });

    return group;
  });
}

export async function addMemberToGroup(groupId: string, name: string): Promise<Member> {
  const now = Date.now();
  return database.write(async () => {
    return database.get<Member>('members').create((m) => {
      m._raw.id = generateId();
      m.groupId = groupId;
      m.name = name;
      m.isOwner = false;
      raw(m).joined_at = now;
      raw(m).left_at = 0;
      raw(m).returned_at = 0;
      raw(m).created_at = now;
    });
  });
}

export async function closeMember(memberId: string): Promise<void> {
  const member = await database.get<Member>('members').find(memberId);
  await database.write(async () => {
    await member.update((m) => {
      raw(m).left_at = Date.now();
    });
  });
}

export async function returnMember(memberId: string): Promise<void> {
  const member = await database.get<Member>('members').find(memberId);
  await database.write(async () => {
    await member.update((m) => {
      raw(m).left_at = 0; // null
      raw(m).returned_at = Date.now();
    });
  });
}

export async function closeTrip(groupId: string): Promise<void> {
  const group = await database.get<Group>('groups').find(groupId);
  await database.write(async () => {
    await group.update((g) => {
      g.isClosed = true;
      raw(g).updated_at = Date.now();
    });
  });
}
