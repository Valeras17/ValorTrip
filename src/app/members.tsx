import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { database, Member } from '@/db';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMoney } from '@/lib/money';
import { addMemberToGroup, closeMember, returnMember } from '@/features/groups/groupActions';
import { computeGroupBalance } from '@/features/settlement/settlementActions';
import { recordSettlement } from '@/features/settlement/settlementActions';

export default function MembersScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [members, setMembers] = useState<Member[]>([]);
  const [nets, setNets] = useState<Record<string, number>>({});
  const [currency, setCurrency] = useState('USD');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    loadData();
  }, [groupId, refreshKey]);

  const loadData = async () => {
    const grp = await database.get<any>('groups').find(groupId);
    setCurrency(grp.currency ?? 'USD');
    setIsOwner(grp.isOwner ?? false);

    const mems = await database
      .get<Member>('members')
      .query(Q.where('group_id', groupId))
      .fetch();
    setMembers(mems);

    const { nets: netResults } = await computeGroupBalance(groupId);
    const netMap: Record<string, number> = {};
    for (const n of netResults) {
      netMap[n.memberId] = n.net;
    }
    setNets(netMap);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      await addMemberToGroup(groupId, newName.trim());
      setNewName('');
      refresh();
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = (member: Member) => {
    const net = nets[member.id] ?? 0;
    if (net === 0) {
      Alert.alert(
        'Close Member',
        `${member.name} has zero balance. Close them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Close',
            onPress: async () => {
              await closeMember(member.id);
              refresh();
            },
          },
        ]
      );
    } else {
      // Has debt — need to settle first
      const direction = net > 0 ? 'is owed' : 'owes';
      const amount = formatMoney(Math.abs(net), currency);
      Alert.alert(
        'Settle Before Closing',
        `${member.name} ${direction} ${amount}. Record a settlement first?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Record & Close',
            onPress: async () => {
              // Find who they owe / who owes them
              // Simplified: just record the settlement and close
              Alert.prompt(
                'Settlement Note',
                'Add a note (optional)',
                async (note) => {
                  if (net < 0) {
                    // member owes — need to find creditor
                    // For now: create a manual settlement
                    Alert.alert('Manual Settlement', 'Please use the Settle screen to record the specific transfer, then close this member.');
                  } else {
                    // member is owed
                    Alert.alert('Manual Settlement', 'Please use the Settle screen to record the specific transfer, then close this member.');
                  }
                },
                'plain-text',
              );
            },
          },
        ]
      );
    }
  };

  const handleReturn = async (member: Member) => {
    Alert.alert(
      'Return Member',
      `${member.name} is returning to the trip. Their past shares and settlements stay intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Return',
          onPress: async () => {
            await returnMember(member.id);
            refresh();
          },
        },
      ]
    );
  };

  const activeMembers = members.filter((m) => m.isActive);
  const inactiveMembers = members.filter((m) => !m.isActive);

  return (
    <View className="flex-1 bg-surface-950">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {isOwner && (
          <View className="p-4">
            <Card title="Add Member">
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Field
                    label=""
                    placeholder="Member name"
                    value={newName}
                    onChangeText={setNewName}
                  />
                </View>
                <Button
                  label="Add"
                  variant="primary"
                  size="sm"
                  loading={loading}
                  onPress={handleAdd}
                />
              </View>
            </Card>
          </View>
        )}

        {/* Active members */}
        <View className="px-4">
          <Text className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">
            Active ({activeMembers.length})
          </Text>
          {activeMembers.map((m) => {
            const net = nets[m.id] ?? 0;
            return (
              <MemberRow
                key={m.id}
                member={m}
                net={net}
                currency={currency}
                isOwner={isOwner}
                isActive
                onClose={() => handleClose(m)}
              />
            );
          })}

          {activeMembers.length === 0 && (
            <EmptyState emoji="👤" title="No members yet" />
          )}
        </View>

        {/* Inactive members */}
        {inactiveMembers.length > 0 && (
          <View className="px-4 mt-4">
            <Text className="text-slate-400 text-xs font-semibold uppercase tracking-widest mb-3">
              Left the Trip ({inactiveMembers.length})
            </Text>
            {inactiveMembers.map((m) => {
              const net = nets[m.id] ?? 0;
              return (
                <MemberRow
                  key={m.id}
                  member={m}
                  net={net}
                  currency={currency}
                  isOwner={isOwner}
                  isActive={false}
                  onReturn={() => handleReturn(m)}
                />
              );
            })}
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </View>
  );
}

function MemberRow({
  member,
  net,
  currency,
  isOwner,
  isActive,
  onClose,
  onReturn,
}: {
  member: Member;
  net: number;
  currency: string;
  isOwner: boolean;
  isActive: boolean;
  onClose?: () => void;
  onReturn?: () => void;
}) {
  const netColor =
    net > 0 ? 'text-accent-400' : net < 0 ? 'text-danger-400' : 'text-slate-400';

  return (
    <Card className="mb-2">
      <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-full bg-brand-500/20 items-center justify-center mr-3">
          <Text className="text-brand-300 font-bold text-base">
            {member.name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-white font-semibold">{member.name}</Text>
            {member.isOwner && (
              <View className="bg-brand-500/20 rounded-full px-2 py-0.5">
                <Text className="text-brand-300 text-xs">Bookkeeper</Text>
              </View>
            )}
          </View>
          <Text className={['text-sm font-medium', netColor].join(' ')}>
            {net > 0
              ? `+${formatMoney(net, currency)} owed to them`
              : net < 0
              ? `${formatMoney(net, currency)} owes`
              : 'Settled up ✓'}
          </Text>
        </View>

        {isOwner && !member.isOwner && (
          <View>
            {isActive ? (
              <TouchableOpacity
                onPress={onClose}
                className="bg-danger-500/20 rounded-lg px-3 py-1.5"
              >
                <Text className="text-danger-400 text-xs font-medium">Close</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={onReturn}
                className="bg-accent-500/20 rounded-lg px-3 py-1.5"
              >
                <Text className="text-accent-400 text-xs font-medium">Return</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Card>
  );
}
