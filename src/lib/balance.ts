// Balance calculation: net = Σpaid - Σshared + Σreceived_settlements - Σsent_settlements

export interface NetResult {
  memberId: string;
  net: number; // positive = owed to them, negative = they owe
  totalPaid: number; // total cents paid by this member
  totalShare: number; // total cents consumed (shared) by this member
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
}

export function calcNetBalances(params: {
  memberIds: string[];
  payers: { memberId: string; amount: number }[];
  shares: { memberId: string; amount: number }[];
  settlements: { fromMemberId: string; toMemberId: string; amount: number }[];
}): NetResult[] {
  const { memberIds, payers, shares, settlements } = params;
  const netMap = new Map<string, number>();
  const paidMap = new Map<string, number>();
  const shareMap = new Map<string, number>();

  for (const id of memberIds) {
    netMap.set(id, 0);
    paidMap.set(id, 0);
    shareMap.set(id, 0);
  }

  for (const p of payers) {
    const amount = Math.round(Number(p.amount) || 0);
    netMap.set(p.memberId, (netMap.get(p.memberId) ?? 0) + amount);
    paidMap.set(p.memberId, (paidMap.get(p.memberId) ?? 0) + amount);
  }

  for (const s of shares) {
    const amount = Math.round(Number(s.amount) || 0);
    netMap.set(s.memberId, (netMap.get(s.memberId) ?? 0) - amount);
    shareMap.set(s.memberId, (shareMap.get(s.memberId) ?? 0) + amount);
  }

  for (const s of settlements) {
    const amount = Math.round(Number(s.amount) || 0);
    // from sends money → their net improves (they pay off debt)
    netMap.set(s.fromMemberId, (netMap.get(s.fromMemberId) ?? 0) + amount);
    // to receives money → their net decreases (they get paid)
    netMap.set(s.toMemberId, (netMap.get(s.toMemberId) ?? 0) - amount);
  }

  return Array.from(netMap.entries()).map(([memberId, net]) => ({
    memberId,
    net,
    totalPaid: paidMap.get(memberId) ?? 0,
    totalShare: shareMap.get(memberId) ?? 0,
  }));
}

/**
 * Min cash flow algorithm (greedy).
 * Returns minimum number of transfers (≤ N-1).
 */
export function calcMinCashFlow(nets: NetResult[]): Transfer[] {
  const creditors = nets
    .filter((n) => n.net > 0)
    .map((n) => ({ ...n }))
    .sort((a, b) => b.net - a.net);

  const debtors = nets
    .filter((n) => n.net < 0)
    .map((n) => ({ ...n }))
    .sort((a, b) => a.net - b.net); // most negative first

  const transfers: Transfer[] = [];

  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!;
    const debtor = debtors[di]!;

    const amount = Math.min(creditor.net, Math.abs(debtor.net));
    transfers.push({
      from: debtor.memberId,
      to: creditor.memberId,
      amount,
    });

    creditor.net -= amount;
    debtor.net += amount;

    if (creditor.net === 0) ci++;
    if (debtor.net === 0) di++;
  }

  return transfers;
}

/** Check if all debts are settled (all nets ≈ 0) */
export function allSettled(nets: NetResult[]): boolean {
  return nets.every((n) => n.net === 0);
}
