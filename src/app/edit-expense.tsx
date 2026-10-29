import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity, Switch } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Q } from '@nozbe/watermelondb';
import { database, Member, Expense } from '@/db';
import { Button } from '@/components/ui/Button';
import { Field, AmountField } from '@/components/ui/Field';
import { Card } from '@/components/ui/Card';
import {
  parseToCents,
  formatMoney,
  calcTip,
  splitEqually,
  validateExpense,
  type TipMode,
} from '@/lib/money';
import { updateExpense } from '@/features/expenses/expenseActions';

const CATEGORIES = [
  '🍽️ Food', '🍺 Drinks', '🏨 Hotel', '🚗 Transport',
  '🎭 Fun', '🛒 Shopping', '⛽ Gas', '✈️ Flight', '💊 Medical', '🎰 Other',
];

const TIP_OPTIONS: { label: string; value: TipMode }[] = [
  { label: 'No tip', value: 'none' },
  { label: '5%', value: '5' },
  { label: '10%', value: '10' },
  { label: '15%', value: '15' },
  { label: 'Custom', value: 'custom' },
];

export default function EditExpenseScreen() {
  const { expenseId, groupId } = useLocalSearchParams<{
    expenseId: string;
    groupId: string;
  }>();

  const [loaded, setLoaded] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('🍽️ Food');
  const [subtotalStr, setSubtotalStr] = useState('');
  const [tipMode, setTipMode] = useState<TipMode>('none');
  const [customTipStr, setCustomTipStr] = useState('');
  const [payers, setPayers] = useState<{ memberId: string; amountStr: string }[]>([]);
  const [shareMode, setShareMode] = useState<'equal' | 'custom'>('equal');
  const [shares, setShares] = useState<{ memberId: string; amountStr: string; isAuto?: boolean }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const subtotal = parseToCents(subtotalStr);
  const tipCents = calcTip(subtotal, tipMode, parseToCents(customTipStr));
  const total = subtotal + tipCents;

  useEffect(() => {
    loadData();
  }, [expenseId, groupId]);

  const loadData = async () => {
    try {
      const grp = await database.get<any>('groups').find(groupId);
      setCurrency(grp.currency ?? 'USD');

      const mems = await database
        .get<Member>('members')
        .query(Q.where('group_id', groupId))
        .fetch();
      setMembers(mems);

      const expense = await database.get<Expense>('expenses').find(expenseId);
      setTitle(expense.title);
      setCategory(expense.category);
      setSubtotalStr((expense.subtotal / 100).toFixed(2));

      // Determine tip
      const tipRatio = expense.subtotal > 0 ? expense.tipAmount / expense.subtotal : 0;
      if (expense.tipAmount === 0) setTipMode('none');
      else if (Math.abs(tipRatio - 0.05) < 0.001) setTipMode('5');
      else if (Math.abs(tipRatio - 0.10) < 0.001) setTipMode('10');
      else if (Math.abs(tipRatio - 0.15) < 0.001) setTipMode('15');
      else {
        setTipMode('custom');
        setCustomTipStr((expense.tipAmount / 100).toFixed(2));
      }

      const existingPayers = await expense.payers.fetch();
      setPayers(
        mems.map((m) => {
          const p = existingPayers.find((ep) => ep.memberId === m.id);
          return { memberId: m.id, amountStr: p ? (p.amount / 100).toFixed(2) : '' };
        })
      );

      const existingShares = await expense.shares.fetch();
      setShares(
        mems.map((m) => {
          const s = existingShares.find((es) => es.memberId === m.id);
          return {
            memberId: m.id,
            amountStr: s ? (s.amount / 100).toFixed(2) : '',
            isAuto: false,
          };
        })
      );

      // Detect custom vs equal shares
      const activeMems = mems.filter((m) => m.isActive);
      const equalAmounts = splitEqually(expense.totalAmount, activeMems.length);
      const isExactlyEqual =
        existingShares.length === activeMems.length &&
        activeMems.every((m, idx) => {
          const found = existingShares.find((s) => s.memberId === m.id);
          return found && found.weight === 1 && found.amount === equalAmounts[idx];
        });
      setShareMode(isExactlyEqual ? 'equal' : 'custom');
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoaded(true);
    }
  };

  if (!loaded) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center">
        <Text className="text-slate-400">Loading...</Text>
      </View>
    );
  }

  const visibleMembers = showInactive ? members : members.filter((m) => m.isActive);
  const visibleMemberIds = new Set(visibleMembers.map((m) => m.id));

  const handleShareAmountChange = (editedMemberId: string, text: string) => {
    setShares((prev) => {
      const base = visibleMembers.map((m) => {
        if (m.id === editedMemberId) {
          return { memberId: m.id, amountStr: text, isAuto: false };
        }
        const existing = prev.find((s) => s.memberId === m.id);
        return existing ?? { memberId: m.id, amountStr: '', isAuto: false };
      });

      const manualItems = base.filter(
        (s) => !s.isAuto && s.amountStr.trim() !== ''
      );
      const hasPositiveManual = manualItems.some(
        (s) => parseToCents(s.amountStr) > 0
      );

      if (!hasPositiveManual) {
        return base.map((s) =>
          s.isAuto ? { ...s, amountStr: '', isAuto: false } : s
        );
      }

      const manualSum = manualItems.reduce(
        (sum, s) => sum + parseToCents(s.amountStr),
        0
      );
      const remainder = total - manualSum;

      const candidates = base.filter(
        (s) =>
          s.memberId !== editedMemberId &&
          (s.isAuto || s.amountStr.trim() === '')
      );

      if (candidates.length === 0) {
        return base;
      }

      const targetId = candidates[0]!.memberId;

      return base.map((s) => {
        if (s.memberId === editedMemberId) return s;
        if (!s.isAuto && s.amountStr.trim() !== '') return s;
        if (s.memberId === targetId && remainder > 0) {
          return {
            ...s,
            amountStr: (remainder / 100).toFixed(2),
            isAuto: true,
          };
        }
        return { ...s, amountStr: '', isAuto: false };
      });
    });
  };

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (subtotal <= 0) e.subtotal = 'Amount must be greater than 0';
    const payerList = payers.filter((p) => visibleMemberIds.has(p.memberId) && parseToCents(p.amountStr) > 0);
    if (payerList.length === 0) e.payers = 'At least one payer is required';
    const payersSum = payerList.reduce((s, p) => s + parseToCents(p.amountStr), 0);
    if (payersSum !== total) {
      e.payers = `Payers sum ${formatMoney(payersSum, currency)} ≠ total ${formatMoney(total, currency)}`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (!validateStep1()) return;
    setStep(2);
  };

  const computedShares =
    shareMode === 'equal'
      ? (() => {
          const amounts = splitEqually(total, visibleMembers.length);
          return visibleMembers.map((m, i) => ({ memberId: m.id, amount: amounts[i]! }));
        })()
      : shares
          .filter((s) => visibleMemberIds.has(s.memberId) && parseToCents(s.amountStr) > 0)
          .map((s) => ({ memberId: s.memberId, amount: parseToCents(s.amountStr) }));

  const sharesSum = computedShares.reduce((s, sh) => s + sh.amount, 0);
  const remainingToAllocate = total - sharesSum;
  const currentPayersSum = payers
    .filter((p) => visibleMemberIds.has(p.memberId) && parseToCents(p.amountStr) > 0)
    .reduce((s, p) => s + parseToCents(p.amountStr), 0);
  const isNextDisabled = !title.trim() || total <= 0 || currentPayersSum !== total;
  const isSaveDisabled = loading || currentPayersSum !== total || sharesSum !== total || total <= 0;

  const handleSave = async () => {
    const payerList = payers
      .filter((p) => visibleMemberIds.has(p.memberId))
      .map((p) => ({ memberId: p.memberId, amount: parseToCents(p.amountStr) }))
      .filter((p) => p.amount > 0);

    let shareList: { memberId: string; weight: number; amount: number }[];
    if (shareMode === 'equal') {
      const active = visibleMembers;
      const amounts = splitEqually(total, active.length);
      shareList = active.map((m, i) => ({ memberId: m.id, weight: 1, amount: amounts[i]! }));
    } else {
      shareList = shares
        .filter((s) => visibleMemberIds.has(s.memberId) && parseToCents(s.amountStr) > 0)
        .map((s) => {
          const amount = parseToCents(s.amountStr);
          return { memberId: s.memberId, weight: amount, amount };
        });
    }

    const payersSum = payerList.reduce((s, p) => s + p.amount, 0);
    const sharesSumVal = shareList.reduce((s, sh) => s + sh.amount, 0);
    const validation = validateExpense(total, payersSum, sharesSumVal);
    if (!validation.valid) {
      Alert.alert('Validation Error', validation.error);
      return;
    }

    Alert.alert(
      'Update Expense',
      'Updating this expense will recalculate balances for all members.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            setLoading(true);
            try {
              await updateExpense(expenseId, {
                groupId,
                title: title.trim(),
                subtotal,
                tipAmount: tipCents,
                totalAmount: total,
                category,
                payers: payerList,
                shares: shareList,
              });
              router.dismiss();
            } catch (err) {
              Alert.alert('Error', String(err));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (step === 1) {
    return (
      <View className="flex-1 bg-surface-950">
        <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
          <View className="flex-row mb-6">
            <View className="flex-1 h-1 bg-brand-500 rounded-full mr-1" />
            <View className="flex-1 h-1 bg-surface-800 rounded-full ml-1" />
          </View>
          <Text className="text-slate-400 text-sm mb-4">
            Step 1 of 2 — Who paid?
          </Text>

          <Field label="Title" value={title} onChangeText={setTitle} error={errors.title} required />

          <View className="mb-4">
            <Text className="text-slate-300 text-sm font-medium mb-1.5">Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    className={['px-3 py-2 rounded-xl border', category === c ? 'bg-brand-500 border-brand-400' : 'bg-surface-800 border-white/10'].join(' ')}
                  >
                    <Text className="text-sm">{c.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <AmountField label={`Subtotal (${currency})`} currency={currency} value={subtotalStr} onChangeText={setSubtotalStr} placeholder="0.00" error={errors.subtotal} required />

          {/* Payers */}
          <Card className="mb-4">
            <Text className="text-white font-semibold mb-1">Who paid?</Text>
            <Text className="text-slate-400 text-xs mb-3">
              Total: {formatMoney(total, currency)}. Tap "Paid all" or enter amounts.
            </Text>
            {errors.payers && <Text className="text-danger-400 text-sm mb-2">{errors.payers}</Text>}

            <View className="flex-row flex-wrap gap-2 mb-3">
              {visibleMembers.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => {
                    setPayers(
                      members.map((mem) => ({
                        memberId: mem.id,
                        amountStr: mem.id === m.id && total > 0 ? (total / 100).toFixed(2) : '0',
                      }))
                    );
                  }}
                  className="bg-surface-900 border border-white/10 rounded-xl px-3 py-1.5"
                >
                  <Text className="text-slate-300 text-xs">{m.name} paid all</Text>
                </TouchableOpacity>
              ))}
            </View>

            {visibleMembers.map((m) => {
              const payer = payers.find((p) => p.memberId === m.id);
              return (
                <View key={m.id} className="flex-row items-center mb-2">
                  <Text className="text-white text-sm flex-1">{m.name}</Text>
                  <View className="w-32">
                    <AmountField label="" currency={currency} placeholder="0.00" value={payer?.amountStr ?? ''} onChangeText={(t) => setPayers((prev) => prev.some((p) => p.memberId === m.id) ? prev.map((p) => p.memberId === m.id ? { ...p, amountStr: t } : p) : [...prev, { memberId: m.id, amountStr: t }])} />
                  </View>
                </View>
              );
            })}

            <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-white/10">
              <Text className="text-slate-400 text-sm">Payers sum</Text>
              <Text
                className={[
                  'font-bold text-sm',
                  total > 0 && currentPayersSum === total ? 'text-accent-400' : 'text-danger-400',
                ].join(' ')}
              >
                {formatMoney(currentPayersSum, currency)} / {formatMoney(total, currency)}
              </Text>
            </View>
          </Card>

          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-slate-400 text-sm">Show inactive members</Text>
            <Switch value={showInactive} onValueChange={setShowInactive} trackColor={{ false: '#374151', true: '#6366f1' }} />
          </View>

          <Button label="Next: Who consumed? →" variant="primary" fullWidth disabled={isNextDisabled} onPress={handleNext} />
          <View className="h-8" />
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-950">
      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        <View className="flex-row mb-6">
          <View className="flex-1 h-1 bg-brand-500 rounded-full mr-1" />
          <View className="flex-1 h-1 bg-brand-500 rounded-full ml-1" />
        </View>
        <Text className="text-slate-400 text-sm mb-4">
          Step 2 of 2 — Who consumed?
        </Text>

        <Card className="mb-4">
          <View className="flex-row justify-between mb-1">
            <Text className="text-white font-semibold">{title}</Text>
            <Text className="text-white font-bold">{formatMoney(total, currency)}</Text>
          </View>
        </Card>

        {/* Share mode */}
        <View className="flex-row mb-4 bg-surface-800 rounded-xl p-1">
          <TouchableOpacity
            className={[
              'flex-1 py-2 rounded-lg items-center',
              shareMode === 'equal' ? 'bg-brand-500' : '',
            ].join(' ')}
            onPress={() => setShareMode('equal')}
          >
            <Text className={shareMode === 'equal' ? 'text-white font-semibold' : 'text-slate-400'}>
              Split equally
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={[
              'flex-1 py-2 rounded-lg items-center',
              shareMode === 'custom' ? 'bg-brand-500' : '',
            ].join(' ')}
            onPress={() => setShareMode('custom')}
          >
            <Text className={shareMode === 'custom' ? 'text-white font-semibold' : 'text-slate-400'}>
              By amount
            </Text>
          </TouchableOpacity>
        </View>

        {shareMode === 'equal' ? (
          <Card className="mb-4">
            {visibleMembers.map((m, i) => {
              const amounts = splitEqually(total, visibleMembers.length);
              return (
                <View key={m.id} className="flex-row justify-between items-center py-2 border-b border-white/5 last:border-b-0">
                  <Text className="text-white text-sm">{m.name}</Text>
                  <Text className="text-accent-400 text-sm font-semibold">
                    {formatMoney(amounts[i]!, currency)}
                  </Text>
                </View>
              );
            })}
          </Card>
        ) : (
          <Card className="mb-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-slate-400 text-xs">
                Sum must equal {formatMoney(total, currency)}
              </Text>
              <TouchableOpacity
                onPress={() =>
                  setShares(
                    visibleMembers.map((m) => ({
                      memberId: m.id,
                      amountStr: '',
                      isAuto: false,
                    }))
                  )
                }
                className="bg-surface-900 border border-white/10 rounded-lg px-2.5 py-1"
              >
                <Text className="text-slate-400 text-xs">Reset</Text>
              </TouchableOpacity>
            </View>
            <View
              className={[
                'flex-row items-center justify-between px-3 py-2 rounded-xl mb-3 border',
                remainingToAllocate === 0
                  ? 'bg-accent-500/15 border-accent-500/30'
                  : remainingToAllocate > 0
                  ? 'bg-brand-500/15 border-brand-500/30'
                  : 'bg-danger-500/15 border-danger-500/30',
              ].join(' ')}
            >
              <Text
                className={[
                  'text-xs font-semibold',
                  remainingToAllocate === 0
                    ? 'text-accent-400'
                    : remainingToAllocate > 0
                    ? 'text-brand-300'
                    : 'text-danger-400',
                ].join(' ')}
              >
                Remaining: {formatMoney(remainingToAllocate, currency)}
              </Text>
              {remainingToAllocate === 0 && (
                <Text className="text-accent-400 text-xs font-semibold">✓ Matched</Text>
              )}
            </View>
            {visibleMembers.map((m) => {
              const share = shares.find((s) => s.memberId === m.id);
              return (
                <View key={m.id} className="flex-row items-center mb-2">
                  <View className="flex-1 flex-row items-center mr-2">
                    <Text className="text-white text-sm">{m.name}</Text>
                    {share?.isAuto && (
                      <View className="ml-2 bg-brand-500/20 border border-brand-500/40 rounded-md px-1.5 py-0.5">
                        <Text className="text-brand-300 text-[10px] font-medium">auto</Text>
                      </View>
                    )}
                  </View>
                  <View className="w-32">
                    <AmountField
                      label=""
                      currency={currency}
                      placeholder="0.00"
                      value={share?.amountStr ?? ''}
                      onChangeText={(t) => handleShareAmountChange(m.id, t)}
                    />
                  </View>
                </View>
              );
            })}
            <View className="flex-row justify-between items-center mt-2 pt-2 border-t border-white/10">
              <Text className="text-slate-400 text-sm">Total allocated</Text>
              <Text
                className={[
                  'font-bold text-sm',
                  sharesSum === total ? 'text-accent-400' : 'text-danger-400',
                ].join(' ')}
              >
                {formatMoney(sharesSum, currency)} / {formatMoney(total, currency)}
              </Text>
            </View>
          </Card>
        )}

        <View className="flex-row gap-2">
          <Button label="← Back" variant="ghost" onPress={() => setStep(1)} style={{ flex: 1 }} />
          <Button label="💾 Save Changes" variant="primary" loading={loading} disabled={isSaveDisabled} onPress={handleSave} style={{ flex: 1 }} />
        </View>
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
