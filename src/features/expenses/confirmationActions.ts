import { Q } from '@nozbe/watermelondb';
import { database, Confirmation, raw } from '@/db';
import { generateId } from '@/lib/id';

export async function confirmExpense(
  expenseId: string,
  memberId: string,
): Promise<void> {
  // Check if confirmation already exists
  const existing = await database
    .get<Confirmation>('confirmations')
    .query(
      Q.where('expense_id', expenseId),
      Q.where('member_id', memberId),
    )
    .fetch();

  const now = Date.now();

  await database.write(async () => {
    if (existing.length > 0) {
      await existing[0]!.update((c) => {
        c.isConfirmed = true;
        raw(c).confirmed_at = now;
      });
    } else {
      await database.get<Confirmation>('confirmations').create((c) => {
        c._raw.id = generateId();
        c.expenseId = expenseId;
        c.memberId = memberId;
        c.isConfirmed = true;
        raw(c).confirmed_at = now;
      });
    }
  });
}

export async function getExpenseConfirmations(
  expenseId: string,
): Promise<Confirmation[]> {
  return database
    .get<Confirmation>('confirmations')
    .query(Q.where('expense_id', expenseId))
    .fetch();
}
