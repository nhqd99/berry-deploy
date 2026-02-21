import { v } from "convex/values";
import { query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {
    clawId: v.id("claws"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const claw = await ctx.db.get(args.clawId);
    if (!claw || claw.userId !== userId) return [];

    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_claw_and_time", (q) => q.eq("clawId", args.clawId))
      .order("desc")
      .take(args.limit ?? 50);

    return logs;
  },
});

export const create = internalMutation({
  args: {
    clawId: v.id("claws"),
    type: v.union(
      v.literal("deploy"),
      v.literal("start"),
      v.literal("stop"),
      v.literal("restart"),
      v.literal("config_update"),
      v.literal("error"),
      v.literal("health_check"),
    ),
    message: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activityLogs", {
      clawId: args.clawId,
      type: args.type,
      message: args.message,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});
