import { Q } from '@nozbe/watermelondb';
import { database, Group, Member, Expense, Payer, Share, Confirmation, Settlement, raw } from '@/db';
import {
  buildSnapshot,
  GroupSnapshot,
  SnapshotMember,
  SnapshotExpense,
  SnapshotPayer,
  SnapshotShare,
  SnapshotConfirmation,
  SnapshotSettlement,
} from '@/lib/snapshot';
import { generateId, getOrCreateDeviceId } from '@/lib/id';
import { SCHEMA_VERSION } from '@/lib/money';

/** Build a complete snapshot from WatermelonDB for a group */
export async function buildGroupSnapshot(groupId: string): Promise<GroupSnapshot> {
  const group = await database.get<Group>('groups').find(groupId);

  const members = await database
    .get<Member>('members')
    .query(Q.where('group_id', groupId))
    .fetch();

  const expenses = await database
    .get<Expense>('expenses')
    .query(Q.where('group_id', groupId))
    .fetch();

  const expenseIds = expenses.map((e) => e.id);

  const payers =
    expenseIds.length > 0
      ? await database
          .get<Payer>('payers')
          .query(Q.where('expense_id', Q.oneOf(expenseIds)))
          .fetch()
      : [];

  const shares =
    expenseIds.length > 0
      ? await database
          .get<Share>('shares')
          .query(Q.where('expense_id', Q.oneOf(expenseIds)))
          .fetch()
      : [];

  const confirmations =
    expenseIds.length > 0
      ? await database
          .get<Confirmation>('confirmations')
          .query(Q.where('expense_id', Q.oneOf(expenseIds)))
          .fetch()
      : [];

  const settlements = await database
    .get<Settlement>('settlements')
    .query(Q.where('group_id', groupId))
    .fetch();

  const snapshotMembers: SnapshotMember[] = members.map((m) => ({
    id: m.id,
    name: m.name,
    isOwner: m.isOwner,
    joinedAt: raw(m).joined_at as number,
    leftAt: raw(m).left_at ? (raw(m).left_at as number) : null,
    returnedAt: raw(m).returned_at ? (raw(m).returned_at as number) : null,
  }));

  const snapshotExpenses: SnapshotExpense[] = expenses.map((e) => ({
    id: e.id,
    groupId: e.groupId,
    title: e.title,
    subtotal: e.subtotal,
    tipAmount: e.tipAmount,
    totalAmount: e.totalAmount,
    category: e.category,
    createdAt: raw(e).created_at as number,
    updatedAt: raw(e).updated_at as number,
  }));

  const snapshotPayers: SnapshotPayer[] = payers.map((p) => ({
    id: p.id,
    expenseId: p.expenseId,
    memberId: p.memberId,
    amount: p.amount,
  }));

  const snapshotShares: SnapshotShare[] = shares.map((s) => ({
    id: s.id,
    expenseId: s.expenseId,
    memberId: s.memberId,
    weight: s.weight,
    amount: s.amount,
  }));

  const snapshotConfirmations: SnapshotConfirmation[] = confirmations.map((c) => ({
    id: c.id,
    expenseId: c.expenseId,
    memberId: c.memberId,
    isConfirmed: c.isConfirmed,
    confirmedAt: raw(c).confirmed_at ? (raw(c).confirmed_at as number) : null,
  }));

  const snapshotSettlements: SnapshotSettlement[] = settlements.map((s) => ({
    id: s.id,
    groupId: s.groupId,
    fromMemberId: s.fromMemberId,
    toMemberId: s.toMemberId,
    amount: s.amount,
    createdAt: raw(s).created_at as number,
    note: s.note,
  }));

  return buildSnapshot({
    groupId: group.id,
    groupName: group.name,
    currency: group.currency,
    isClosed: group.isClosed,
    members: snapshotMembers,
    expenses: snapshotExpenses,
    payers: snapshotPayers,
    shares: snapshotShares,
    confirmations: snapshotConfirmations,
    settlements: snapshotSettlements,
  });
}

