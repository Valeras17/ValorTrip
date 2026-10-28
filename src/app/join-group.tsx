import React, { useState, useRef } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { parseValortripUrl } from '@/lib/snapshot';
import { addMemberToGroup } from '@/features/groups/groupActions';
import { applySnapshot } from '@/features/snapshot/snapshotActions';

export default function JoinGroupScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    const parsed = parseValortripUrl(data);
    if (!parsed) {
      Alert.alert('Invalid QR', 'This QR code is not a valid ValorTrip code.', [
        { text: 'Try again', onPress: () => setScanned(false) },
      ]);
      return;
    }

    if (parsed.type === 'snapshot') {
      // Apply snapshot directly
      setLoading(true);
      try {
        await applySnapshot(parsed.snapshot);
        Alert.alert('✅ Updated', `Snapshot applied for "${parsed.snapshot.groupName}"`, [
          {
            text: 'View Trip',
            onPress: () => {
              router.dismiss();
              router.push(`/group/${parsed.snapshot.groupId}`);
            },
          },
        ]);
      } catch (err) {
        Alert.alert('Error', String(err));
        setScanned(false);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (parsed.type === 'join') {
      setPendingGroupId(parsed.groupId);
    }
  };

  const handleJoin = async () => {
    if (!pendingGroupId || !memberName.trim()) return;
    setLoading(true);
    try {
      await addMemberToGroup(pendingGroupId, memberName.trim());
      Alert.alert('✅ Joined!', 'You joined the trip as an observer.', [
        {
          text: 'View Trip',
          onPress: () => {
            router.dismiss();
            router.push(`/group/${pendingGroupId}`);
          },
        },
      ]);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoading(false);
    }
  };

  if (!permission) {
    return <View className="flex-1 bg-surface-950" />;
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center p-8">
        <Text className="text-white text-xl font-bold mb-3 text-center">
          Camera Access Required
        </Text>
        <Text className="text-slate-400 text-sm text-center mb-6">
          ValorTrip needs camera access to scan QR codes.
        </Text>
        <Button label="Grant Permission" variant="primary" onPress={requestPermission} />
      </View>
    );
  }

  if (pendingGroupId) {
    return (
      <View className="flex-1 bg-surface-950 p-6">
        <Text className="text-white text-xl font-bold mb-2">What's your name?</Text>
        <Text className="text-slate-400 text-sm mb-6">
          You're joining as an observer. Enter your name so the bookkeeper can identify you.
        </Text>
        <Field
          label="Your Name"
          placeholder="e.g. Maria"
          value={memberName}
          onChangeText={setMemberName}
          required
          autoFocus
        />
        <Button
          label="Join Trip"
          variant="primary"
          fullWidth
          loading={loading}
          disabled={!memberName.trim()}
          onPress={handleJoin}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-950">
      <View className="flex-1 relative">
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />

        {/* Overlay */}
        <View className="flex-1 items-center justify-center">
          <View className="w-64 h-64 border-2 border-brand-400 rounded-2xl" />
          <Text className="text-white text-sm mt-4 text-center px-8">
            Scan a ValorTrip QR code{'\n'}(invite or snapshot)
          </Text>
        </View>
      </View>

      <View className="p-4">
        <Button
          label="Cancel"
          variant="ghost"
          fullWidth
          onPress={() => router.dismiss()}
        />
      </View>
    </View>
  );
}
