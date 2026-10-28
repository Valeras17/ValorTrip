import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { withObservables } from '@nozbe/watermelondb/react';
import { database, Group, Member, Expense } from '@/db';
import { Button } from '@/components/ui/Button';
import { Card, Divider } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMoney } from '@/lib/money';
import { computeGroupBalance } from '@/features/settlement/settlementActions';
import { NetResult } from '@/lib/balance';

// ── Expense card ─────────────────────────────────────────────────────────────

interface ExpenseCardProps {
  expense: Expense;
  members: Member[];
  currency: string;
  isOwner: boolean;
  onConfirm?: (expenseId: string) => void;
}

function ExpenseCard({ expense, members, currency, isOwner, onConfirm }: ExpenseCardProps) {
  const [payers, setPayers] = useState<{ name: string; amount: number }[]>([]);
  const [confirmCount, setConfirmCount] = useState(0);

  useEffect(() => {
    expense.payers.fetch().then((ps) => {
      const list = ps.map((p) => ({
        name: members.find((m) => m.id === p.memberId)?.name ?? '?',
        amount: p.amount,
      }));
      setPayers(list);
    });
    expense.confirmations.fetch().then((cs) => {
      setConfirmCount(cs.filter((c) => c.isConfirmed).length);
    });
  }, [expense, members]);

  return (
    <Card className="mx-4 mb-3">
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-row items-center flex-1 mr-2">
          <Text className="text-2xl mr-2">{expense.category.split(' ')[0] ?? '💰'}</Text>
          <View className="flex-1">
            <Text className="text-white font-semibold text-base" numberOfLines={1}>
              {expense.title}
            </Text>
            <Text className="text-slate-500 text-xs">
              {expense.createdAt ? new Date(expense.createdAt).toLocaleDateString() : ''}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="text-white font-bold text-lg">
            {formatMoney(expense.totalAmount, currency)}
          </Text>
          {expense.tipAmount > 0 && (
            <Text className="text-slate-500 text-xs">
              +{formatMoney(expense.tipAmount, currency)} tip
            </Text>
          )}
        </View>
      </View>

      <Divider />

      {/* Payers */}
      <View className="mt-2">
        {payers.map((p, i) => (
          <View key={i} className="flex-row justify-between items-center mb-0.5">
            <Text className="text-slate-400 text-sm">💳 {p.name}</Text>
            <Text className="text-slate-300 text-sm font-medium">
              {formatMoney(p.amount, currency)}
            </Text>
          </View>
        ))}
      </View>

      {/* Confirmations + actions */}
      <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-white/5">
        <Text className="text-slate-500 text-xs">
          ✅ {confirmCount} confirmed
        </Text>
        {isOwner && (
          <TouchableOpacity
            onPress={() => onConfirm?.(expense.id)}
            className="bg-brand-500/20 rounded-lg px-3 py-1"
          >
            <Text className="text-brand-300 text-xs font-medium">Show to verify</Text>
          </TouchableOpacity>
        )}
      </View>
    </Card>
  );
}

// ── Balance bar ──────────────────────────────────────────────────────────────

