import React, { useState } from 'react';
import { View, Text, Alert, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Q } from '@nozbe/watermelondb';
import { database, Group, Member, raw } from '@/db';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { parseValortripUrl, InviteMemberInfo } from '@/lib/snapshot';
import { generateId } from '@/lib/id';
import { applySnapshot } from '@/features/snapshot/snapshotActions';

export default function JoinGroupScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [pendingGroupName, setPendingGroupName] = useState<string | undefined>(undefined);
  const [pendingCurrency, setPendingCurrency] = useState<string | undefined>(undefined);
  const [pendingMembers, setPendingMembers] = useState<InviteMemberInfo[] | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const verifyGroupExistsAndNavigate = async (targetGroupId: string) => {
    try {
      const existingGroup = await database.get<Group>('groups').find(targetGroupId);
      if (!existingGroup) {
        Alert.alert(
          'Group Not Found',
          'The trip could not be found in the local database. Please scan the QR code again.'
        );
        return;
      }
      router.replace(`/group/${targetGroupId}`);
    } catch {
      Alert.alert(
        'Group Not Found',
        'The trip could not be found in the local database. Please scan the QR code again.'
      );
    }
  };

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
      // Apply snapshot directly and verify group exists in DB before navigating
      setLoading(true);
      try {
        await applySnapshot(parsed.snapshot);

        // Verify the group is actually persisted in WatermelonDB
        let savedGroup: Group | null = null;
        try {
          savedGroup = await database.get<Group>('groups').find(parsed.snapshot.groupId);
        } catch {
          savedGroup = null;
        }

        if (!savedGroup) {
          Alert.alert(
            'Error',
            'Failed to save the trip into the local database. Please try scanning again.',
            [{ text: 'Try again', onPress: () => setScanned(false) }]
          );
          return;
        }

        Alert.alert('✅ Updated', `Snapshot applied for "${parsed.snapshot.groupName}"`, [
          {
            text: 'View Trip',
            onPress: () => {
              verifyGroupExistsAndNavigate(parsed.snapshot.groupId);
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
      setPendingGroupName(parsed.groupName);
      setPendingCurrency(parsed.currency);
      setPendingMembers(parsed.members);
    }
  };

  const handleJoin = async () => {
    if (!pendingGroupId || !memberName.trim()) return;
    setLoading(true);
    try {
      const targetGroupId = pendingGroupId;
      const trimmedName = memberName.trim();

      // 1. Check if the group already exists in the local database.
      // 2. If not, create an empty group with this ID (never overwrite existing group data).
      // 3. Add any non-existing invite members + the current user into `members` of this group using await database.write.
      await database.write(async () => {
        let existingGroup: Group | null = null;
        try {
          existingGroup = await database.get<Group>('groups').find(targetGroupId);
        } catch {
          existingGroup = null;
        }

        const now = Date.now();
        if (!existingGroup) {
          await database.get<Group>('groups').create((g) => {
            g._raw.id = targetGroupId;
            g.name = pendingGroupName?.trim() || 'Shared Trip';
            g.currency = pendingCurrency?.trim() || 'USD';
            g.ownerDeviceId = 'remote';
            g.isOwner = false;
            g.isClosed = false;
            raw(g).created_at = now;
            raw(g).updated_at = now;
          });
        }

        const existingGroupMembers = await database
          .get<Member>('members')
          .query(Q.where('group_id', targetGroupId))
          .fetch();

        const knownNames = new Set(
          existingGroupMembers.map((m) => m.name.trim().toLowerCase())
        );

        // If the invite QR included initial members from the creator, add any that aren't already in the group
        if (pendingMembers && pendingMembers.length > 0) {
          for (const pm of pendingMembers) {
            const pmName = pm.name.trim();
            if (!pmName) continue;
            const lower = pmName.toLowerCase();
            if (!knownNames.has(lower)) {
              knownNames.add(lower);
              await database.get<Member>('members').create((m) => {
                m._raw.id = pm.id || generateId();
                m.groupId = targetGroupId;
                m.name = pmName;
                m.isOwner = Boolean(pm.isOwner);
                raw(m).joined_at = now;
                raw(m).left_at = 0;
                raw(m).returned_at = 0;
                raw(m).created_at = now;
              });
            }
          }
        }

        // Add the current user to `members` of this group if not already present
        if (!knownNames.has(trimmedName.toLowerCase())) {
          await database.get<Member>('members').create((m) => {
            m._raw.id = generateId();
            m.groupId = targetGroupId;
            m.name = trimmedName;
            m.isOwner = false;
            raw(m).joined_at = now;
            raw(m).left_at = 0;
            raw(m).returned_at = 0;
            raw(m).created_at = now;
          });
        }
      });

      // Verify the group record exists in the database before allowing navigation
      let verifiedGroup: Group | null = null;
      try {
        verifiedGroup = await database.get<Group>('groups').find(targetGroupId);
      } catch {
        verifiedGroup = null;
      }

      if (!verifiedGroup) {
        Alert.alert(
          'Error',
          'Could not verify the trip in the local database. Please try again.'
        );
        return;
      }

      Alert.alert('✅ Joined!', 'You joined the trip as an observer.', [
        {
          text: 'View Trip',
          onPress: () => {
            verifyGroupExistsAndNavigate(targetGroupId);
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
