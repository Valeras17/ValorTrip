import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import {
  Group,
  Member,
  Expense,
  Payer,
  Share,
  Confirmation,
  Settlement,
  raw,
} from './models';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true, // Use JSI for better performance
  onSetUpError: (error) => {
    console.error('[WatermelonDB] Setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Group, Member, Expense, Payer, Share, Confirmation, Settlement],
});

export { Group, Member, Expense, Payer, Share, Confirmation, Settlement, raw };
