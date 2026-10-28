import React from 'react';
import { View, Text, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  title?: string;
  badge?: string;
  badgeColor?: 'brand' | 'accent' | 'danger' | 'warning';
}

export function Card({ children, title, badge, badgeColor = 'brand', style, className, ...rest }: CardProps) {
  const badgeColorMap: Record<string, string> = {
    brand: 'bg-brand-500/20 text-brand-300',
    accent: 'bg-accent-500/20 text-accent-400',
    danger: 'bg-danger-500/20 text-danger-400',
    warning: 'bg-warning-500/20 text-warning-400',
  };

  return (
    <View
      className={['bg-surface-800 rounded-2xl p-4 border border-white/5', className].join(' ')}
      style={style}
      {...rest}
    >
      {(title || badge) && (
        <View className="flex-row items-center justify-between mb-3">
          {title && (
            <Text className="text-white font-semibold text-base">{title}</Text>
          )}
          {badge && (
            <View className={['px-2 py-0.5 rounded-full', badgeColorMap[badgeColor] ?? badgeColorMap.brand].join(' ')}>
              <Text className="text-xs font-medium">{badge}</Text>
            </View>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

export function Divider() {
  return <View className="h-px bg-white/5 my-2" />;
}
