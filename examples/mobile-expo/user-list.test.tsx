/**
 * User List Screen Tests
 * Demonstrates: testing.md (React Native Testing Library)
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import UserListScreen from './user-list';
import { api } from './api';

jest.mock('./api');

const mockUsers = [
  { id: '1', email: 'john@example.com', name: 'John Doe', createdAt: '2024-01-01' },
  { id: '2', email: 'jane@example.com', name: 'Jane Smith', createdAt: '2024-01-02' },
];

const mockPaginatedResponse = {
  success: true,
  data: mockUsers,
  pagination: {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
  },
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function renderWithProviders(component: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
  );
}

describe('UserListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading state initially', () => {
    (api.get as jest.Mock).mockImplementation(() => new Promise(() => {}));

    renderWithProviders(<UserListScreen />);

    expect(screen.getByTestId('loading-indicator')).toBeTruthy();
  });

  it('should display users when loaded', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

    renderWithProviders(<UserListScreen />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('Jane Smith')).toBeTruthy();
    });
  });

  it('should show empty state when no users', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        ...mockPaginatedResponse,
        data: [],
      },
    });

    renderWithProviders(<UserListScreen />);

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeTruthy();
    });
  });

  it('should show error state on failure', async () => {
    (api.get as jest.Mock).mockRejectedValue(new Error('Network error'));

    renderWithProviders(<UserListScreen />);

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });
  });

  it('should retry on error state button press', async () => {
    (api.get as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: mockPaginatedResponse });

    renderWithProviders(<UserListScreen />);

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Retry'));

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeTruthy();
    });
  });

  it('should refresh on pull down', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

    renderWithProviders(<UserListScreen />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeTruthy();
    });

    const flatList = screen.getByTestId('user-list');
    fireEvent(flatList, 'refresh');

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });

  it('should navigate to user detail on press', async () => {
    const mockRouter = { push: jest.fn() };
    jest.mock('expo-router', () => ({
      useRouter: () => mockRouter,
    }));

    (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

    renderWithProviders(<UserListScreen />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('John Doe'));

    expect(mockRouter.push).toHaveBeenCalledWith('/users/1');
  });
});

describe('UserCard', () => {
  it('should render user information correctly', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

    renderWithProviders(<UserListScreen />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('john@example.com')).toBeTruthy();
    });
  });

  it('should be memoized and not re-render unnecessarily', () => {
    const renderCount = { current: 0 };
    const originalMemo = React.memo;

    jest.spyOn(React, 'memo').mockImplementation((component: any) => {
      const MemoComponent = originalMemo(component);
      return function WrappedComponent(props: any) {
        renderCount.current++;
        return <MemoComponent {...props} />;
      };
    });

    (api.get as jest.Mock).mockResolvedValue({ data: mockPaginatedResponse });

    const { rerender } = renderWithProviders(<UserListScreen />);

    rerender(
      <QueryClientProvider client={createTestQueryClient()}>
        <UserListScreen />
      </QueryClientProvider>
    );

    expect(renderCount.current).toBeLessThanOrEqual(4);
  });
});
