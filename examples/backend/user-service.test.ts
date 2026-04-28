import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './user-service';
import { NotFoundError, AppError } from './app-error';

const mockDb = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
};

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  keys: vi.fn(),
  del: vi.fn(),
};

vi.mock('./db', () => ({ db: mockDb }));
vi.mock('./cache', () => ({
  redis: mockRedis,
  getOrSet: vi.fn(async (_key: string, fetcher: () => Promise<unknown>) => fetcher()),
  invalidate: vi.fn(),
}));

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    userService = new UserService();
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER' as const,
        createdAt: new Date(),
      };
      mockDb.user.findUnique.mockResolvedValue(mockUser);

      const result = await userService.findById('1');

      expect(result).toEqual(mockUser);
      expect(mockDb.user.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });
    });

    it('should throw NotFoundError when user not found', async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(userService.findById('999')).rejects.toThrow(NotFoundError);
      await expect(userService.findById('999')).rejects.toThrow('User not found');
    });
  });

  describe('create', () => {
    it('should create user successfully', async () => {
      const input = {
        email: 'new@example.com',
        name: 'New User',
        password: 'hashedpassword',
      };
      const mockUser = {
        id: '2',
        email: input.email,
        name: input.name,
        role: 'USER' as const,
        createdAt: new Date(),
      };

      mockDb.user.findUnique.mockResolvedValue(null);
      mockDb.user.create.mockResolvedValue(mockUser);

      const result = await userService.create(input);

      expect(result).toEqual(mockUser);
      expect(mockDb.user.create).toHaveBeenCalledWith({
        data: {
          email: input.email.toLowerCase(),
          name: input.name,
          passwordHash: input.password,
        },
        select: expect.any(Object),
      });
    });

    it('should throw error when email already exists', async () => {
      const existingUser = {
        id: '1',
        email: 'existing@example.com',
        name: 'Existing',
        role: 'USER' as const,
        createdAt: new Date(),
      };
      mockDb.user.findUnique.mockResolvedValue(existingUser);

      await expect(
        userService.create({
          email: 'existing@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(AppError);
    });
  });

  describe('list', () => {
    it('should return paginated users', async () => {
      const mockUsers = [
        { id: '1', email: 'user1@example.com', name: 'User 1', role: 'USER', createdAt: new Date() },
        { id: '2', email: 'user2@example.com', name: 'User 2', role: 'USER', createdAt: new Date() },
      ];
      mockDb.user.findMany.mockResolvedValue(mockUsers);
      mockDb.user.count.mockResolvedValue(50);

      const result = await userService.list(1, 20);

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(50);
      expect(mockDb.user.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        select: expect.any(Object),
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should calculate correct offset for pagination', async () => {
      mockDb.user.findMany.mockResolvedValue([]);
      mockDb.user.count.mockResolvedValue(0);

      await userService.list(3, 10);

      expect(mockDb.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      );
    });
  });
});
