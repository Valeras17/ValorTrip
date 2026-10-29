import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
  Platform,
} from 'react-native';
import { scan } from 'react-native-receipt-scanner';
import { parseReceipt } from '@/lib/receiptParser';
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
import {
  confirmExpenseMultiple,
  getExpenseConfirmations,
} from '@/features/expenses/confirmationActions';

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
  const [scanning, setScanning] = useState(false);

  const handleScanReceipt = async () => {
    try {
      setScanning(true);
      const result = await scan({
        source: 'camera',
        ocr: true,
        ocrFloor: false,
        maxPages: 1,
        // Android ML Kit Text Recognition handles Latin ('en-US'), which accurately recognizes all digits, prices, totals, English words.
        // On Android, 'ru-RU' causes OcrLanguageResolver to throw "OCR script Cyrl is not supported on Android".
        // On iOS, Apple Vision natively supports Cyrillic ('ru-RU').
        ocrLanguages: Platform.OS === 'ios' ? ['ru-RU', 'en-US'] : ['en-US'],
      });

      if (result.status === 'success' && result.images.length > 0) {
        const rawOcr = result.images[0]?.ocrText ?? result.mergedOcr?.text ?? '';
        const parsed = parseReceipt(rawOcr);

        const updates: string[] = [];
        if (parsed.amount) {
          setSubtotalStr(parsed.amount);
          updates.push(`Amount: ${parsed.amount} ${currency}`);
        }
        if (parsed.title) {
          setTitle((prev) => (prev.trim() ? prev : parsed.title!));
          updates.push(`Title: ${parsed.title}`);
        }

        if (updates.length > 0) {
          Alert.alert(
            'Receipt Recognized',
            `${updates.join('\n')}\n\nFields have been filled. You can still edit them manually.`
          );
        } else {
          Alert.alert(
            'Receipt Scanned',
            'Text was extracted, but the total amount could not be determined automatically. Please enter it manually.'
          );
        }
      } else if (result.status === 'rejected') {
        Alert.alert(
          'Scan Failed',
          'Could not recognize text on the receipt. Try taking a photo in good lighting.'
        );
      }
    } catch (err: any) {
      console.error('Receipt scan error:', err);
      Alert.alert('Scan Error', err?.message || String(err));
    } finally {
      setScanning(false);
    }
  };

  // Payers: { memberId, amountStr }
  const [payers, setPayers] = useState<{ memberId: string; amountStr: string }[]>([]);
  const [paidAllMemberId, setPaidAllMemberId] = useState<string | null>(null);

  // Step 2: shares
  const [shareMode, setShareMode] = useState<'equal' | 'custom'>('equal');
  const [shares, setShares] = useState<{ memberId: string; amountStr: string; isAuto?: boolean }[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Derived
  const subtotal = parseToCents(subtotalStr);
  const tipCents = calcTip(subtotal, tipMode, parseToCents(customTipStr));
  const total = subtotal + tipCents;

  useEffect(() => {
    loadData();
  }, [groupId]);

  // Keep "paid all" payer synced if subtotal/tip changes
  useEffect(() => {
    if (!paidAllMemberId) return;
    setPayers(
      members.map((m) => ({
        memberId: m.id,
        amountStr: m.id === paidAllMemberId && total > 0 ? (total / 100).toFixed(2) : '0',
      }))
    );
  }, [total, paidAllMemberId, members]);

  const loadData = async () => {
    try {
      const mems = await database
        .get<Member>('members')
        .query(Q.where('group_id', groupId))
        .fetch();
      setMembers(mems);

      // Get group currency
      const grp = await database.get<any>('groups').find(groupId);
      setCurrency(grp.currency ?? 'USD');

      setPayers(mems.map((m) => ({ memberId: m.id, amountStr: '' })));
      setShares(mems.map((m) => ({ memberId: m.id, amountStr: '', isAuto: false })));
    } catch (err) {
      Alert.alert('Error', String(err));
    }
  };

  const visibleMembers = showInactive
    ? members
    : members.filter((m) => m.isActive);

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? '?';

  // ── Payer amount change (Step 1) ─────────────────────────────────────────

  const handlePayerAmountChange = (editedMemberId: string, text: string) => {
    setPaidAllMemberId(null);
    setPayers((prev) =>
      members.map((m) => {
        if (m.id === editedMemberId) {
          return { memberId: m.id, amountStr: text };
        }
        const existing = prev.find((p) => p.memberId === m.id);
        return { memberId: m.id, amountStr: existing?.amountStr ?? '' };
      })
    );
  };

  // ── Auto-fill remainder for custom shares ("By amount", Step 2) ──────────

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

      // Candidates for auto-remainder: empty or previously auto-filled fields (excluding the field currently being edited)
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

  const handleShareBlur = (blurredMemberId: string) => {
    setShares((prev) => {
      const current = prev.find((s) => s.memberId === blurredMemberId);
      if (current && current.amountStr.trim() !== '') return prev;

      const base = visibleMembers.map((m) => {
        const existing = prev.find((s) => s.memberId === m.id);
        return existing ?? { memberId: m.id, amountStr: '', isAuto: false };
      });

      const manualItems = base.filter(
        (s) => !s.isAuto && s.amountStr.trim() !== ''
      );
      const hasPositiveManual = manualItems.some(
        (s) => parseToCents(s.amountStr) > 0
      );
      if (!hasPositiveManual) return prev;

      const manualSum = manualItems.reduce(
        (sum, s) => sum + parseToCents(s.amountStr),
        0
      );
      const remainder = total - manualSum;
      const candidates = base.filter((s) => s.isAuto || s.amountStr.trim() === '');
      if (candidates.length === 0 || remainder <= 0) return prev;

      const targetId = candidates[0]!.memberId;

      return base.map((s) => {
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

  // ── Step 1 validation ───────────────────────────────────────────────────

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (subtotal <= 0) e.subtotal = 'Amount must be greater than 0';

    const visibleIds = new Set(visibleMembers.map((m) => m.id));
    const payerList = payers.filter((p) => visibleIds.has(p.memberId) && parseToCents(p.amountStr) > 0);
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

    // Ensure shares array has entries for all visibleMembers WITHOUT overwriting custom shares with equal split
    setShares((prev) => {
      const next = visibleMembers.map((m) => {
        const existing = prev.find((s) => s.memberId === m.id);
        return existing ?? { memberId: m.id, amountStr: '', isAuto: false };
      });

      const manualItems = next.filter((s) => !s.isAuto && s.amountStr.trim() !== '');
      const hasPositiveManual = manualItems.some((s) => parseToCents(s.amountStr) > 0);
      if (!hasPositiveManual) {
        return next.map((s) => (s.isAuto ? { ...s, amountStr: '', isAuto: false } : s));
      }

      const manualSum = manualItems.reduce((sum, s) => sum + parseToCents(s.amountStr), 0);
      const remainder = total - manualSum;
      const candidates = next.filter((s) => s.isAuto || s.amountStr.trim() === '');
      if (candidates.length > 0) {
        const targetId = candidates[0]!.memberId;
        return next.map((s) => {
          if (!s.isAuto && s.amountStr.trim() !== '') return s;
          if (s.memberId === targetId && remainder > 0) {
            return { ...s, amountStr: (remainder / 100).toFixed(2), isAuto: true };
          }
          return { ...s, amountStr: '', isAuto: false };
        });
      }
      return next;
    });

    setStep(2);
  };

  // ── Step 2 validation & save ─────────────────────────────────────────────

  const handleSave = async () => {
    const visibleIds = new Set(visibleMembers.map((m) => m.id));
    const payerList = payers
      .filter((p) => visibleIds.has(p.memberId))
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
        .filter((s) => visibleIds.has(s.memberId) && parseToCents(s.amountStr) > 0)
        .map((s) => {
          const amount = parseToCents(s.amountStr);
          return {
            memberId: s.memberId,
            weight: amount,
            amount,
          };
        });
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

  const visibleMemberIds = new Set(visibleMembers.map((m) => m.id));
  const currentPayers = payers
    .filter((p) => visibleMemberIds.has(p.memberId) && parseToCents(p.amountStr) > 0)
    .map((p) => ({
      name: memberName(p.memberId),
      amount: parseToCents(p.amountStr),
    }));
  const currentPayersSum = currentPayers.reduce((s, p) => s + p.amount, 0);
  const isNextDisabled = !title.trim() || total <= 0 || currentPayersSum !== total;

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

          {/* Subtotal with Scan Receipt Button */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-1.5">
              <View className="flex-row items-center">
                <Text className="text-slate-300 text-sm font-medium">
                  Subtotal ({currency})
                </Text>
                <Text className="text-danger-400 ml-1 text-sm">*</Text>
              </View>
              <TouchableOpacity
                onPress={handleScanReceipt}
                disabled={scanning}
                activeOpacity={0.7}
                className="flex-row items-center bg-brand-500/20 border border-brand-500/40 rounded-xl px-3 py-1.5"
              >
                <Text className="text-brand-300 text-xs font-semibold">
                  {scanning ? '⏳ Scanning...' : '📷 Scan Receipt'}
                </Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center bg-surface-900 border border-white/10 rounded-xl overflow-hidden">
              <View className="px-4 py-3 border-r border-white/10">
                <Text className="text-slate-400 text-base">
                  {currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'RUB' ? '₽' : currency}
                </Text>
              </View>
              <TextInput
                className="flex-1 px-4 py-3 text-white text-base"
                placeholderTextColor="#475569"
                keyboardType="decimal-pad"
                placeholder="0.00"
                value={subtotalStr}
                onChangeText={setSubtotalStr}
                style={{ fontFamily: 'System' }}
              />
            </View>
            {errors.subtotal && (
              <Text className="text-danger-400 text-xs mt-1">{errors.subtotal}</Text>
            )}
          </View>

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

          {/* Payers (Step 1: Who paid?) */}
          <Card className="mb-4">
            <Text className="text-white font-semibold mb-1">Who paid?</Text>
            <Text className="text-slate-400 text-xs mb-3">
              Total: {formatMoney(total, currency)}. Tap "Paid all" or enter amounts.
            </Text>
            {errors.payers && (
              <Text className="text-danger-400 text-sm mb-2">{errors.payers}</Text>
            )}

            {/* Quick fill: single payer ("[Name] paid all") */}
            <View className="flex-row flex-wrap gap-2 mb-3">
              {visibleMembers.map((m) => {
                const isSelected = paidAllMemberId === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => {
                      setPaidAllMemberId(m.id);
                      setPayers(
                        members.map((mem) => ({
                          memberId: mem.id,
                          amountStr:
                            mem.id === m.id
                              ? total > 0
                                ? (total / 100).toFixed(2)
                                : '0'
                              : '0',
                        }))
                      );
                    }}
                    className={[
                      'rounded-xl px-3 py-1.5 border',
                      isSelected
                        ? 'bg-brand-500 border-brand-400'
                        : 'bg-surface-900 border-white/10',
                    ].join(' ')}
                  >
                    <Text
                      className={
                        isSelected
                          ? 'text-white text-xs font-semibold'
                          : 'text-slate-300 text-xs'
                      }
                    >
                      {m.name} paid all
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {visibleMembers.map((m) => {
              const payer = payers.find((p) => p.memberId === m.id);
              return (
                <View key={m.id} className="flex-row items-center mb-2">
                  <View className="flex-1 flex-row items-center mr-2">
                    <Text className="text-white text-sm">{m.name}</Text>
                  </View>
                  <View className="w-32">
                    <AmountField
                      label=""
                      currency={currency}
                      placeholder="0.00"
                      value={payer?.amountStr ?? ''}
                      onChangeText={(t) => handlePayerAmountChange(m.id, t)}
                    />
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
            disabled={isNextDisabled}
            onPress={handleNext}
          />
          <View className="h-8" />
        </ScrollView>
      </View>
    );
  }

  // ── Step 2: Shares (Who consumed?) ───────────────────────────────────────

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
  const isSaveDisabled = loading || currentPayersSum !== total || sharesSum !== total || total <= 0;

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
            <Text className="text-white font-semibold">{title}</Text>
            <Text className="text-white font-bold">{formatMoney(total, currency)}</Text>
          </View>
          {currentPayers.length > 0 && (
            <Text className="text-slate-400 text-xs mt-1">
              💳 Paid by:{' '}
              {currentPayers
                .map((p) => `${p.name} (${formatMoney(p.amount, currency)})`)
                .join(', ')}
            </Text>
          )}
        </Card>

        {/* Share mode toggle: Split equally / By amount */}
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
                <View key={m.id} className="flex-row justify-between items-center py-2 border-b border-white/5 last:border-b-0">
                  <Text className="text-white text-sm">{m.name}</Text>
                  <Text className="text-accent-400 text-sm font-semibold">
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

            {/* Remaining to allocate hint */}
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
                      onBlur={() => handleShareBlur(m.id)}
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
            disabled={isSaveDisabled}
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
  const [alreadyConfirmedIds, setAlreadyConfirmedIds] = useState<string[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let active = true;
    const loadConfirmData = async () => {
      try {
        const exp = await database.get<Expense>('expenses').find(expenseId);
        const confs = await getExpenseConfirmations(expenseId);
        if (!active) return;
        setExpense(exp);
        const confirmed = confs.filter((c) => c.isConfirmed).map((c) => c.memberId);
        setAlreadyConfirmedIds(confirmed);
      } catch (err) {
        Alert.alert('Error', String(err));
      }
    };
    loadConfirmData();
    return () => {
      active = false;
    };
  }, [expenseId]);

  if (!expense) return <View className="flex-1 bg-surface-950" />;

  const toggleMember = (memberId: string) => {
    if (alreadyConfirmedIds.includes(memberId)) return;
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleConfirm = async () => {
    const toSave = Array.from(new Set([...alreadyConfirmedIds, ...selectedMemberIds]));
    if (selectedMemberIds.length === 0) return;
    setConfirming(true);
    try {
      await confirmExpenseMultiple(expenseId, toSave);
      const updatedConfs = await getExpenseConfirmations(expenseId);
      const updatedIds = updatedConfs.filter((c) => c.isConfirmed).map((c) => c.memberId);
      setAlreadyConfirmedIds(updatedIds);
      setSelectedMemberIds([]);

      Alert.alert('✅ Confirmed!', 'Confirmation saved to database.', [
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
      <ScrollView showsVerticalScrollIndicator={false}>
        <Card className="mb-4">
          <Text className="text-white font-bold text-lg mb-1">{expense.title}</Text>
          <Text className="text-slate-400 text-sm">
            {formatMoney(expense.totalAmount, currency)}
          </Text>
        </Card>

        <Text className="text-white font-semibold mb-2">Who is confirming?</Text>
        <Text className="text-slate-400 text-sm mb-4">
          Show this screen to the participant, they select their name and tap Confirm.
        </Text>

        {members.map((m) => {
          const isAlreadyConfirmed = alreadyConfirmedIds.includes(m.id);
          const isSelected = isAlreadyConfirmed || selectedMemberIds.includes(m.id);
          return (
            <TouchableOpacity
              key={m.id}
              onPress={() => toggleMember(m.id)}
              disabled={isAlreadyConfirmed}
              className={[
                'flex-row items-center justify-between p-4 rounded-2xl mb-2 border',
                isAlreadyConfirmed
                  ? 'bg-accent-500/15 border-accent-500/40'
                  : isSelected
                  ? 'bg-brand-500/20 border-brand-500/50'
                  : 'bg-surface-800 border-white/5',
              ].join(' ')}
            >
              <View className="flex-row items-center">
                <View
                  className={[
                    'w-6 h-6 rounded-full border-2 mr-3 items-center justify-center',
                    isAlreadyConfirmed
                      ? 'bg-accent-500 border-accent-400'
                      : isSelected
                      ? 'bg-brand-500 border-brand-400'
                      : 'border-slate-600',
                  ].join(' ')}
                >
                  {isSelected && (
                    <Text className="text-white text-xs font-bold">✓</Text>
                  )}
                </View>
                <Text className="text-white font-medium">{m.name}</Text>
              </View>
              {isAlreadyConfirmed && (
                <Text className="text-accent-400 text-xs font-semibold">✅ Confirmed</Text>
              )}
            </TouchableOpacity>
          );
        })}

        <View className="mt-4">
          <Button
            label="✅ Confirm I've seen this"
            variant="accent"
            fullWidth
            loading={confirming}
            disabled={selectedMemberIds.length === 0}
            onPress={handleConfirm}
          />
        </View>
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
