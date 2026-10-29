import { Q } from '@nozbe/watermelondb';
import { database, Member, Expense, Payer, Share, Settlement, raw } from '@/db';
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
      s.amount = Math.round(Number(input.amount) || 0);
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
    const records = transfers.map((t) =>
      database.get<Settlement>('settlements').prepareCreate((s) => {
        s._raw.id = generateId();
        s.groupId = groupId;
        s.fromMemberId = t.from;
        s.toMemberId = t.to;
        s.amount = Math.round(Number(t.amount) || 0);
        raw(s).created_at = now;
        s.note = null;
      })
    );
    await database.batch(...records);
  });
}

/** Compute full balance state for a group across ALL expenses without limits */
export async function computeGroupBalance(groupId: string): Promise<{
  nets: NetResult[];
  transfers: Transfer[];
}> {
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

  const settlements = await database
    .get<Settlement>('settlements')
    .query(Q.where('group_id', groupId))
    .fetch();

  const memberIds = members.map((m) => m.id);

  const nets = calcNetBalances({
    memberIds,
    payers: payers.map((p) => ({
      memberId: p.memberId,
      amount: Math.round(Number(p.amount) || 0),
    })),
    shares: shares.map((s) => ({
      memberId: s.memberId,
      amount: Math.round(Number(s.amount) || 0),
    })),
    settlements: settlements.map((s) => ({
      fromMemberId: s.fromMemberId,
      toMemberId: s.toMemberId,
      amount: Math.round(Number(s.amount) || 0),
    })),
  });

  const transfers = calcMinCashFlow(nets);

  return { nets, transfers };
}
