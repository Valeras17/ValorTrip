import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  buildGroupSnapshot,
} from '@/features/snapshot/snapshotActions';
import {
  encodeSnapshot,
  makeSnapshotUrl,
  snapshotByteSize,
  QR_SIZE_LIMIT_BYTES,
  GroupSnapshot,
} from '@/lib/snapshot';

export default function ShareSnapshotScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [snapshot, setSnapshot] = useState<GroupSnapshot | null>(null);
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [byteSize, setByteSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    generateSnapshot();
  }, [groupId]);

  const generateSnapshot = async () => {
    setLoading(true);
    try {
      const snap = await buildGroupSnapshot(groupId);
      const url = makeSnapshotUrl(snap);
      const size = snapshotByteSize(snap);
      setSnapshot(snap);
      setSnapshotUrl(url);
      setByteSize(size);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleShareFile = async () => {
    if (!snapshot) return;
    setSharing(true);
    try {
      const json = JSON.stringify(snapshot, null, 2);
      const fileName = `valortrip-${snapshot.groupName.replace(/\s+/g, '_')}-${Date.now()}.json`;
      const fileUri = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, json, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Share ValorTrip Snapshot',
      });
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center">
        <Text className="text-slate-400">Generating snapshot...</Text>
      </View>
    );
  }

  const tooBig = byteSize > QR_SIZE_LIMIT_BYTES;

  return (
    <View className="flex-1 bg-surface-950">
      <ScrollView className="flex-1 p-4" contentContainerStyle={{ alignItems: 'center' }}>
        <Text className="text-white text-xl font-bold mb-1 self-start">
          Share Snapshot
        </Text>
        <Text className="text-slate-400 text-sm mb-6 self-start">
          Members scan this to get the latest view of expenses and balances.
        </Text>

        {!tooBig ? (
          <Card className="items-center p-6 mb-4 w-full">
            <View className="bg-white p-4 rounded-2xl">
              <QRCode value={snapshotUrl} size={240} />
            </View>
            <View className="mt-3 flex-row items-center gap-2">
              <Text className="text-slate-400 text-xs">
                {byteSize} bytes
              </Text>
              <View className="bg-accent-500/20 rounded-full px-2 py-0.5">
                <Text className="text-accent-400 text-xs">QR OK</Text>
              </View>
            </View>
            <Text className="text-slate-500 text-xs mt-1 text-center">
              Snapshot at {snapshot ? new Date(snapshot.snapshotAt).toLocaleString() : ''}
            </Text>
          </Card>
        ) : (
          <Card className="mb-4 border-warning-500/30 w-full">
            <Text className="text-warning-400 font-semibold mb-2">
              ⚠️ Snapshot too large for QR
            </Text>
            <Text className="text-slate-300 text-sm mb-1">
              {byteSize} bytes (limit: {QR_SIZE_LIMIT_BYTES})
            </Text>
            <Text className="text-slate-400 text-sm">
              Share the file instead. The recipient imports it via the app.
            </Text>
          </Card>
        )}

        {snapshot && (
          <Card className="mb-4 w-full">
            <Text className="text-slate-400 text-xs mb-1">Snapshot includes</Text>
            <Text className="text-white text-sm">
              👥 {snapshot.members.length} members{'\n'}
              🧾 {snapshot.expenses.length} expenses{'\n'}
              💸 {snapshot.settlements.length} settlements{'\n'}
              ✅ {snapshot.confirmations.filter((c) => c.isConfirmed).length} confirmations
            </Text>
          </Card>
        )}

        <View className="w-full gap-2">
          <Button
            label="📤 Share as File"
            variant="secondary"
            fullWidth
            loading={sharing}
            onPress={handleShareFile}
          />
          <Button
            label="🔄 Regenerate"
            variant="ghost"
            fullWidth
            onPress={generateSnapshot}
          />
          <Button
            label="Done"
            variant="ghost"
            fullWidth
            onPress={() => router.dismiss()}
          />
        </View>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
