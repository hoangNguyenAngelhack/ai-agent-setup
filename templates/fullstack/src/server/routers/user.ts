import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';

export const userRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findUnique({
        where: { id: input.id },
        select: { id: true, email: true, name: true },
      });
    }),

  getMe: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({
      where: { email: ctx.session.user?.email ?? '' },
      select: { id: true, email: true, name: true },
    });
  }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().min(2) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { email: ctx.session.user?.email ?? '' },
        data: { name: input.name },
      });
    }),
});