function BalanceBar({
  nets,
  members,
  currency,
}: {
  nets: NetResult[];
  members: Member[];
  currency: string;
}) {
  return (
    <View className="mx-4 mb-3">
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {nets.map((n) => {
            const member = members.find((m) => m.id === n.memberId);
            if (!member) return null;
            const isPos = n.net > 0;
            const isZero = n.net === 0;
            return (
              <View
                key={n.memberId}
                className={[
                  'px-3 py-2 rounded-xl border',
                  isZero
                    ? 'bg-surface-800 border-white/10'
                    : isPos
                    ? 'bg-accent-500/15 border-accent-500/30'
                    : 'bg-danger-500/15 border-danger-500/30',
                ].join(' ')}
              >
                <Text className="text-white text-xs font-semibold" numberOfLines={1}>
                  {member.name}
                </Text>
                <Text
                  className={[
                    'text-sm font-bold mt-0.5',
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
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

// ── Group detail screen ──────────────────────────────────────────────────────

interface GroupDetailProps {
  group: Group;
  members: Member[];
  expenses: Expense[];
}

function GroupDetailInner({ group, members, expenses }: GroupDetailProps) {
  const [nets, setNets] = useState<NetResult[]>([]);

  useEffect(() => {
    computeGroupBalance(group.id)
      .then(({ nets }) => setNets(nets))
      .catch(console.error);
  }, [group.id, expenses]);

  const handleConfirm = (expenseId: string) => {
    router.push({
      pathname: '/add-expense',
      params: { groupId: group.id, confirmExpenseId: expenseId },
    });
  };

  return (
    <View className="flex-1 bg-surface-950">
      {/* Header actions */}
      <View className="flex-row gap-2 px-4 py-3">
        {group.isOwner && !group.isClosed && (
          <Button
            label="+ Expense"
            variant="primary"
            size="sm"
            onPress={() =>
              router.push({ pathname: '/add-expense', params: { groupId: group.id } })
            }
            style={{ flex: 1 }}
          />
        )}
        <Button
          label="Members"
          variant="secondary"
          size="sm"
          onPress={() =>
            router.push({ pathname: '/members', params: { groupId: group.id } })
          }
          style={{ flex: 1 }}
        />
        <Button
          label="Settle"
          variant="accent"
          size="sm"
          onPress={() =>
            router.push({ pathname: '/settle', params: { groupId: group.id } })
          }
          style={{ flex: 1 }}
        />
      </View>

      {/* Observer banner */}
      {!group.isOwner && (
        <View className="mx-4 mb-3 bg-brand-500/10 border border-brand-500/30 rounded-xl px-4 py-3 flex-row items-center">
          <Text className="text-brand-300 flex-1 text-sm">
            👁 Read-only view. Scan a new snapshot to update.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/join-group')}
            className="bg-brand-500/20 rounded-lg px-3 py-1"
          >
            <Text className="text-brand-300 text-xs font-medium">Scan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Closed banner */}
      {group.isClosed && (
        <View className="mx-4 mb-3 bg-slate-700/40 border border-slate-600/30 rounded-xl px-4 py-3">
          <Text className="text-slate-300 text-sm text-center">🔒 This trip is closed</Text>
        </View>
      )}

      {/* Balance bar */}
      {nets.length > 0 && (
        <BalanceBar nets={nets} members={members} currency={group.currency} />
      )}

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {expenses.length === 0 ? (
          <EmptyState
            emoji="🧾"
            title="No expenses yet"
            subtitle={
              group.isOwner
                ? 'Tap "+ Expense" to record the first one.'
                : "The bookkeeper hasn't added any expenses yet."
            }
          />
        ) : (
          <>
            {expenses.map((e) => (
              <ExpenseCard
                key={e.id}
                expense={e}
                members={members}
                currency={group.currency}
                isOwner={group.isOwner && !group.isClosed}
                onConfirm={handleConfirm}
              />
            ))}
            <View className="h-8" />
          </>
        )}
      </ScrollView>

      {/* Owner actions bottom bar */}
      {group.isOwner && !group.isClosed && (
        <View className="px-4 pb-4 pt-2 flex-row gap-2 border-t border-white/5">
          <Button
            label="📤 Snapshot"
            variant="secondary"
            size="sm"
            onPress={() =>
              router.push({ pathname: '/share-snapshot', params: { groupId: group.id } })
            }
            style={{ flex: 1 }}
          />
          <Button
            label="🔒 Close Trip"
            variant="ghost"
            size="sm"
            onPress={() =>
              router.push({ pathname: '/close-trip', params: { groupId: group.id } })
            }
            style={{ flex: 1 }}
          />
        </View>
      )}
    </View>
  );
}

// WatermelonDB reactive wrapper
function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const Wrapped = withObservables(['id'], ({ id }: { id: string }) => ({
    group: database.get<Group>('groups').findAndObserve(id),
    members: database
      .get<Member>('members')
      .query(Q.where('group_id', id))
      .observe(),
    expenses: database
      .get<Expense>('expenses')
      .query(Q.where('group_id', id), Q.sortBy('created_at', Q.desc))
      .observe(),
  }))(GroupDetailInner as any);

  return <Wrapped id={id} />;
}

export default GroupDetailScreen;
