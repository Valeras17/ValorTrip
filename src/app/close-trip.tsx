import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { database, Member } from '@/db';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { computeGroupBalance } from '@/features/settlement/settlementActions';
import { closeTrip } from '@/features/groups/groupActions';
import { formatMoney } from '@/lib/money';

export default function CloseTripScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [checks, setChecks] = useState({
    noLeftWithDebt: false,
    allTransfersRecorded: false,
  });
  const [issues, setIssues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    runChecks();
  }, [groupId]);

  const runChecks = async () => {
    setLoading(true);
    try {
      const grp = await database.get<any>('groups').find(groupId);
      setCurrency(grp.currency ?? 'USD');

      const members = await database
        .get<Member>('members')
        .query(Q.where('group_id', groupId))
        .fetch();

      const { nets, transfers } = await computeGroupBalance(groupId);

      const foundIssues: string[] = [];

      // Check: no inactive member with net ≠ 0
      const leftWithDebt = members.filter((m) => {
        if (m.isActive) return false;
        const net = nets.find((n) => n.memberId === m.id)?.net ?? 0;
        return net !== 0;
      });

      if (leftWithDebt.length > 0) {
        foundIssues.push(
          `Members who left with unpaid balance: ${leftWithDebt
            .map((m) => {
              const net = nets.find((n) => n.memberId === m.id)?.net ?? 0;
              return `${m.name} (${formatMoney(Math.abs(net), currency)})`;
            })
            .join(', ')}`
        );
      }

      // Check: all pending transfers recorded
      if (transfers.length > 0) {
        foundIssues.push(
          `${transfers.length} transfer(s) still not recorded as settlements`
        );
      }

      setIssues(foundIssues);
      setChecks({
        noLeftWithDebt: leftWithDebt.length === 0,
        allTransfersRecorded: transfers.length === 0,
      });
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoading(false);
    }
  };

  const canClose = checks.noLeftWithDebt && checks.allTransfersRecorded;

  const handleClose = async () => {
    Alert.alert(
      '🔒 Close Trip',
      'This trip will become read-only. No more expenses can be added. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Trip',
          style: 'destructive',
          onPress: async () => {
            setClosing(true);
            try {
              await closeTrip(groupId);
              router.dismiss();
              router.replace(`/group/${groupId}`);
            } catch (err) {
              Alert.alert('Error', String(err));
            } finally {
              setClosing(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center">
        <Text className="text-slate-400">Running checks...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-950 p-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-white text-xl font-bold mb-2">Close Trip Checklist</Text>
        <Text className="text-slate-400 text-sm mb-6">
          All checks must pass before the trip can be closed.
        </Text>

        <CheckItem
          label="No departed members with unpaid balance"
          passed={checks.noLeftWithDebt}
        />
        <CheckItem
          label="All settlements recorded"
          passed={checks.allTransfersRecorded}
        />

        {issues.length > 0 && (
          <Card className="mb-4 border-danger-500/30">
            <Text className="text-danger-400 font-semibold mb-2">Issues to resolve:</Text>
            {issues.map((issue, i) => (
              <Text key={i} className="text-slate-300 text-sm mb-1">
                • {issue}
              </Text>
            ))}
            <Button
              label="Go to Settle"
              variant="danger"
              size="sm"
              onPress={() =>
                router.push({ pathname: '/settle', params: { groupId } })
              }
            />
          </Card>
        )}

        {canClose ? (
          <Card className="mb-4 border-accent-500/30">
            <Text className="text-accent-400 font-semibold mb-1">✅ All checks passed!</Text>
            <Text className="text-slate-400 text-sm">
              The trip is ready to be closed.
            </Text>
          </Card>
        ) : null}

        <Button
          label="🔒 Close This Trip"
          variant="danger"
          fullWidth
          disabled={!canClose}
          loading={closing}
          onPress={handleClose}
        />

        <View className="h-4" />
        <Button
          label="Cancel"
          variant="ghost"
          fullWidth
          onPress={() => router.dismiss()}
        />
      </ScrollView>
    </View>
  );
}

function CheckItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <Card className={['mb-3', passed ? 'border-accent-500/30' : 'border-danger-500/30'].join(' ')}>
      <View className="flex-row items-center">
        <Text className={['text-xl mr-3', passed ? '' : ''].join('')}>
          {passed ? '✅' : '❌'}
        </Text>
        <Text className={['text-sm flex-1', passed ? 'text-white' : 'text-slate-300'].join(' ')}>
          {label}
        </Text>
      </View>
    </Card>
  );
}
