import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: { clawId: v.id("claws") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const claw = await ctx.db.get(args.clawId);
    if (!claw || claw.userId !== userId) return [];

    return await ctx.db
      .query("skills")
      .withIndex("by_claw", (q) => q.eq("clawId", args.clawId))
      .collect();
  },
});

export const add = mutation({
  args: {
    clawId: v.id("claws"),
    name: v.string(),
    description: v.optional(v.string()),
    config: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const claw = await ctx.db.get(args.clawId);
    if (!claw || claw.userId !== userId) throw new Error("Not found");

    return await ctx.db.insert("skills", {
      clawId: args.clawId,
      name: args.name,
      description: args.description,
      enabled: true,
      config: args.config,
      createdAt: Date.now(),
    });
  },
});

export const toggle = mutation({
  args: {
    skillId: v.id("skills"),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const skill = await ctx.db.get(args.skillId);
    if (!skill) throw new Error("Not found");

    const claw = await ctx.db.get(skill.clawId);
    if (!claw || claw.userId !== userId) throw new Error("Not found");

    await ctx.db.patch(args.skillId, { enabled: args.enabled });
  },
});

export const remove = mutation({
  args: { skillId: v.id("skills") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const skill = await ctx.db.get(args.skillId);
    if (!skill) throw new Error("Not found");

    const claw = await ctx.db.get(skill.clawId);
    if (!claw || claw.userId !== userId) throw new Error("Not found");

    await ctx.db.delete(args.skillId);
  },
});
