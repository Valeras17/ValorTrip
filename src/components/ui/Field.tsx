import React from 'react';
import {
  View,
  Text,
  TextInput,
  type TextInputProps,
} from 'react-native';

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

export function Field({ label, error, hint, required, style, ...rest }: FieldProps) {
  return (
    <View className="mb-4">
      <View className="flex-row mb-1.5">
        <Text className="text-slate-300 text-sm font-medium">{label}</Text>
        {required && <Text className="text-danger-400 ml-1 text-sm">*</Text>}
      </View>
      <TextInput
        className={[
          'bg-surface-900 border rounded-xl px-4 py-3 text-white text-base',
          error ? 'border-danger-500' : 'border-white/10',
        ].join(' ')}
        placeholderTextColor="#475569"
        style={[{ fontFamily: 'System' }, style as any]}
        {...rest}
      />
      {error && (
        <Text className="text-danger-400 text-xs mt-1">{error}</Text>
      )}
      {hint && !error && (
        <Text className="text-slate-500 text-xs mt-1">{hint}</Text>
      )}
    </View>
  );
}

interface AmountFieldProps extends Omit<FieldProps, 'keyboardType'> {
  currency?: string;
}

export function AmountField({ currency = 'USD', label, ...rest }: AmountFieldProps) {
  const symbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', RUB: '₽' };
  const symbol = symbols[currency] ?? currency;

  return (
    <View className="mb-4">
      <View className="flex-row mb-1.5">
        <Text className="text-slate-300 text-sm font-medium">{label}</Text>
      </View>
      <View className="flex-row items-center bg-surface-900 border border-white/10 rounded-xl overflow-hidden">
        <View className="px-4 py-3 border-r border-white/10">
          <Text className="text-slate-400 text-base">{symbol}</Text>
        </View>
        <TextInput
          className="flex-1 px-4 py-3 text-white text-base"
          placeholderTextColor="#475569"
          keyboardType="decimal-pad"
          style={{ fontFamily: 'System' }}
          {...rest}
        />
      </View>
    </View>
  );
}
