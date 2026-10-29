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
import { reportError } from '@/lib/errorReporter';

let databaseInitError: Error | null = null;

export function getDatabaseInitError(): Error | null {
  return databaseInitError;
}

function createDatabase(): Database {
  try {
    databaseInitError = null;
    const adapter = new SQLiteAdapter({
      schema,
      migrations,
      // JSI is disabled natively (expo-watermelondb-plugin: disableJsi: true),
      // so the adapter must use the async bridge as well.
      jsi: false,
      onSetUpError: (error) => {
        const err = error instanceof Error ? error : new Error(String(error));
        databaseInitError = err;
        reportError(err, 'WatermelonDB setup', { fatal: false, alert: false });
      },
    });

    return new Database({
      adapter,
      modelClasses: [Group, Member, Expense, Payer, Share, Confirmation, Settlement],
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    databaseInitError = err;
    reportError(err, 'WatermelonDB init', { fatal: false, alert: false });
    return null as unknown as Database;
  }
}

export let database = createDatabase();

export function retryDatabaseInit(): Database {
  database = createDatabase();
  return database;
}

export { Group, Member, Expense, Payer, Share, Confirmation, Settlement, raw };
