import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";

export const usersRouter = createTRPCRouter({
  // 获取当前用户详细信息
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: {
        id: ctx.session.user.id,
      },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        department: true,
        role: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      throw new Error("用户不存在");
    }

    return user;
  }),

  // 更新用户信息
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "姓名不能为空").max(50, "姓名不能超过50个字符").optional(),
        department: z.string().max(100, "部门名称不能超过100个字符").optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.user.update({
        where: {
          id: ctx.session.user.id,
        },
        data: {
          ...input,
          updatedAt: new Date(),
        },
      });
    }),

  // 获取用户申请统计
  getApplicationStats: protectedProcedure.query(async ({ ctx }) => {
    const [totalApplications, pendingApplications, approvedApplications, rejectedApplications] = await Promise.all([
      ctx.db.application.count({
        where: {
          userId: ctx.session.user.id,
          status: { not: 'DRAFT' },
        },
      }),
      ctx.db.application.count({
        where: {
          userId: ctx.session.user.id,
          status: 'PENDING',
        },
      }),
      ctx.db.application.count({
        where: {
          userId: ctx.session.user.id,
          status: 'APPROVED',
        },
      }),
      ctx.db.application.count({
        where: {
          userId: ctx.session.user.id,
          status: 'REJECTED',
        },
      }),
    ]);

    return {
      total: totalApplications,
      pending: pendingApplications,
      approved: approvedApplications,
      rejected: rejectedApplications,
    };
  }),
});