import { db } from './db';
import { AppError, NotFoundError } from './app-error';
import { redis, getOrSet, invalidate } from './cache';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
}

interface CreateUserInput {
  email: string;
  name?: string;
  password: string;
}

export class UserService {
  async findById(id: string): Promise<User> {
    const cacheKey = `myapp:v1:user:${id}`;

    const user = await getOrSet(cacheKey, async () => {
      return db.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      });
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
  }

  async create(input: CreateUserInput): Promise<User> {
    const existing = await this.findByEmail(input.email);
    if (existing) {
      throw new AppError('Email already exists', 409, 'EMAIL_EXISTS');
    }

    const user = await db.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: input.password,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  async update(id: string, data: Partial<Pick<User, 'name'>>): Promise<User> {
    await this.findById(id);

    const user = await db.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    await invalidate(`myapp:v1:user:${id}`);

    return user;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);

    await db.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await invalidate(`myapp:v1:user:${id}`);
  }

  async list(page = 1, limit = 20): Promise<{ users: User[]; total: number }> {
    const [users, total] = await Promise.all([
      db.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.user.count({ where: { deletedAt: null } }),
    ]);

    return { users, total };
  }
}

export const userService = new UserService();
