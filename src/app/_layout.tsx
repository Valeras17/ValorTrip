import 'react-native-get-random-values';
import '@/global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import { database } from '@/db';
import { getOrCreateDeviceId } from '@/lib/id';

export default function RootLayout() {
  useEffect(() => {
    // Initialize device ID on first launch
    getOrCreateDeviceId().catch(console.error);
  }, []);

  return (
    <DatabaseProvider database={database}>
      <View className="flex-1 bg-surface-950">
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
