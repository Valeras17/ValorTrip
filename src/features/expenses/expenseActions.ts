import { database, Expense, Payer, Share, raw } from '@/db';
import { generateId } from '@/lib/id';
import { validateExpense } from '@/lib/money';

export interface PayerInput {
  memberId: string;
  amount: number; // cents
}

export interface ShareInput {
  memberId: string;
  weight: number;
  amount: number; // cents
}

export interface CreateExpenseInput {
  groupId: string;
  title: string;
  subtotal: number; // cents
  tipAmount: number; // cents
  totalAmount: number; // cents
  category: string;
  payers: PayerInput[];
  shares: ShareInput[];
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const totalAmount = Math.round(Number(input.totalAmount) || 0);
  const subtotal = Math.round(Number(input.subtotal) || 0);
  const tipAmount = Math.round(Number(input.tipAmount) || 0);

  const normalizedPayers = input.payers
    .map((p) => ({
      memberId: p.memberId,
      amount: Math.round(Number(p.amount) || 0),
    }))
    .filter((p) => p.amount > 0);

  const normalizedShares = input.shares
    .map((s) => ({
      memberId: s.memberId,
      weight: Number(s.weight) || 1,
      amount: Math.round(Number(s.amount) || 0),
    }))
    .filter((s) => s.amount > 0);

  // Validate before writing
  const payersSum = normalizedPayers.reduce((s, p) => s + p.amount, 0);
  const sharesSum = normalizedShares.reduce((s, sh) => s + sh.amount, 0);
  const validation = validateExpense(totalAmount, payersSum, sharesSum);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const now = Date.now();

  return database.write(async () => {
    const expense = database.get<Expense>('expenses').prepareCreate((e) => {
      e._raw.id = generateId();
      e.groupId = input.groupId;
      e.title = input.title;
      e.subtotal = subtotal;
      e.tipAmount = tipAmount;
      e.totalAmount = totalAmount;
      e.category = input.category;
      raw(e).created_at = now;
      raw(e).updated_at = now;
    });

    const payerRecords = normalizedPayers.map((p) =>
      database.get<Payer>('payers').prepareCreate((payer) => {
        payer._raw.id = generateId();
        payer.expenseId = expense.id;
        payer.memberId = p.memberId;
        payer.amount = p.amount;
      })
    );

    const shareRecords = normalizedShares.map((s) =>
      database.get<Share>('shares').prepareCreate((share) => {
        share._raw.id = generateId();
        share.expenseId = expense.id;
        share.memberId = s.memberId;
        share.weight = s.weight;
        share.amount = s.amount;
      })
    );

    await database.batch(expense, ...payerRecords, ...shareRecords);

    return expense;
  });
}

export async function updateExpense(
  expenseId: string,
  input: CreateExpenseInput,
): Promise<void> {
  const totalAmount = Math.round(Number(input.totalAmount) || 0);
  const subtotal = Math.round(Number(input.subtotal) || 0);
  const tipAmount = Math.round(Number(input.tipAmount) || 0);

  const normalizedPayers = input.payers
    .map((p) => ({
      memberId: p.memberId,
      amount: Math.round(Number(p.amount) || 0),
    }))
    .filter((p) => p.amount > 0);

  const normalizedShares = input.shares
    .map((s) => ({
      memberId: s.memberId,
      weight: Number(s.weight) || 1,
      amount: Math.round(Number(s.amount) || 0),
    }))
    .filter((s) => s.amount > 0);

  const payersSum = normalizedPayers.reduce((s, p) => s + p.amount, 0);
  const sharesSum = normalizedShares.reduce((s, sh) => s + sh.amount, 0);
  const validation = validateExpense(totalAmount, payersSum, sharesSum);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const expense = await database.get<Expense>('expenses').find(expenseId);
  const existingPayers = await expense.payers.fetch();
  const existingShares = await expense.shares.fetch();

  await database.write(async () => {
    const deletedPayers = existingPayers.map((p) => p.prepareDestroyPermanently());
    const deletedShares = existingShares.map((s) => s.prepareDestroyPermanently());

    const updatedExpense = expense.prepareUpdate((e) => {
      e.title = input.title;
      e.subtotal = subtotal;
      e.tipAmount = tipAmount;
      e.totalAmount = totalAmount;
      e.category = input.category;
      raw(e).updated_at = Date.now();
    });

    const newPayers = normalizedPayers.map((p) =>
      database.get<Payer>('payers').prepareCreate((payer) => {
        payer._raw.id = generateId();
        payer.expenseId = expense.id;
        payer.memberId = p.memberId;
        payer.amount = p.amount;
      })
    );

    const newShares = normalizedShares.map((s) =>
      database.get<Share>('shares').prepareCreate((share) => {
        share._raw.id = generateId();
        share.expenseId = expense.id;
        share.memberId = s.memberId;
        share.weight = s.weight;
        share.amount = s.amount;
      })
    );

    await database.batch(
      ...deletedPayers,
      ...deletedShares,
      updatedExpense,
      ...newPayers,
      ...newShares,
    );
  });
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const expense = await database.get<Expense>('expenses').find(expenseId);
  const payers = await expense.payers.fetch();
  const shares = await expense.shares.fetch();
  const confirmations = await expense.confirmations.fetch();

  await database.write(async () => {
    await database.batch(
      ...payers.map((p) => p.prepareDestroyPermanently()),
      ...shares.map((s) => s.prepareDestroyPermanently()),
      ...confirmations.map((c) => c.prepareDestroyPermanently()),
      expense.prepareDestroyPermanently(),
    );
  });
}
