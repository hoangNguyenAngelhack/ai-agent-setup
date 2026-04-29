/**
 * User List Screen with FlatList (React Native CLI)
 * Demonstrates: tech-stack.md (NativeWind, FlatList), mobile-performance-checklist.md
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUsers, User } from './use-users';
import { RootStackParamList } from './root-navigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ITEM_HEIGHT = 72;
const AVATAR_SIZE = 48;

interface UserCardProps {
  user: User;
  onPress: (userId: string) => void;
}

const UserCard = React.memo(function UserCard({ user, onPress }: UserCardProps) {
  return (
    <Pressable
      className="flex-row items-center px-4 py-3 bg-white border-b border-gray-100 active:bg-gray-50"
      onPress={() => onPress(user.id)}
      style={{ height: ITEM_HEIGHT }}
    >
      <FastImage
        source={{ uri: user.avatar, priority: FastImage.priority.normal }}
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
        resizeMode={FastImage.resizeMode.cover}
      />
      <View className="ml-3 flex-1">
        <Text className="text-base font-semibold text-gray-900">{user.name}</Text>
        <Text className="text-sm text-gray-500">{user.email}</Text>
      </View>
    </Pressable>
  );
});

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-lg font-medium text-gray-900 mb-2">No users found</Text>
      <Text className="text-gray-500 text-center">
        Pull down to refresh or check back later.
      </Text>
    </View>
  );
}

function LoadingState() {
  return (
    <View className="flex-1 items-center justify-center">
      <ActivityIndicator size="large" color="#007AFF" />
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-lg font-medium text-gray-900 mb-2">Something went wrong</Text>
      <Text className="text-gray-500 text-center mb-4">
        We couldn't load the users. Please try again.
      </Text>
      <Pressable
        className="bg-blue-500 px-6 py-3 rounded-lg active:bg-blue-600"
        onPress={onRetry}
      >
        <Text className="text-white font-semibold">Retry</Text>
      </Pressable>
    </View>
  );
}

function FooterLoader() {
  return (
    <View className="py-4 items-center">
      <ActivityIndicator size="small" color="#007AFF" />
    </View>
  );
}

export default function UserListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [refreshing, setRefreshing] = useState(false);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useUsers();

  const users = data?.pages.flatMap((page) => page.data) ?? [];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleUserPress = useCallback(
    (userId: string) => {
      navigation.navigate('UserDetail', { userId });
    },
    [navigation]
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: User }) => (
      <UserCard user={item} onPress={handleUserPress} />
    ),
    [handleUserPress]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    []
  );

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return <ErrorState onRetry={refetch} />;
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ListEmptyComponent={EmptyState}
        ListFooterComponent={isFetchingNextPage ? FooterLoader : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        initialNumToRender={10}
      />
    </View>
  );
}
