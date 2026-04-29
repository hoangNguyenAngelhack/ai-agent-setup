/**
 * Reusable UI Components
 * Demonstrates: tech-stack.md (NativeWind), clean-code.md (component patterns)
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  PressableProps,
  TextInput,
  TextInputProps,
} from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'flex-row items-center justify-center rounded-lg active:opacity-80',
  {
    variants: {
      variant: {
        primary: 'bg-blue-500',
        secondary: 'bg-gray-200',
        outline: 'border border-blue-500 bg-transparent',
        ghost: 'bg-transparent',
        destructive: 'bg-red-500',
      },
      size: {
        sm: 'px-3 py-2',
        md: 'px-4 py-3',
        lg: 'px-6 py-4',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

const buttonTextVariants = cva('font-semibold', {
  variants: {
    variant: {
      primary: 'text-white',
      secondary: 'text-gray-900',
      outline: 'text-blue-500',
      ghost: 'text-blue-500',
      destructive: 'text-white',
    },
    size: {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

interface ButtonProps
  extends PressableProps,
    VariantProps<typeof buttonVariants> {
  title: string;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  title,
  variant,
  size,
  loading,
  icon,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(
        buttonVariants({ variant, size }),
        disabled && 'opacity-50',
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'destructive' ? 'white' : '#007AFF'}
          size="small"
        />
      ) : (
        <>
          {icon && <View className="mr-2">{icon}</View>}
          <Text className={buttonTextVariants({ variant, size })}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  className,
  ...props
}: InputProps) {
  return (
    <View className="mb-4">
      {label && (
        <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      )}
      <View
        className={cn(
          'flex-row items-center border rounded-lg px-3',
          error ? 'border-red-500' : 'border-gray-300',
          className
        )}
      >
        {leftIcon && <View className="mr-2">{leftIcon}</View>}
        <TextInput
          className="flex-1 py-3 text-base text-gray-900"
          placeholderTextColor="#9CA3AF"
          {...props}
        />
        {rightIcon && <View className="ml-2">{rightIcon}</View>}
      </View>
      {error && <Text className="text-sm text-red-500 mt-1">{error}</Text>}
    </View>
  );
}

interface BadgeProps {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const variantStyles = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <View className={cn('px-2 py-1 rounded-full', variantStyles[variant])}>
      <Text className="text-xs font-medium">{label}</Text>
    </View>
  );
}

interface AvatarProps {
  uri?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({ uri, name, size = 'md' }: AvatarProps) {
  const sizeStyles = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  const textSizeStyles = {
    sm: 'text-xs',
    md: 'text-base',
    lg: 'text-xl',
  };

  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (uri) {
    return (
      <View className={cn('rounded-full overflow-hidden', sizeStyles[size])}>
        <Image source={{ uri }} className="w-full h-full" />
      </View>
    );
  }

  return (
    <View
      className={cn(
        'rounded-full bg-blue-500 items-center justify-center',
        sizeStyles[size]
      )}
    >
      <Text className={cn('text-white font-semibold', textSizeStyles[size])}>
        {initials}
      </Text>
    </View>
  );
}

interface DividerProps {
  label?: string;
}

export function Divider({ label }: DividerProps) {
  if (label) {
    return (
      <View className="flex-row items-center my-4">
        <View className="flex-1 h-px bg-gray-200" />
        <Text className="mx-4 text-gray-500 text-sm">{label}</Text>
        <View className="flex-1 h-px bg-gray-200" />
      </View>
    );
  }

  return <View className="h-px bg-gray-200 my-4" />;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      {icon && <View className="mb-4">{icon}</View>}
      <Text className="text-lg font-semibold text-gray-900 text-center mb-2">
        {title}
      </Text>
      {description && (
        <Text className="text-gray-500 text-center mb-4">{description}</Text>
      )}
      {action && (
        <Button
          title={action.label}
          variant="primary"
          onPress={action.onPress}
        />
      )}
    </View>
  );
}

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View className="absolute inset-0 bg-black/50 items-center justify-center">
      <View className="bg-white rounded-2xl p-6 items-center">
        <ActivityIndicator size="large" color="#007AFF" />
        {message && (
          <Text className="mt-4 text-gray-700 font-medium">{message}</Text>
        )}
      </View>
    </View>
  );
}
