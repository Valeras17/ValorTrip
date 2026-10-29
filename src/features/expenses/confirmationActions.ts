import { Q } from '@nozbe/watermelondb';
import { database, Confirmation, raw } from '@/db';
import { generateId } from '@/lib/id';

export async function confirmExpense(
  expenseId: string,
  memberId: string,
): Promise<void> {
  await confirmExpenseMultiple(expenseId, [memberId]);
}

export async function confirmExpenseMultiple(
  expenseId: string,
  memberIds: string[],
): Promise<void> {
  const uniqueIds = Array.from(new Set(memberIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  const now = Date.now();

  await database.write(async () => {
    for (const memberId of uniqueIds) {
      const existing = await database
        .get<Confirmation>('confirmations')
        .query(
          Q.where('expense_id', expenseId),
          Q.where('member_id', memberId),
        )
        .fetch();

      if (existing.length > 0) {
        for (const rec of existing) {
          await rec.update((c) => {
            c.isConfirmed = true;
            raw(c).confirmed_at = now;
          });
        }
      } else {
        await database.get<Confirmation>('confirmations').create((c) => {
          c._raw.id = generateId();
          c.expenseId = expenseId;
          c.memberId = memberId;
          c.isConfirmed = true;
          raw(c).confirmed_at = now;
        });
      }
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
