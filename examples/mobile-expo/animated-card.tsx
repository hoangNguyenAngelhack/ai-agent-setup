/**
 * Animated Card Component with Reanimated
 * Demonstrates: tech-stack.md (react-native-reanimated), mobile-performance-checklist.md
 */

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

interface AnimatedCardProps {
  title: string;
  description: string;
  onPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnimatedCard({ title, description, onPress }: AnimatedCardProps) {
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const shadowOpacity = interpolate(
      pressed.value,
      [0, 1],
      [0.1, 0.2],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale: scale.value }],
      shadowOpacity,
    };
  });

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
    pressed.value = withTiming(1, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    pressed.value = withTiming(0, { duration: 100 });
  };

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={[
        animatedStyle,
        {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowRadius: 8,
          elevation: 4,
        },
      ]}
      className="bg-white rounded-2xl p-4 mx-4 my-2"
    >
      <Text className="text-lg font-bold text-gray-900 mb-1">{title}</Text>
      <Text className="text-gray-600">{description}</Text>
    </AnimatedPressable>
  );
}

interface AnimatedListItemProps {
  index: number;
  children: React.ReactNode;
}

export function AnimatedListItem({ index, children }: AnimatedListItemProps) {
  const translateY = useSharedValue(50);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    const delay = index * 50;
    translateY.value = withTiming(0, { duration: 300 }, () => {}, delay);
    opacity.value = withTiming(1, { duration: 300 }, () => {}, delay);
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
}

export function Skeleton({ width, height, borderRadius = 4 }: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 800 }, (finished) => {
      if (finished) {
        opacity.value = withTiming(0.3, { duration: 800 });
      }
    });

    const interval = setInterval(() => {
      opacity.value = withTiming(1, { duration: 800 }, (finished) => {
        if (finished) {
          opacity.value = withTiming(0.3, { duration: 800 });
        }
      });
    }, 1600);

    return () => clearInterval(interval);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          width,
          height,
          borderRadius,
          backgroundColor: '#E5E5EA',
        },
      ]}
    />
  );
}

export function UserCardSkeleton() {
  return (
    <View className="flex-row items-center px-4 py-3">
      <Skeleton width={48} height={48} borderRadius={24} />
      <View className="ml-3 flex-1">
        <Skeleton width="60%" height={16} borderRadius={4} />
        <View className="h-2" />
        <Skeleton width="40%" height={14} borderRadius={4} />
      </View>
    </View>
  );
}
