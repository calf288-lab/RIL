import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { sendTelegramLead } from "./telegram";
import { TRPCError } from "@trpc/server";
import { consumeLeadRateLimit, isSubmissionTooFast } from "./antispam";
import { askGemini } from "./gemini";
import { getCatalog } from "./catalog";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  leads: router({
    sendTelegram: publicProcedure
      .input(z.object({
        name: z.string().max(120).optional(),
        contact: z.string().min(3).max(160),
        source: z.string().max(120).default("Казанский·AI"),
        city: z.string().max(120).default("Казань и Татарстан"),
        purpose: z.string().max(120).optional(),
        district: z.string().max(120).optional(),
        mortgage: z.string().max(120).optional(),
        pageUrl: z.string().url().max(500),
        referrer: z.string().max(500).optional(),
        utm: z.record(z.string(), z.unknown()).optional(),
        conversation: z.string().max(8000).optional(),
        properties: z.array(z.string().max(240)).max(5).optional(),
        channel: z.enum(["chat", "form"]).default("chat"),
        website: z.string().max(0).optional(),
        startedAt: z.number().int().positive().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.website || isSubmissionTooFast(input.startedAt)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Некорректная отправка формы" });
        }

        const limit = consumeLeadRateLimit(ctx.req, input.channel);
        if (!limit.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Слишком много запросов. Попробуйте через ${limit.retryAfterSeconds} сек.`,
          });
        }

        const { channel: _channel, website: _website, startedAt: _startedAt, ...lead } = input;
        return sendTelegramLead(lead);
      }),
  }),

  catalog: router({
    list: publicProcedure.query(() => getCatalog()),
  }),

  agent: router({
    chat: publicProcedure
      .input(z.object({
        message: z.string().trim().min(1).max(1200),
        history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(12),
        city: z.string().max(120).optional(),
        purpose: z.string().max(120).optional(),
        district: z.string().max(120).optional(),
        mortgage: z.string().max(120).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const limit = consumeLeadRateLimit(ctx.req, "chat");
        if (!limit.allowed) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Слишком много сообщений. Попробуйте через ${limit.retryAfterSeconds} сек.`,
          });
        }
        return askGemini(input);
      }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
