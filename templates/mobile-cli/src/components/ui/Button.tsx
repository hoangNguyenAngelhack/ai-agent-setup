import React from 'react';
import { Pressable, Text, ActivityIndicator, PressableProps } from 'react-native';

interface ButtonProps extends PressableProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantStyles = {
  primary: 'bg-primary-500 active:bg-primary-600',
  secondary: 'bg-gray-200 active:bg-gray-300',
  outline: 'border border-primary-500 bg-transparent active:bg-primary-50',
};

const textVariantStyles = {
  primary: 'text-white',
  secondary: 'text-gray-900',
  outline: 'text-primary-500',
};

const sizeStyles = {
  sm: 'px-3 py-2',
  md: 'px-4 py-3',
  lg: 'px-6 py-4',
};

const textSizeStyles = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={`flex-row items-center justify-center rounded-lg ${variantStyles[variant]} ${sizeStyles[size]} ${(disabled || loading) ? 'opacity-50' : ''}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? 'white' : '#3b82f6'}
          size="small"
        />
      ) : (
        <Text className={`font-semibold ${textVariantStyles[variant]} ${textSizeStyles[size]}`}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}
