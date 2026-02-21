import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const get = query({
  args: {
    clawId: v.id("claws"),
    fileType: v.union(
      v.literal("soul.md"),
      v.literal("memory.md"),
      v.literal("AGENTS.md"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    // Verify ownership
    const claw = await ctx.db.get(args.clawId);
    if (!claw || claw.userId !== userId) return null;

    const configs = await ctx.db
      .query("clawConfigs")
      .withIndex("by_claw_and_type", (q) =>
        q.eq("clawId", args.clawId).eq("fileType", args.fileType),
      )
      .first();

    return configs;
  },
});

export const listByClawId = query({
  args: { clawId: v.id("claws") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const claw = await ctx.db.get(args.clawId);
    if (!claw || claw.userId !== userId) return [];

    return await ctx.db
      .query("clawConfigs")
      .withIndex("by_claw", (q) => q.eq("clawId", args.clawId))
      .collect();
  },
});

export const save = mutation({
  args: {
    clawId: v.id("claws"),
    fileType: v.union(
      v.literal("soul.md"),
      v.literal("memory.md"),
      v.literal("AGENTS.md"),
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const claw = await ctx.db.get(args.clawId);
    if (!claw || claw.userId !== userId) throw new Error("Not found");

    const existing = await ctx.db
      .query("clawConfigs")
      .withIndex("by_claw_and_type", (q) =>
        q.eq("clawId", args.clawId).eq("fileType", args.fileType),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("clawConfigs", {
        clawId: args.clawId,
        fileType: args.fileType,
        content: args.content,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.insert("activityLogs", {
      clawId: args.clawId,
      type: "config_update",
      message: `Updated ${args.fileType}`,
      createdAt: Date.now(),
    });
  },
});
