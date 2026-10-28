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
  const [shares, setShares] = useState<{ memberId: string; amountStr: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const subtotal = parseToCents(subtotalStr);
  const tipCents = calcTip(subtotal, tipMode, parseToCents(customTipStr));
  const total = subtotal + tipCents;

  useEffect(() => {
    loadData();
  }, [expenseId, groupId]);

  const loadData = async () => {
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
        return { memberId: m.id, amountStr: s ? (s.amount / 100).toFixed(2) : '' };
      })
    );

    // Detect custom vs equal shares
    const activeMems = mems.filter((m) => m.isActive);
    const allEqual = activeMems.every((m, _, arr) => {
      const s1 = existingShares.find((s) => s.memberId === arr[0]!.id)?.amount ?? 0;
      const s2 = existingShares.find((s) => s.memberId === m.id)?.amount ?? 0;
      return Math.abs(s1 - s2) <= 1; // allow 1 cent difference (remainder)
    });
    setShareMode(allEqual ? 'equal' : 'custom');

    setLoaded(true);
  };

  if (!loaded) {
    return (
      <View className="flex-1 bg-surface-950 items-center justify-center">
        <Text className="text-slate-400">Loading...</Text>
      </View>
    );
  }

  const visibleMembers = showInactive ? members : members.filter((m) => m.isActive);

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (subtotal <= 0) e.subtotal = 'Amount must be greater than 0';
    const payerList = payers.filter((p) => parseToCents(p.amountStr) > 0);
    if (payerList.length === 0) e.payers = 'At least one payer required';
    const payersSum = payerList.reduce((s, p) => s + parseToCents(p.amountStr), 0);
    if (payersSum !== total) {
      e.payers = `Payers sum ${formatMoney(payersSum, currency)} ≠ total ${formatMoney(total, currency)}`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    const payerList = payers
      .map((p) => ({ memberId: p.memberId, amount: parseToCents(p.amountStr) }))
      .filter((p) => p.amount > 0);

    let shareList: { memberId: string; weight: number; amount: number }[];
    if (shareMode === 'equal') {
      const active = visibleMembers;
      const amounts = splitEqually(total, active.length);
      shareList = active.map((m, i) => ({ memberId: m.id, weight: 1, amount: amounts[i]! }));
    } else {
      shareList = shares
        .filter((s) => parseToCents(s.amountStr) > 0)
        .map((s) => ({ memberId: s.memberId, weight: 1, amount: parseToCents(s.amountStr) }));
    }

    const payersSum = payerList.reduce((s, p) => s + p.amount, 0);
    const sharesSum = shareList.reduce((s, sh) => s + sh.amount, 0);
    const validation = validateExpense(total, payersSum, sharesSum);
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

  return (
    <View className="flex-1 bg-surface-950">
      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        <Text className="text-slate-400 text-sm mb-4">
          Editing expense — balances will recalculate on save.
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
          <Text className="text-white font-semibold mb-2">Who paid?</Text>
          {errors.payers && <Text className="text-danger-400 text-sm mb-2">{errors.payers}</Text>}
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
        </Card>

        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-slate-400 text-sm">Show inactive members</Text>
          <Switch value={showInactive} onValueChange={setShowInactive} trackColor={{ false: '#374151', true: '#6366f1' }} />
        </View>

        <Button label="💾 Save Changes" variant="primary" fullWidth loading={loading} onPress={handleSave} />
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
