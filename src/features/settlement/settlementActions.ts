import { Q } from '@nozbe/watermelondb';
import { database, Settlement, raw } from '@/db';
import { generateId } from '@/lib/id';
import { calcNetBalances, calcMinCashFlow, NetResult, Transfer } from '@/lib/balance';

export interface RecordSettlementInput {
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  note?: string;
}

export async function recordSettlement(input: RecordSettlementInput): Promise<Settlement> {
  const now = Date.now();
  return database.write(async () => {
    return database.get<Settlement>('settlements').create((s) => {
      s._raw.id = generateId();
      s.groupId = input.groupId;
      s.fromMemberId = input.fromMemberId;
      s.toMemberId = input.toMemberId;
      s.amount = input.amount;
      raw(s).created_at = now;
      s.note = input.note ?? null;
    });
  });
}

export async function recordSettlementsBatch(
  groupId: string,
  transfers: Transfer[],
): Promise<void> {
  const now = Date.now();
  await database.write(async () => {
    for (const t of transfers) {
      await database.get<Settlement>('settlements').create((s) => {
        s._raw.id = generateId();
        s.groupId = groupId;
        s.fromMemberId = t.from;
        s.toMemberId = t.to;
        s.amount = t.amount;
        raw(s).created_at = now;
        s.note = null;
      });
    }
  });
}

/** Compute full balance state for a group */
export async function computeGroupBalance(groupId: string): Promise<{
  nets: NetResult[];
  transfers: Transfer[];
}> {
  const members = await database
    .get('members')
    .query(Q.where('group_id', groupId))
    .fetch();

  const expenses = await database
    .get('expenses')
    .query(Q.where('group_id', groupId))
    .fetch();

  const expenseIds = expenses.map((e: any) => e.id);

  const payers =
    expenseIds.length > 0
      ? await database
          .get('payers')
          .query(Q.where('expense_id', Q.oneOf(expenseIds)))
          .fetch()
      : [];

  const shares =
    expenseIds.length > 0
      ? await database
          .get('shares')
          .query(Q.where('expense_id', Q.oneOf(expenseIds)))
          .fetch()
      : [];

  const settlements = await database
    .get('settlements')
    .query(Q.where('group_id', groupId))
    .fetch();

  const memberIds = members.map((m: any) => m.id);

  const nets = calcNetBalances({
    memberIds,
    payers: payers.map((p: any) => ({ memberId: p.memberId, amount: p.amount })),
    shares: shares.map((s: any) => ({ memberId: s.memberId, amount: s.amount })),
    settlements: settlements.map((s: any) => ({
      fromMemberId: s.fromMemberId,
      toMemberId: s.toMemberId,
      amount: s.amount,
    })),
  });

  const transfers = calcMinCashFlow(nets);

  return { nets, transfers };
}
