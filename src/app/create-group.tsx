import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Card } from '@/components/ui/Card';
import { createGroup, addMemberToGroup } from '@/features/groups/groupActions';
import { makeInviteUrl } from '@/lib/snapshot';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'RUB', 'JPY', 'CNY'];

export default function CreateGroupScreen() {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [ownerName, setOwnerName] = useState('');
  const [extra, setExtra] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Trip name is required';
    if (!ownerName.trim()) e.ownerName = 'Your name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const group = await createGroup({
        name: name.trim(),
        currency,
        ownerName: ownerName.trim(),
      });

      // Add extra members
      for (const n of extra) {
        if (n.trim()) {
          await addMemberToGroup(group.id, n.trim());
        }
      }

      setCreatedGroupId(group.id);
    } catch (err) {
      Alert.alert('Error', String(err));
    } finally {
      setLoading(false);
    }
  };

  if (createdGroupId) {
    const inviteUrl = makeInviteUrl(createdGroupId);
    return (
      <View className="flex-1 bg-surface-950">
        <ScrollView className="flex-1 p-4">
          <View className="items-center mb-6 mt-4">
            <Text className="text-white text-2xl font-bold mb-1">🎉 Trip Created!</Text>
            <Text className="text-slate-400 text-sm text-center">
              Share this QR code with your group members
            </Text>
          </View>

          <Card className="items-center p-6 mb-4">
            <View className="bg-white p-4 rounded-2xl">
              <QRCode value={inviteUrl} size={220} />
            </View>
            <Text className="text-slate-400 text-xs mt-3 text-center">
              valortrip://join/{createdGroupId.slice(0, 8)}…
            </Text>
          </Card>

          <Card className="mb-4">
            <Text className="text-slate-400 text-sm mb-1">How it works</Text>
            <Text className="text-white text-sm leading-5">
              1. Other members scan this QR code{'\n'}
              2. They get a read-only view of the trip{'\n'}
              3. You share snapshots to keep them updated
            </Text>
          </Card>

          <Button
            label="Open Trip"
            variant="primary"
            fullWidth
            onPress={() => {
              router.dismiss();
              router.push(`/group/${createdGroupId}`);
            }}
          />
          <View className="h-4" />
          <Button
            label="Done"
            variant="ghost"
            fullWidth
            onPress={() => router.dismiss()}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface-950">
      <ScrollView className="flex-1 p-4" keyboardShouldPersistTaps="handled">
        <Text className="text-slate-400 text-sm mb-6 leading-5">
          You'll be the bookkeeper. Only you can add expenses.
        </Text>

        <Field
          label="Trip Name"
          placeholder="e.g. Barcelona 2025"
          value={name}
          onChangeText={setName}
          error={errors.name}
          required
        />

        {/* Currency selector */}
        <View className="mb-4">
          <Text className="text-slate-300 text-sm font-medium mb-1.5">
            Currency <Text className="text-danger-400">*</Text>
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {CURRENCIES.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCurrency(c)}
                className={[
                  'px-4 py-2 rounded-xl border',
                  currency === c
                    ? 'bg-brand-500 border-brand-400'
                    : 'bg-surface-800 border-white/10',
                ].join(' ')}
              >
                <Text
                  className={currency === c ? 'text-white font-bold' : 'text-slate-400'}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Field
          label="Your Name"
          placeholder="e.g. Alex"
          value={ownerName}
          onChangeText={setOwnerName}
          error={errors.ownerName}
          required
        />

        {/* Extra members */}
        <View className="mb-4">
          <Text className="text-slate-300 text-sm font-medium mb-1.5">
            Add Members (optional)
          </Text>
          {extra.map((n, i) => (
            <View key={i} className="flex-row items-center mb-2">
              <View className="flex-1">
                <Field
                  label=""
                  placeholder={`Member ${i + 1}`}
                  value={n}
                  onChangeText={(t) => {
                    const next = [...extra];
                    next[i] = t;
                    setExtra(next);
                  }}
                />
              </View>
              {i > 0 && (
                <TouchableOpacity
                  onPress={() => setExtra(extra.filter((_, idx) => idx !== i))}
                  className="ml-2 mb-4 p-2"
                >
                  <Text className="text-danger-400 text-lg">✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <Button
            label="+ Add Member"
            variant="ghost"
            size="sm"
            onPress={() => setExtra([...extra, ''])}
          />
        </View>

        <Button
          label="Create Trip"
          variant="primary"
          fullWidth
          loading={loading}
          onPress={handleCreate}
        />
        <View className="h-8" />
      </ScrollView>
    </View>
  );
}
