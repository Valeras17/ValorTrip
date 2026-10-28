import React from 'react';
import { View, Text } from 'react-native';

interface EmptyStateProps {
  emoji?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function EmptyState({ emoji = '📭', title, subtitle, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center py-16 px-8">
      <Text className="text-5xl mb-4">{emoji}</Text>
      <Text className="text-white text-xl font-semibold text-center mb-2">{title}</Text>
      {subtitle && (
        <Text className="text-slate-400 text-sm text-center mb-6 leading-5">{subtitle}</Text>
      )}
      {action && <View className="w-full">{action}</View>}
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  count?: number;
  action?: React.ReactNode;
}

export function SectionHeader({ title, count, action }: SectionHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <View className="flex-row items-center gap-2">
        <Text className="text-slate-400 text-xs font-semibold uppercase tracking-widest">
          {title}
        </Text>
        {count !== undefined && (
          <View className="bg-brand-500/20 rounded-full px-2 py-0.5">
            <Text className="text-brand-300 text-xs font-bold">{count}</Text>
          </View>
        )}
      </View>
      {action}
    </View>
  );
}
