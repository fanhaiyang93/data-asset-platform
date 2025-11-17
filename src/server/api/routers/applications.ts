import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { applicationFormSchema, applicationDraftSchema } from "@/lib/schemas/application";
import { BusinessPurpose, ApplicationStatus } from "@prisma/client";
import { generateApplicationNumber } from "@/lib/utils/applicationNumber";

export const applicationsRouter = createTRPCRouter({
  // 创建申请
  create: protectedProcedure
    .input(applicationFormSchema)
    .mutation(async ({ ctx, input }) => {
      // 生成唯一的申请编号，确保不重复
      let applicationNumber: string;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 5;

      do {
        applicationNumber = generateApplicationNumber();
        const existing = await ctx.db.application.findUnique({
          where: { applicationNumber },
        });
        isUnique = !existing;
        attempts++;
      } while (!isUnique && attempts < maxAttempts);

      if (!isUnique) {
        throw new Error("无法生成唯一的申请编号，请稍后重试");
      }

      const application = await ctx.db.application.create({
        data: {
          assetId: input.assetId,
          userId: ctx.session.user.id,
          purpose: input.purpose,
          reason: input.reason,
          startDate: input.startDate,
          endDate: input.endDate,
          applicantName: input.applicantName,
          department: input.department,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          status: ApplicationStatus.PENDING,
          applicationNumber,
          submittedAt: new Date(),
          isDraft: false,
        },
      });

      return application;
    }),

  // 保存草稿
  saveDraft: protectedProcedure
    .input(
      applicationDraftSchema.extend({
        id: z.string().optional(), // 用于更新现有草稿
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...draftData } = input;

      // 过滤掉空值和未定义值
      const cleanData = Object.fromEntries(
        Object.entries(draftData).filter(([_, value]) =>
          value !== undefined && value !== null && value !== ""
        )
      );

      if (id) {
        // 更新现有草稿
        return await ctx.db.application.update({
          where: {
            id,
            userId: ctx.session.user.id, // 确保只能更新自己的草稿
          },
          data: cleanData,
        });
      } else {
        // 创建新草稿
        return await ctx.db.application.create({
          data: {
            ...cleanData,
            assetId: cleanData.assetId || "",
            userId: ctx.session.user.id,
            status: ApplicationStatus.DRAFT,
            applicantName: cleanData.applicantName || ctx.session.user.name || "",
            contactEmail: cleanData.contactEmail || ctx.session.user.email || "",
          },
        });
      }
    }),

  // 获取草稿列表
  getDrafts: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.application.findMany({
      where: {
        userId: ctx.session.user.id,
        status: ApplicationStatus.DRAFT,
      },
      include: {
        asset: {
          select: {
            name: true,
            type: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }),

  // 获取特定草稿
  getDraft: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.application.findFirst({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
          status: ApplicationStatus.DRAFT,
        },
        include: {
          asset: {
            select: {
              name: true,
              type: true,
            },
          },
        },
      });
    }),

  // 删除草稿
  deleteDraft: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.application.delete({
        where: {
          id: input.id,
          userId: ctx.session.user.id,
          status: ApplicationStatus.DRAFT,
        },
      });
    }),

  // 获取用户申请历史
  getApplicationHistory: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(10),
        status: z.nativeEnum(ApplicationStatus).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.limit;

      const where = {
        userId: ctx.session.user.id,
        ...(input.status && { status: input.status }),
      };

      const [applications, total] = await Promise.all([
        ctx.db.application.findMany({
          where,
          include: {
            asset: {
              select: {
                name: true,
                type: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: input.limit,
        }),
        ctx.db.application.count({ where }),
      ]);

      return {
        applications,
        pagination: {
          page: input.page,
          limit: input.limit,
          total,
          pages: Math.ceil(total / input.limit),
        },
      };
    }),

  // 从草稿提交申请
  submitFromDraft: protectedProcedure
    .input(z.object({ draftId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 首先获取草稿数据
      const draft = await ctx.db.application.findFirst({
        where: {
          id: input.draftId,
          userId: ctx.session.user.id,
          status: ApplicationStatus.DRAFT,
        },
      });

      if (!draft) {
        throw new Error("草稿不存在或无权限访问");
      }

      // 验证草稿数据是否完整
      try {
        applicationFormSchema.parse(draft);
      } catch (error) {
        throw new Error("草稿数据不完整，无法提交申请");
      }

      // 生成唯一的申请编号，确保不重复
      let applicationNumber: string;
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 5;

      do {
        applicationNumber = generateApplicationNumber();
        const existing = await ctx.db.application.findUnique({
          where: { applicationNumber },
        });
        isUnique = !existing;
        attempts++;
      } while (!isUnique && attempts < maxAttempts);

      if (!isUnique) {
        throw new Error("无法生成唯一的申请编号，请稍后重试");
      }

      // 更新状态为PENDING并设置申请编号
      return await ctx.db.application.update({
        where: { id: input.draftId },
        data: {
          status: ApplicationStatus.PENDING,
          applicationNumber,
          submittedAt: new Date(),
          isDraft: false,
        },
      });
    }),
});