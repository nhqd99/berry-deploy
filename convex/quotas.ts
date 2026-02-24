import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getQuota = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const quota = await ctx.db
      .query("userQuotas")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const claws = await ctx.db
      .query("claws")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const maxClaws = quota?.maxClaws ?? 5;
    const usedClaws = claws.length;

    return {
      maxClaws,
      maxPorts: quota?.maxPorts ?? 10,
      usedClaws,
      canCreate: usedClaws < maxClaws,
    };
  },
});

export const checkQuota = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const quota = await ctx.db
      .query("userQuotas")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    const claws = await ctx.db
      .query("claws")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const maxClaws = quota?.maxClaws ?? 5;
    return claws.length < maxClaws;
  },
});

export const setQuota = mutation({
  args: {
    userId: v.id("users"),
    maxClaws: v.number(),
    maxPorts: v.number(),
  },
  handler: async (ctx, args) => {
    const currentUserId = await getAuthUserId(ctx);
    if (!currentUserId) throw new Error("Not authenticated");

    // Only admins can set quotas
    const currentUser = await ctx.db.get(currentUserId);
    if (currentUser?.role !== "admin") throw new Error("Not authorized");

    const existing = await ctx.db
      .query("userQuotas")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        maxClaws: args.maxClaws,
        maxPorts: args.maxPorts,
      });
    } else {
      await ctx.db.insert("userQuotas", {
        userId: args.userId,
        maxClaws: args.maxClaws,
        maxPorts: args.maxPorts,
      });
    }
  },
});
