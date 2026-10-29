import { splitEqually, validateExpense, calcTip, formatMoney } from './src/lib/money';
import { calcNetBalances, calcMinCashFlow, allSettled } from './src/lib/balance';
import { encodeSnapshot, decodeSnapshot, buildSnapshot, makeInviteUrl, parseValortripUrl, GroupSnapshot } from './src/lib/snapshot';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('--- Testing Money Utils ---');

// splitEqually
const s1 = splitEqually(1000, 3);
assert(s1[0] === 333 && s1[1] === 333 && s1[2] === 334, 'splitEqually: 1000 / 3 = [333, 333, 334]');
assert(s1.reduce((a, b) => a + b, 0) === 1000, 'splitEqually: sum equals total');

const s2 = splitEqually(7, 4);
assert(s2.reduce((a, b) => a + b, 0) === 7, 'splitEqually: 7 / 4 sum equals 7');

// calcTip
assert(calcTip(1000, '10') === 100, 'calcTip: 10% of 1000 is 100');
assert(calcTip(1000, '15') === 150, 'calcTip: 15% of 1000 is 150');
assert(calcTip(1000, 'none') === 0, 'calcTip: none is 0');

// validateExpense
assert(validateExpense(1000, 1000, 1000).valid === true, 'validateExpense: valid when payers and shares match');
assert(validateExpense(1000, 999, 1000).valid === false, 'validateExpense: invalid when payers mismatch');
assert(validateExpense(1000, 1000, 999).valid === false, 'validateExpense: invalid when shares mismatch');

console.log('\n--- Testing Balance & Min Cash Flow ---');

// 3 members: A paid 3000, split equally between A, B, C (1000 each)
const memberIds = ['A', 'B', 'C'];
const nets = calcNetBalances({
  memberIds,
  payers: [{ memberId: 'A', amount: 3000 }],
  shares: [
    { memberId: 'A', amount: 1000 },
    { memberId: 'B', amount: 1000 },
    { memberId: 'C', amount: 1000 },
  ],
  settlements: [],
});

const netA = nets.find((n) => n.memberId === 'A')?.net;
const netB = nets.find((n) => n.memberId === 'B')?.net;
const netC = nets.find((n) => n.memberId === 'C')?.net;

assert(netA === 2000, 'A net is +2000');
assert(netB === -1000, 'B net is -1000');
assert(netC === -1000, 'C net is -1000');

const transfers = calcMinCashFlow(nets);
assert(transfers.length === 2, `Min cash flow produces <= 2 transfers (got ${transfers.length})`);
assert(transfers.every((t) => t.to === 'A' && t.amount === 1000), 'Both B and C pay 1000 to A');

// Now simulate settlement of both transfers
const settledNets = calcNetBalances({
  memberIds,
  payers: [{ memberId: 'A', amount: 3000 }],
  shares: [
    { memberId: 'A', amount: 1000 },
    { memberId: 'B', amount: 1000 },
    { memberId: 'C', amount: 1000 },
  ],
  settlements: transfers.map((t) => ({ fromMemberId: t.from, toMemberId: t.to, amount: t.amount })),
});

assert(allSettled(settledNets), 'All settled after recording calculated transfers');

// 5 members complex scenario
const fiveMembers = ['M1', 'M2', 'M3', 'M4', 'M5'];
const complexNets = calcNetBalances({
  memberIds: fiveMembers,
  payers: [
    { memberId: 'M1', amount: 5000 },
    { memberId: 'M2', amount: 2500 },
  ],
  shares: [
    { memberId: 'M1', amount: 1500 },
    { memberId: 'M2', amount: 1500 },
    { memberId: 'M3', amount: 1500 },
    { memberId: 'M4', amount: 1500 },
    { memberId: 'M5', amount: 1500 },
  ],
  settlements: [],
});

const complexTransfers = calcMinCashFlow(complexNets);
assert(complexTransfers.length <= 4, `5 members produce <= 4 transfers (got ${complexTransfers.length})`);
const sumTransfers = complexTransfers.reduce((s, t) => s + t.amount, 0);
const sumCreditors = complexNets.filter((n) => n.net > 0).reduce((s, n) => s + n.net, 0);
assert(sumTransfers === sumCreditors, `Conservation of money: sum of transfers (${sumTransfers}) === sum of credits (${sumCreditors})`);

// Custom shares ("By amount"): Valera paid $200 (20000), share $45 (4500) -> net +$155 (+15500)
const customNets = calcNetBalances({
  memberIds: ['ivan', 'valera'],
  payers: [
    { memberId: 'valera', amount: 20000 },
    { memberId: 'ivan', amount: 4500 },
  ],
  shares: [
    { memberId: 'ivan', amount: 20000 },
    { memberId: 'valera', amount: 4500 },
  ],
  settlements: [],
});
const valeraNet = customNets.find((n) => n.memberId === 'valera');
const ivanNet = customNets.find((n) => n.memberId === 'ivan');
assert(valeraNet?.net === 15500, `Valera paid 200, share 45 -> net is +15500 (got ${valeraNet?.net})`);
assert(valeraNet?.totalPaid === 20000 && valeraNet?.totalShare === 4500, 'Valera totalPaid=20000, totalShare=4500');
assert(ivanNet?.net === -15500, `Ivan paid 45, share 200 -> net is -15500 (got ${ivanNet?.net})`);
assert(ivanNet?.totalPaid === 4500 && ivanNet?.totalShare === 20000, 'Ivan totalPaid=4500, totalShare=20000');

