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
  // Validate before writing
  const payersSum = input.payers.reduce((s, p) => s + p.amount, 0);
  const sharesSum = input.shares.reduce((s, sh) => s + sh.amount, 0);
  const validation = validateExpense(input.totalAmount, payersSum, sharesSum);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const now = Date.now();

  return database.write(async () => {
    const expense = await database.get<Expense>('expenses').create((e) => {
      e._raw.id = generateId();
      e.groupId = input.groupId;
      e.title = input.title;
      e.subtotal = input.subtotal;
      e.tipAmount = input.tipAmount;
      e.totalAmount = input.totalAmount;
      e.category = input.category;
      raw(e).created_at = now;
      raw(e).updated_at = now;
    });

    for (const p of input.payers) {
      await database.get<Payer>('payers').create((payer) => {
        payer._raw.id = generateId();
        payer.expenseId = expense.id;
        payer.memberId = p.memberId;
        payer.amount = p.amount;
      });
    }

    for (const s of input.shares) {
      await database.get<Share>('shares').create((share) => {
        share._raw.id = generateId();
        share.expenseId = expense.id;
        share.memberId = s.memberId;
        share.weight = s.weight;
        share.amount = s.amount;
      });
    }

    return expense;
  });
}

export async function updateExpense(
  expenseId: string,
  input: CreateExpenseInput,
): Promise<void> {
  const payersSum = input.payers.reduce((s, p) => s + p.amount, 0);
  const sharesSum = input.shares.reduce((s, sh) => s + sh.amount, 0);
  const validation = validateExpense(input.totalAmount, payersSum, sharesSum);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const expense = await database.get<Expense>('expenses').find(expenseId);
  const existingPayers = await expense.payers.fetch();
  const existingShares = await expense.shares.fetch();

  await database.write(async () => {
    // Delete old payers and shares
    for (const p of existingPayers) {
      await p.destroyPermanently();
    }
    for (const s of existingShares) {
      await s.destroyPermanently();
    }

    // Update expense
    await expense.update((e) => {
      e.title = input.title;
      e.subtotal = input.subtotal;
      e.tipAmount = input.tipAmount;
      e.totalAmount = input.totalAmount;
      e.category = input.category;
      raw(e).updated_at = Date.now();
    });

    // Re-create payers
    for (const p of input.payers) {
      await database.get<Payer>('payers').create((payer) => {
        payer._raw.id = generateId();
        payer.expenseId = expense.id;
        payer.memberId = p.memberId;
        payer.amount = p.amount;
      });
    }

    // Re-create shares
    for (const s of input.shares) {
      await database.get<Share>('shares').create((share) => {
        share._raw.id = generateId();
        share.expenseId = expense.id;
        share.memberId = s.memberId;
        share.weight = s.weight;
        share.amount = s.amount;
      });
    }
  });
}

export async function deleteExpense(expenseId: string): Promise<void> {
  const expense = await database.get<Expense>('expenses').find(expenseId);
  const payers = await expense.payers.fetch();
  const shares = await expense.shares.fetch();
  const confirmations = await expense.confirmations.fetch();

  await database.write(async () => {
    for (const p of payers) await p.destroyPermanently();
    for (const s of shares) await s.destroyPermanently();
    for (const c of confirmations) await c.destroyPermanently();
    await expense.destroyPermanently();
  });
}
