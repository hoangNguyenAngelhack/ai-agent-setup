import { Request, Response } from 'express';
import { z } from 'zod';
import { userService } from './user-service';
import { asyncHandler } from './async-handler';

const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(2).max(100).optional(),
  password: z.string().min(8).max(128),
});

const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const userController = {
  getById: asyncHandler(async (req: Request, res: Response) => {
    const user = await userService.findById(req.params.id);

    res.json({
      success: true,
      data: user,
    });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = paginationSchema.parse(req.query);
    const { users, total } = await userService.list(page, limit);

    res.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createUserSchema.parse(req.body);
    const user = await userService.create(input);

    res.status(201).json({
      success: true,
      data: user,
      message: 'User created successfully',
    });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const input = updateUserSchema.parse(req.body);
    const user = await userService.update(req.params.id, input);

    res.json({
      success: true,
      data: user,
    });
  }),

  delete: asyncHandler(async (req: Request, res: Response) => {
    await userService.delete(req.params.id);

    res.status(204).send();
  }),
};
