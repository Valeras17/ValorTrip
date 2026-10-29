import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { withObservables } from '@nozbe/watermelondb/react';
import { database, Group, Member, Expense, Settlement } from '@/db';
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
  isClosed: boolean;
  revision: number;
  onConfirm?: (expenseId: string) => void;
  onEdit?: (expenseId: string) => void;
}

function ExpenseCard({
  expense,
  members,
  currency,
  isOwner,
  isClosed,
  revision,
  onConfirm,
  onEdit,
}: ExpenseCardProps) {
  const [payers, setPayers] = useState<{ name: string; amount: number }[]>([]);
  const [shares, setShares] = useState<{ name: string; amount: number }[]>([]);
  const [confirmedMemberIds, setConfirmedMemberIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    const loadCardDetails = () => {
      expense.payers.fetch().then((ps) => {
        if (!active) return;
        const list = ps
          .filter((p) => p.amount > 0)
          .map((p) => ({
            name: members.find((m) => m.id === p.memberId)?.name ?? '?',
            amount: p.amount,
          }));
        setPayers(list);
      });
      expense.shares.fetch().then((ss) => {
        if (!active) return;
        const list = ss
          .filter((s) => s.amount > 0)
          .map((s) => ({
            name: members.find((m) => m.id === s.memberId)?.name ?? '?',
            amount: s.amount,
          }));
        setShares(list);
      });
      expense.confirmations.fetch().then((cs) => {
        if (!active) return;
        setConfirmedMemberIds(
          cs.filter((c) => c.isConfirmed).map((c) => c.memberId)
        );
      });
    };

    loadCardDetails();

    const sub = database
      .withChangesForTables(['confirmations', 'payers', 'shares'])
      .subscribe(() => {
        loadCardDetails();
      });

    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [expense, members, revision]);

  const confirmedSet = new Set(confirmedMemberIds);
  const relevantMembers = members.filter(
    (m) => m.isActive || confirmedSet.has(m.id)
  );
  const confirmedNames = relevantMembers
    .filter((m) => confirmedSet.has(m.id))
    .map((m) => `✅ ${m.name}`);
  const pendingNames = relevantMembers
    .filter((m) => !confirmedSet.has(m.id))
    .map((m) => `⏳ ${m.name}`);
  const confirmationStatusText =
    [...confirmedNames, ...pendingNames].join(', ') || 'No participants';

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

      {/* Shares breakdown */}
      {shares.length > 0 && (
        <View className="mt-2 pt-2 border-t border-white/5">
          <Text className="text-slate-400 text-xs mb-1">📊 Shares:</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {shares.map((s, i) => (
              <View
                key={i}
                className="bg-surface-900 border border-white/10 rounded-lg px-2 py-0.5"
              >
                <Text className="text-slate-300 text-xs">
                  {s.name}: <Text className="text-white font-semibold">{formatMoney(s.amount, currency)}</Text>
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Confirmations + actions */}
      <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-white/5">
        <View className="flex-1 mr-2">
          <Text className="text-slate-300 text-xs leading-5">
            {confirmationStatusText}
          </Text>
        </View>
        {!isClosed && (
          <View className="flex-row gap-2">
            {isOwner && (
              <TouchableOpacity
                onPress={() => onEdit?.(expense.id)}
                className="bg-surface-900 border border-white/10 rounded-lg px-2.5 py-1"
              >
                <Text className="text-slate-300 text-xs font-medium">✏️ Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => onConfirm?.(expense.id)}
              className="bg-brand-500/20 rounded-lg px-3 py-1"
            >
              <Text className="text-brand-300 text-xs font-medium">Show to verify</Text>
            </TouchableOpacity>
          </View>
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
                <Text className="text-slate-400 text-[10px] mt-0.5">
                  Paid: {formatMoney(n.totalPaid ?? 0, currency)} · Share: {formatMoney(n.totalShare ?? 0, currency)}
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
  groups: Group[];
  members: Member[];
  expenses: Expense[];
  settlements?: Settlement[];
}

function GroupDetailInner({ groups, members, expenses, settlements }: GroupDetailProps) {
  const group = groups?.[0];
  const groupId = group?.id ?? '';
  const [nets, setNets] = useState<NetResult[]>([]);
  const [revision, setRevision] = useState(0);

  const refreshBalances = useCallback(() => {
    if (!groupId) return;
    computeGroupBalance(groupId)
      .then(({ nets: calculatedNets }) => {
        setNets(calculatedNets);
        setRevision((r) => r + 1);
      })
      .catch(console.error);
  }, [groupId]);

  useEffect(() => {
    refreshBalances();
  }, [refreshBalances, members, expenses, settlements]);

  useFocusEffect(
    useCallback(() => {
      refreshBalances();
    }, [refreshBalances])
  );

  useEffect(() => {
    if (!groupId) return;
    const sub = database
      .withChangesForTables([
        'expenses',
        'payers',
        'shares',
        'confirmations',
        'settlements',
        'members',
      ])
      .subscribe(() => {
        refreshBalances();
      });
    return () => sub.unsubscribe();
  }, [groupId, refreshBalances]);

  if (!group) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center p-6">
        <EmptyState
          emoji="🗺️"
          title="Trip not found"
          subtitle="This trip has not been saved to the local database yet."
        />
        <Button
          label="← Back to Home"
          variant="secondary"
          onPress={() => router.replace('/')}
        />
      </View>
    );
  }

  const handleConfirm = (expenseId: string) => {
    router.push({
      pathname: '/add-expense',
      params: { groupId: group.id, confirmExpenseId: expenseId },
    });
  };

  const handleEdit = (expenseId: string) => {
    router.push({
      pathname: '/edit-expense',
      params: { groupId: group.id, expenseId },
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
                isClosed={group.isClosed}
                revision={revision}
                onConfirm={handleConfirm}
                onEdit={handleEdit}
              />
            ))}
            <View className="h-8" />
          </>
        )}
      </ScrollView>

      {/* Actions bottom bar */}
      {!group.isClosed && (
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
          {group.isOwner && (
            <Button
              label="🔒 Close Trip"
              variant="ghost"
              size="sm"
              onPress={() =>
                router.push({ pathname: '/close-trip', params: { groupId: group.id } })
              }
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}
    </View>
  );
}

// WatermelonDB reactive wrapper (uses query instead of findAndObserve to prevent "Record groups#... not found" crash)
const WrappedGroupDetail = withObservables(['id'], ({ id }: { id: string }) => ({
  groups: database
    .get<Group>('groups')
    .query(Q.where('id', id))
    .observe(),
  members: database
    .get<Member>('members')
    .query(Q.where('group_id', id))
    .observe(),
  expenses: database
    .get<Expense>('expenses')
    .query(Q.where('group_id', id), Q.sortBy('created_at', Q.desc))
    .observe(),
  settlements: database
    .get<Settlement>('settlements')
    .query(Q.where('group_id', id))
    .observe(),
}))(GroupDetailInner as any);

function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  return <WrappedGroupDetail id={id} />;
}

export default GroupDetailScreen;
