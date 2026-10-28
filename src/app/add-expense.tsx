import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
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
import { createExpense, updateExpense } from '@/features/expenses/expenseActions';
import { confirmExpense } from '@/features/expenses/confirmationActions';

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

export default function AddExpenseScreen() {
  const { groupId, expenseId, confirmExpenseId } = useLocalSearchParams<{
    groupId: string;
    expenseId?: string;
    confirmExpenseId?: string;
  }>();

  const [step, setStep] = useState<1 | 2>(1);
  const [members, setMembers] = useState<Member[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Step 1 fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('🍽️ Food');
  const [subtotalStr, setSubtotalStr] = useState('');
  const [tipMode, setTipMode] = useState<TipMode>('none');
  const [customTipStr, setCustomTipStr] = useState('');

  // Payers: { memberId, amountStr }
  const [payers, setPayers] = useState<{ memberId: string; amountStr: string }[]>([]);

  // Step 2: shares
  const [shareMode, setShareMode] = useState<'equal' | 'custom'>('equal');
  const [shares, setShares] = useState<{ memberId: string; amountStr: string }[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Derived
  const subtotal = parseToCents(subtotalStr);
  const tipCents = calcTip(subtotal, tipMode, parseToCents(customTipStr));
  const total = subtotal + tipCents;

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
    const mems = await database
      .get<Member>('members')
      .query(Q.where('group_id', groupId))
      .fetch();
    setMembers(mems);

    // Get group currency
    const grp = await database.get<any>('groups').find(groupId);
    setCurrency(grp.currency ?? 'USD');

    const active = mems.filter((m) => m.isActive);
    setPayers(active.map((m) => ({ memberId: m.id, amountStr: '' })));
    setShares(active.map((m) => ({ memberId: m.id, amountStr: '' })));

    // If confirming an existing expense
    if (confirmExpenseId) {
      // show confirm UI instead
    }
  };

  const visibleMembers = showInactive
    ? members
    : members.filter((m) => m.isActive);

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  // ── Step 1 validation ───────────────────────────────────────────────────

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (subtotal <= 0) e.subtotal = 'Amount must be greater than 0';

    const payerList = payers.filter((p) => parseToCents(p.amountStr) > 0);
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

    // Auto-fill shares if equal mode
    if (shareMode === 'equal') {
      const activeMembers = visibleMembers;
      const amounts = splitEqually(total, activeMembers.length);
      setShares(activeMembers.map((m, i) => ({
        memberId: m.id,
        amountStr: (amounts[i]! / 100).toFixed(2),
      })));
    }

    setStep(2);
  };

  // ── Step 2 validation & save ─────────────────────────────────────────────

  const handleSave = async () => {
    const payerList = payers
      .map((p) => ({ memberId: p.memberId, amount: parseToCents(p.amountStr) }))
      .filter((p) => p.amount > 0);

    let shareList: { memberId: string; weight: number; amount: number }[];
    if (shareMode === 'equal') {
      const active = visibleMembers;
      const amounts = splitEqually(total, active.length);
      shareList = active.map((m, i) => ({
        memberId: m.id,
        weight: 1,
        amount: amounts[i]!,
      }));
    } else {
      shareList = shares
        .filter((s) => parseToCents(s.amountStr) > 0)
        .map((s) => ({
          memberId: s.memberId,
          weight: 1,
          amount: parseToCents(s.amountStr),
        }));
    }

    const payersSum = payerList.reduce((s, p) => s + p.amount, 0);
    const sharesSum = shareList.reduce((s, sh) => s + sh.amount, 0);
    const validation = validateExpense(total, payersSum, sharesSum);

    if (!validation.valid) {
      Alert.alert('Validation Error', validation.error);
      return;
    }

    setLoading(true);
    try {
      await createExpense({
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
  };

  // ── Confirm expense mode ─────────────────────────────────────────────────

  if (confirmExpenseId) {
    return (
      <ConfirmExpenseView
        expenseId={confirmExpenseId}
        members={members}
        currency={currency}
      />
    );
  }

  // ── Step 1: Payers ───────────────────────────────────────────────────────

  if (step === 1) {
    return (
      <View className="flex-1 bg-surface-950">
        <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
          {/* Progress indicator */}
          <View className="flex-row mb-6">
            <View className="flex-1 h-1 bg-brand-500 rounded-full mr-1" />
            <View className="flex-1 h-1 bg-surface-800 rounded-full ml-1" />
          </View>
          <Text className="text-slate-400 text-sm mb-4">Step 1 of 2 — Who paid?</Text>

          <Field
            label="Title"
            placeholder="e.g. Dinner at Mama Mia"
            value={title}
            onChangeText={setTitle}
            error={errors.title}
            required
          />

          {/* Category */}
          <View className="mb-4">
            <Text className="text-slate-300 text-sm font-medium mb-1.5">Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2">
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setCategory(c)}
                    className={[
                      'px-3 py-2 rounded-xl border',
                      category === c
                        ? 'bg-brand-500 border-brand-400'
                        : 'bg-surface-800 border-white/10',
                    ].join(' ')}
                  >
                    <Text className="text-sm">{c.split(' ')[0]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <AmountField
            label={`Subtotal (${currency})`}
            currency={currency}
            value={subtotalStr}
            onChangeText={setSubtotalStr}
            placeholder="0.00"
            error={errors.subtotal}
            required
          />

          {/* Tip */}
          <View className="mb-4">
            <Text className="text-slate-300 text-sm font-medium mb-1.5">Tip</Text>
            <View className="flex-row flex-wrap gap-2">
              {TIP_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setTipMode(t.value)}
                  className={[
                    'px-3 py-2 rounded-xl border',
                    tipMode === t.value
                      ? 'bg-brand-500 border-brand-400'
                      : 'bg-surface-800 border-white/10',
                  ].join(' ')}
                >
                  <Text
                    className={tipMode === t.value ? 'text-white text-sm' : 'text-slate-400 text-sm'}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {tipMode === 'custom' && (
              <View className="mt-2">
                <AmountField
                  label="Custom tip"
                  currency={currency}
                  value={customTipStr}
                  onChangeText={setCustomTipStr}
                  placeholder="0.00"
                />
              </View>
            )}
            {tipCents > 0 && (
              <Text className="text-accent-400 text-sm mt-1">
                Tip: {formatMoney(tipCents, currency)} → Total: {formatMoney(total, currency)}
              </Text>
            )}
          </View>

          {/* Payers */}
          <Card className="mb-4">
            <Text className="text-white font-semibold mb-3">Who paid?</Text>
            <Text className="text-slate-400 text-xs mb-3">
              Total: {formatMoney(total, currency)}. Enter 0 or leave blank to skip.
            </Text>
            {errors.payers && (
              <Text className="text-danger-400 text-sm mb-2">{errors.payers}</Text>
            )}

            {visibleMembers.map((m) => {
              const payer = payers.find((p) => p.memberId === m.id);
              return (
                <View key={m.id} className="flex-row items-center mb-2">
                  <Text className="text-white text-sm flex-1">{m.name}</Text>
                  <View className="w-32">
                    <AmountField
                      label=""
                      currency={currency}
                      placeholder="0.00"
                      value={payer?.amountStr ?? ''}
                      onChangeText={(t) => {
                        setPayers((prev) =>
                          prev.some((p) => p.memberId === m.id)
                            ? prev.map((p) => p.memberId === m.id ? { ...p, amountStr: t } : p)
                            : [...prev, { memberId: m.id, amountStr: t }]
                        );
                      }}
                    />
                  </View>
                </View>
              );
            })}

            {/* Quick fill: single payer */}
            <View className="flex-row flex-wrap gap-2 mt-1">
              {visibleMembers.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => {
                    setPayers(
                      visibleMembers.map((mem) => ({
                        memberId: mem.id,
                        amountStr: mem.id === m.id ? (total / 100).toFixed(2) : '',
                      }))
                    );
                  }}
                  className="bg-surface-900 border border-white/10 rounded-lg px-2 py-1"
                >
                  <Text className="text-slate-400 text-xs">{m.name} paid all</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Show inactive toggle */}
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-slate-400 text-sm">Show inactive members</Text>
            <Switch
              value={showInactive}
              onValueChange={setShowInactive}
              trackColor={{ false: '#374151', true: '#6366f1' }}
            />
          </View>

          <Button
            label="Next: Who consumed? →"
            variant="primary"
            fullWidth
            onPress={handleNext}
          />
          <View className="h-8" />
        </ScrollView>
      </View>
    );
  }

  // ── Step 2: Shares ───────────────────────────────────────────────────────

  const computedShares =
    shareMode === 'equal'
      ? (() => {
          const amounts = splitEqually(total, visibleMembers.length);
          return visibleMembers.map((m, i) => ({ memberId: m.id, amount: amounts[i]! }));
        })()
      : shares
          .filter((s) => parseToCents(s.amountStr) > 0)
          .map((s) => ({ memberId: s.memberId, amount: parseToCents(s.amountStr) }));

  const sharesSum = computedShares.reduce((s, sh) => s + sh.amount, 0);

  return (
    <View className="flex-1 bg-surface-950">
      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        <View className="flex-row mb-6">
          <View className="flex-1 h-1 bg-brand-500 rounded-full mr-1" />
          <View className="flex-1 h-1 bg-brand-500 rounded-full ml-1" />
        </View>
        <Text className="text-slate-400 text-sm mb-4">Step 2 of 2 — Who consumed?</Text>

        <Card className="mb-4">
          <View className="flex-row justify-between mb-1">
            <Text className="text-slate-400 text-sm">Expense</Text>
            <Text className="text-white font-bold">{formatMoney(total, currency)}</Text>
          </View>
          <Text className="text-white font-semibold">{title}</Text>
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
            <Text
              className={shareMode === 'equal' ? 'text-white font-semibold' : 'text-slate-400'}
            >
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
            <Text
              className={shareMode === 'custom' ? 'text-white font-semibold' : 'text-slate-400'}
            >
              By amount
            </Text>
          </TouchableOpacity>
        </View>

        {shareMode === 'equal' ? (
          <Card className="mb-4">
            {visibleMembers.map((m, i) => {
              const amounts = splitEqually(total, visibleMembers.length);
              return (
                <View key={m.id} className="flex-row justify-between items-center mb-1.5">
                  <Text className="text-white text-sm">{m.name}</Text>
                  <Text className="text-accent-400 text-sm font-medium">
                    {formatMoney(amounts[i]!, currency)}
                  </Text>
                </View>
              );
            })}
            {visibleMembers.length > 0 && (
              <Text className="text-slate-500 text-xs mt-2">
                Last person gets remainder to ensure exact total
              </Text>
            )}
          </Card>
        ) : (
          <Card className="mb-4">
            <Text className="text-slate-400 text-xs mb-3">
              Sum must equal {formatMoney(total, currency)}
            </Text>
            {visibleMembers.map((m) => {
              const share = shares.find((s) => s.memberId === m.id);
              return (
                <View key={m.id} className="flex-row items-center mb-2">
                  <Text className="text-white text-sm flex-1">{m.name}</Text>
                  <View className="w-32">
                    <AmountField
                      label=""
                      currency={currency}
                      placeholder="0.00"
                      value={share?.amountStr ?? ''}
                      onChangeText={(t) =>
                        setShares((prev) =>
                          prev.some((s) => s.memberId === m.id)
                            ? prev.map((s) =>
                                s.memberId === m.id ? { ...s, amountStr: t } : s
                              )
                            : [...prev, { memberId: m.id, amountStr: t }]
                        )
                      }
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
          <Button
            label="← Back"
            variant="ghost"
            onPress={() => setStep(1)}
            style={{ flex: 1 }}
          />
          <Button
            label="Save Expense"
            variant="primary"
            loading={loading}
            onPress={handleSave}
            style={{ flex: 1 }}
          />
        </View>
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}

// ── Confirm expense sub-screen ───────────────────────────────────────────────

function ConfirmExpenseView({
  expenseId,
  members,
  currency,
}: {
  expenseId: string;
  members: Member[];
  currency: string;
}) {
  const [expense, setExpense] = useState<Expense | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    database.get<Expense>('expenses').find(expenseId).then(setExpense);
  }, [expenseId]);

  if (!expense) return <View className="flex-1 bg-surface-950" />;

  const handleConfirm = async () => {
    if (!selectedMemberId) return;
    setConfirming(true);
    try {
      await confirmExpense(expenseId, selectedMemberId);
      Alert.alert('✅ Confirmed!', 'Confirmation recorded.', [
        { text: 'OK', onPress: () => router.dismiss() },
      ]);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <View className="flex-1 bg-surface-950 p-4">
      <Card className="mb-4">
        <Text className="text-white font-bold text-lg mb-1">{expense.title}</Text>
        <Text className="text-slate-400 text-sm">
          {formatMoney(expense.totalAmount, currency)}
        </Text>
      </Card>

      <Text className="text-white font-semibold mb-3">Who is confirming?</Text>
      <Text className="text-slate-400 text-sm mb-4">
        Show this screen to the participant, they select their name.
      </Text>

      {members.map((m) => (
        <TouchableOpacity
          key={m.id}
          onPress={() => setSelectedMemberId(m.id)}
          className={[
            'flex-row items-center p-4 rounded-2xl mb-2 border',
            selectedMemberId === m.id
              ? 'bg-brand-500/20 border-brand-500/50'
              : 'bg-surface-800 border-white/5',
          ].join(' ')}
        >
          <View
            className={[
              'w-5 h-5 rounded-full border-2 mr-3',
              selectedMemberId === m.id ? 'bg-brand-500 border-brand-400' : 'border-slate-600',
            ].join(' ')}
          />
          <Text className="text-white font-medium">{m.name}</Text>
        </TouchableOpacity>
      ))}

      <View className="mt-4">
        <Button
          label="✅ Confirm I've seen this"
          variant="accent"
          fullWidth
          loading={confirming}
          disabled={!selectedMemberId}
          onPress={handleConfirm}
        />
      </View>
    </View>
  );
}