// 3 members: Ivan paid $726 (72600), Ivan share $666 (66600), Valera share $60 (6000), Petrov share $0
const threeMemberNets = calcNetBalances({
  memberIds: ['ivan', 'valera', 'petrov'],
  payers: [{ memberId: 'ivan', amount: 72600 }],
  shares: [
    { memberId: 'ivan', amount: 66600 },
    { memberId: 'valera', amount: 6000 },
  ],
  settlements: [],
});
const ivan726 = threeMemberNets.find((n) => n.memberId === 'ivan');
const valera726 = threeMemberNets.find((n) => n.memberId === 'valera');
const petrov726 = threeMemberNets.find((n) => n.memberId === 'petrov');
assert(ivan726?.net === 6000, `Ivan paid 726, share 666 -> net is +6000 (+$60.00) (got ${ivan726?.net})`);
assert(valera726?.net === -6000, `Valera paid 0, share 60 -> net is -6000 (-$60.00) (got ${valera726?.net})`);
assert(petrov726?.net === 0, `Petrov paid 0, share 0 -> net is 0 ($0.00) (got ${petrov726?.net})`);
const threeMemberTransfers = calcMinCashFlow(threeMemberNets);
assert(
  threeMemberTransfers.length === 1 &&
    threeMemberTransfers[0]?.from === 'valera' &&
    threeMemberTransfers[0]?.to === 'ivan' &&
    threeMemberTransfers[0]?.amount === 6000,
  'Valera pays $60.00 to Ivan, Petrov has no transfers'
);

console.log('\n--- Testing Snapshot Compression & Round-trip ---');

const dummySnapshot: GroupSnapshot = buildSnapshot({
  groupId: 'group_test_123',
  groupName: 'Summer Roadtrip 2026',
  currency: 'EUR',
  isClosed: false,
  members: [
    { id: 'm1', name: 'Alice', isOwner: true, joinedAt: 1700000000000, leftAt: null, returnedAt: null },
    { id: 'm2', name: 'Bob', isOwner: false, joinedAt: 1700000000000, leftAt: null, returnedAt: null },
  ],
  expenses: [
    {
      id: 'e1',
      groupId: 'group_test_123',
      title: 'Gasoline',
      subtotal: 6500,
      tipAmount: 0,
      totalAmount: 6500,
      category: '⛽ Transport',
      createdAt: 1700001000000,
      updatedAt: 1700001000000,
    },
  ],
  payers: [{ id: 'p1', expenseId: 'e1', memberId: 'm1', amount: 6500 }],
  shares: [
    { id: 's1', expenseId: 'e1', memberId: 'm1', weight: 1, amount: 3250 },
    { id: 's2', expenseId: 'e1', memberId: 'm2', weight: 1, amount: 3250 },
  ],
  confirmations: [
    { id: 'c1', expenseId: 'e1', memberId: 'm2', isConfirmed: true, confirmedAt: 1700002000000 },
  ],
  settlements: [],
});

const encoded = encodeSnapshot(dummySnapshot);
assert(typeof encoded === 'string' && encoded.length > 0, 'encodeSnapshot produces non-empty base64 string');
assert(encoded.length < 2048, `Snapshot size (${encoded.length} bytes) is well under 2KB QR limit`);

const decoded = decodeSnapshot(encoded);
assert(decoded.groupId === dummySnapshot.groupId, 'Decoded groupId matches');
assert(decoded.groupName === dummySnapshot.groupName, 'Decoded groupName matches');
assert(decoded.members.length === dummySnapshot.members.length, 'Decoded members count matches');
assert(decoded.expenses[0]?.title === 'Gasoline', 'Decoded expense title matches');
assert(decoded.confirmations[0]?.isConfirmed === true, 'Decoded confirmation status matches');

const inviteUrlWithMeta = makeInviteUrl('grp_abc_123', 'Alps Ski Trip', 'EUR', [
  { name: 'Ivan', isOwner: true },
  { name: 'Valera', isOwner: false },
]);
const parsedInvite = parseValortripUrl(inviteUrlWithMeta);
assert(
  parsedInvite?.type === 'join' &&
    parsedInvite.groupId === 'grp_abc_123' &&
    parsedInvite.groupName === 'Alps Ski Trip' &&
    parsedInvite.currency === 'EUR' &&
    parsedInvite.members?.length === 2 &&
    parsedInvite.members[0]?.name === 'Ivan',
  'parseValortripUrl parses invite URL with groupName, currency, and members'
);

const parsedLegacyInvite = parseValortripUrl('valortrip://join/grp_legacy_999');
assert(
  parsedLegacyInvite?.type === 'join' && parsedLegacyInvite.groupId === 'grp_legacy_999',
  'parseValortripUrl parses legacy invite URL without query params'
);

console.log('\n🎉 ALL ALGORITHM & SNAPSHOT TESTS PASSED PERFECTLY!\n');
