import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CreateUserInput {
  email: string;
  name?: string;
  password: string;
}

interface UpdateUserInput {
  name?: string;
}

const USERS_KEY = ['users'] as const;

export function useUsers(page = 1, limit = 20) {
  return useQuery({
    queryKey: [...USERS_KEY, { page, limit }],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<User>>('/users', {
        params: { page, limit },
      });
      return response.data;
    },
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: [...USERS_KEY, id],
    queryFn: async () => {
      const response = await api.get<{ success: boolean; data: User }>(`/users/${id}`);
      return response.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const response = await api.post<{ success: boolean; data: User }>('/users', input);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateUserInput }) => {
      const response = await api.patch<{ success: boolean; data: User }>(`/users/${id}`, data);
      return response.data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      queryClient.invalidateQueries({ queryKey: [...USERS_KEY, variables.id] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
    },
  });
}
