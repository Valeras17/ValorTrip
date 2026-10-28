import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  type TouchableOpacityProps,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  onPress,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const handlePress = async (e: any) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const bgColors: Record<string, string> = {
    primary: 'bg-brand-500',
    secondary: 'bg-surface-800 border border-surface-700',
    danger: 'bg-danger-500',
    ghost: 'bg-transparent border border-surface-700',
    accent: 'bg-accent-500',
  };

  const textColors: Record<string, string> = {
    primary: 'text-white',
    secondary: 'text-white',
    danger: 'text-white',
    ghost: 'text-slate-300',
    accent: 'text-white',
  };

  const paddingMap: Record<string, string> = {
    sm: 'px-3 py-2',
    md: 'px-5 py-3',
    lg: 'px-6 py-4',
  };

  const textSizeMap: Record<string, string> = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      className={[
        'flex-row items-center justify-center rounded-2xl',
        bgColors[variant],
        paddingMap[size],
        fullWidth ? 'w-full' : '',
        disabled || loading ? 'opacity-50' : '',
      ].join(' ')}
      style={style}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color="white" />
      ) : (
        <>
          {icon && <View className="mr-2">{icon}</View>}
          <Text
            className={[
              'font-semibold',
              textColors[variant],
              textSizeMap[size],
            ].join(' ')}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}
