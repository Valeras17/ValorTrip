import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { database, Member } from '@/db';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMoney } from '@/lib/money';
import {
  computeGroupBalance,
  recordSettlementsBatch,
} from '@/features/settlement/settlementActions';
import { NetResult, Transfer } from '@/lib/balance';

export default function SettleScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [nets, setNets] = useState<NetResult[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const grp = await database.get<any>('groups').find(groupId);
      setCurrency(grp.currency ?? 'USD');

      const mems = await database
        .get<Member>('members')
        .query(Q.where('group_id', groupId))
        .fetch();
      setMembers(mems);

      const { nets: n, transfers: t } = await computeGroupBalance(groupId);
      setNets(n);
      setTransfers(t);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  const handleRecordAll = async () => {
    if (transfers.length === 0) return;
    Alert.alert(
      'Record All Transfers',
      `Record ${transfers.length} transfer(s) as settlements?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Record All',
          onPress: async () => {
            setRecording(true);
            try {
              await recordSettlementsBatch(groupId, transfers);
              await loadData();
              Alert.alert('✅ Done', 'All transfers recorded!');
            } catch (err) {
              Alert.alert('Error', String(err));
            } finally {
              setRecording(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center">
        <Text className="text-slate-400">Calculating...</Text>
      </View>
    );
  }

  const allSettled = nets.every((n) => n.net === 0);

  return (
    <View className="flex-1 bg-surface-950">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Balance overview */}
        <View className="px-4 py-3">
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Current Balance
          </Text>
          {nets.map((n) => {
            const name = memberName(n.memberId);
            const isPos = n.net > 0;
            const isZero = n.net === 0;
            return (
              <Card key={n.memberId} className="mb-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-8 h-8 rounded-full bg-brand-500/20 items-center justify-center mr-2.5">
                      <Text className="text-brand-300 font-bold text-sm">
                        {name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-medium">{name}</Text>
                      <Text className="text-slate-400 text-xs mt-0.5">
                        Paid: {formatMoney(n.totalPaid ?? 0, currency)} · Share: {formatMoney(n.totalShare ?? 0, currency)}
                      </Text>
                    </View>
                  </View>
                  <Text
                    className={[
                      'font-bold text-base',
                      isZero
                        ? 'text-slate-400'
                        : isPos
                        ? 'text-accent-400'
                        : 'text-danger-400',
                    ].join(' ')}
                  >
                    {isPos ? '+' : ''}{formatMoney(n.net, currency)}
                  </Text>
                </View>
              </Card>
            );
          })}
        </View>

        {/* Transfers */}
        <View className="px-4 mt-2">
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Minimum Transfers ({transfers.length})
          </Text>

          {transfers.length === 0 ? (
            <View className="items-center py-8">
              <Text className="text-5xl mb-3">🎉</Text>
              <Text className="text-white font-bold text-xl mb-1">All settled!</Text>
              <Text className="text-slate-400 text-sm">
                Everyone's balance is zero.
              </Text>
            </View>
          ) : (
            <>
              {transfers.map((t, i) => (
                <Card key={i} className="mb-2">
                  <View className="flex-row items-center">
                    <View className="flex-1">
                      <Text className="text-white font-semibold">
                        {memberName(t.from)}
                      </Text>
                      <Text className="text-slate-400 text-xs">pays</Text>
                    </View>
                    <View className="items-center px-3">
                      <Text className="text-brand-400 font-bold text-lg">
                        {formatMoney(t.amount, currency)}
                      </Text>
                      <Text className="text-slate-500 text-xs">→</Text>
                    </View>
                    <View className="flex-1 items-end">
                      <Text className="text-white font-semibold">
                        {memberName(t.to)}
                      </Text>
                      <Text className="text-slate-400 text-xs">receives</Text>
                    </View>
                  </View>
                </Card>
              ))}

              <View className="mt-2">
                <Button
                  label="✅ Record All as Settled"
                  variant="accent"
                  fullWidth
                  loading={recording}
                  onPress={handleRecordAll}
                />
              </View>
            </>
          )}
        </View>

        {/* Share / snapshot */}
        <View className="px-4 mt-4">
          <Button
            label="📤 Share Snapshot"
            variant="secondary"
            fullWidth
            onPress={() =>
              router.push({ pathname: '/share-snapshot', params: { groupId } })
            }
          />
        </View>

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
