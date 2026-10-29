import 'react-native-get-random-values';
import '../global.css';
import { useEffect, useState } from 'react';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database, getDatabaseInitError, retryDatabaseInit } from '@/db';
import { getOrCreateDeviceId } from '@/lib/id';
import { reportError } from '@/lib/errorReporter';
import { ErrorScreen } from '@/components/AppErrorBoundary';

// Expo Router renders this instead of the layout if anything below throws.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen error={error} context="Route error" onRetry={retry} />;
}

export default function RootLayout() {
  const [dbError, setDbError] = useState<Error | null>(() => getDatabaseInitError());

  useEffect(() => {
    let mounted = true;
    const initializeApp = async () => {
      try {
        const initErr = getDatabaseInitError();
        if (initErr) {
          if (mounted) setDbError(initErr);
          return;
        }
        if (!(database instanceof Database)) {
          if (mounted) {
            setDbError(new Error(`[WatermelonDB] Invalid database instance: ${String(database)}`));
          }
          return;
        }

        // Verify database is readable (an empty database with 0 groups is completely valid)
        await database.get('groups').query().fetchCount();

        // Initialize device ID in background safely
        try {
          await getOrCreateDeviceId();
        } catch (deviceErr) {
          console.warn('[ValorTrip] SecureStore device ID warning:', deviceErr);
        }
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        reportError(errorObj, 'Database initialization', { fatal: false, alert: false });
        if (mounted) {
          setDbError(errorObj);
        }
      }
    };

    initializeApp();
    return () => {
      mounted = false;
    };
  }, [dbError]);

  if (dbError || !(database instanceof Database)) {
    const errorToShow =
      dbError ?? new Error('Database failed to initialize.');
    return (
      <ErrorScreen
        error={errorToShow}
        context="Database initialization error"
        onRetry={() => {
          try {
            retryDatabaseInit();
            setDbError(getDatabaseInitError());
          } catch (e) {
            setDbError(e instanceof Error ? e : new Error(String(e)));
          }
        }}
      />
    );
  }

  return (
    <DatabaseProvider database={database}>
      {/* Inline style is a fallback: if className fails, the Stack must not collapse to 0 height */}
      <View className="flex-1 bg-surface-950" style={{ flex: 1, backgroundColor: '#0d0d17' }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#11111b' },
            headerTintColor: '#ffffff',
            headerTitleStyle: { fontWeight: '700', fontSize: 18 },
            contentStyle: { backgroundColor: '#11111b' },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen
            name="index"
            options={{ title: 'ValorTrip', headerLargeTitle: true }}
          />
          <Stack.Screen
            name="create-group"
            options={{ title: 'New Trip', presentation: 'modal' }}
          />
          <Stack.Screen
            name="join-group"
            options={{ title: 'Scan QR', presentation: 'modal' }}
          />
          <Stack.Screen
            name="group/[id]"
            options={{ title: 'Trip' }}
          />
          <Stack.Screen
            name="add-expense"
            options={{ title: 'Add Expense', presentation: 'modal' }}
          />
          <Stack.Screen
            name="edit-expense"
            options={{ title: 'Edit Expense', presentation: 'modal' }}
          />
          <Stack.Screen
            name="members"
            options={{ title: 'Members' }}
          />
          <Stack.Screen
            name="settle"
            options={{ title: 'Settle Up' }}
          />
          <Stack.Screen
            name="close-trip"
            options={{ title: 'Close Trip', presentation: 'modal' }}
          />
          <Stack.Screen
            name="share-snapshot"
            options={{ title: 'Share Snapshot', presentation: 'modal' }}
          />
        </Stack>
      </View>
    </DatabaseProvider>
  );
}
