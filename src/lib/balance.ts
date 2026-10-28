// Balance calculation: net = Σpaid - Σshared + Σreceived_settlements - Σsent_settlements

export interface NetResult {
  memberId: string;
  net: number; // positive = owed to them, negative = they owe
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
  const map = new Map<string, number>();

  for (const id of memberIds) {
    map.set(id, 0);
  }

  for (const p of payers) {
    map.set(p.memberId, (map.get(p.memberId) ?? 0) + p.amount);
  }

  for (const s of shares) {
    map.set(s.memberId, (map.get(s.memberId) ?? 0) - s.amount);
  }

  for (const s of settlements) {
    // from sends money → their net improves (they pay off debt)
    map.set(s.fromMemberId, (map.get(s.fromMemberId) ?? 0) + s.amount);
    // to receives money → their net decreases (they get paid)
    map.set(s.toMemberId, (map.get(s.toMemberId) ?? 0) - s.amount);
  }

  return Array.from(map.entries()).map(([memberId, net]) => ({ memberId, net }));
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