/** Apply a snapshot received via QR — upserts the group as read-only */
export async function applySnapshot(snapshot: GroupSnapshot): Promise<void> {
  const deviceId = await getOrCreateDeviceId();

  await database.write(async () => {
    // Upsert group
    let group: Group | null = null;
    try {
      group = await database.get<Group>('groups').find(snapshot.groupId);
    } catch {
      group = null;
    }

    if (group) {
      await group.update((g) => {
        g.name = snapshot.groupName;
        g.currency = snapshot.currency;
        g.isClosed = snapshot.isClosed;
        raw(g).updated_at = Date.now();
      });
    } else {
      await database.get<Group>('groups').create((g) => {
        g._raw.id = snapshot.groupId;
        g.name = snapshot.groupName;
        g.currency = snapshot.currency;
        g.ownerDeviceId = 'remote';
        g.isOwner = false;
        g.isClosed = snapshot.isClosed;
        raw(g).created_at = Date.now();
        raw(g).updated_at = Date.now();
      });
    }

    // Delete existing data for this group
    const existingMembers = await database
      .get<Member>('members')
      .query(Q.where('group_id', snapshot.groupId))
      .fetch();
    for (const m of existingMembers) await m.destroyPermanently();

    const existingExpenses = await database
      .get<Expense>('expenses')
      .query(Q.where('group_id', snapshot.groupId))
      .fetch();
    const existingExpenseIds = existingExpenses.map((e) => e.id);

    if (existingExpenseIds.length > 0) {
      const existingPayers = await database
        .get<Payer>('payers')
        .query(Q.where('expense_id', Q.oneOf(existingExpenseIds)))
        .fetch();
      const existingShares = await database
        .get<Share>('shares')
        .query(Q.where('expense_id', Q.oneOf(existingExpenseIds)))
        .fetch();
      const existingConfirmations = await database
        .get<Confirmation>('confirmations')
        .query(Q.where('expense_id', Q.oneOf(existingExpenseIds)))
        .fetch();
      for (const p of existingPayers) await p.destroyPermanently();
      for (const s of existingShares) await s.destroyPermanently();
      for (const c of existingConfirmations) await c.destroyPermanently();
    }

    for (const e of existingExpenses) await e.destroyPermanently();

    const existingSettlements = await database
      .get<Settlement>('settlements')
      .query(Q.where('group_id', snapshot.groupId))
      .fetch();
    for (const s of existingSettlements) await s.destroyPermanently();

    // Insert all snapshot data
    for (const m of snapshot.members) {
      await database.get<Member>('members').create((mem) => {
        mem._raw.id = m.id;
        mem.groupId = snapshot.groupId;
        mem.name = m.name;
        mem.isOwner = m.isOwner;
        raw(mem).joined_at = m.joinedAt;
        raw(mem).left_at = m.leftAt ?? 0;
        raw(mem).returned_at = m.returnedAt ?? 0;
        raw(mem).created_at = m.joinedAt;
      });
    }

    for (const e of snapshot.expenses) {
      await database.get<Expense>('expenses').create((exp) => {
        exp._raw.id = e.id;
        exp.groupId = e.groupId;
        exp.title = e.title;
        exp.subtotal = e.subtotal;
        exp.tipAmount = e.tipAmount;
        exp.totalAmount = e.totalAmount;
        exp.category = e.category;
        raw(exp).created_at = e.createdAt;
        raw(exp).updated_at = e.updatedAt;
      });
    }

    for (const p of snapshot.payers) {
      await database.get<Payer>('payers').create((payer) => {
        payer._raw.id = p.id;
        payer.expenseId = p.expenseId;
        payer.memberId = p.memberId;
        payer.amount = p.amount;
      });
    }

    for (const s of snapshot.shares) {
      await database.get<Share>('shares').create((share) => {
        share._raw.id = s.id;
        share.expenseId = s.expenseId;
        share.memberId = s.memberId;
        share.weight = s.weight;
        share.amount = s.amount;
      });
    }

    for (const c of snapshot.confirmations) {
      await database.get<Confirmation>('confirmations').create((conf) => {
        conf._raw.id = c.id;
        conf.expenseId = c.expenseId;
        conf.memberId = c.memberId;
        conf.isConfirmed = c.isConfirmed;
        raw(conf).confirmed_at = c.confirmedAt ?? 0;
      });
    }

    for (const s of snapshot.settlements) {
      await database.get<Settlement>('settlements').create((set) => {
        set._raw.id = s.id;
        set.groupId = s.groupId;
        set.fromMemberId = s.fromMemberId;
        set.toMemberId = s.toMemberId;
        set.amount = s.amount;
        raw(set).created_at = s.createdAt;
        set.note = s.note;
      });
    }
  });
}
