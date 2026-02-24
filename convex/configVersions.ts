import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listVersions = query({
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
    if (!userId) return [];

    const claw = await ctx.db.get(args.clawId);
    if (!claw || claw.userId !== userId) return [];

    return await ctx.db
      .query("configVersions")
      .withIndex("by_claw_and_type", (q) =>
        q.eq("clawId", args.clawId).eq("fileType", args.fileType),
      )
      .order("desc")
      .take(50);
  },
});

export const getVersion = query({
  args: {
    clawId: v.id("claws"),
    fileType: v.union(
      v.literal("soul.md"),
      v.literal("memory.md"),
      v.literal("AGENTS.md"),
    ),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const claw = await ctx.db.get(args.clawId);
    if (!claw || claw.userId !== userId) return null;

    return await ctx.db
      .query("configVersions")
      .withIndex("by_claw_type_version", (q) =>
        q
          .eq("clawId", args.clawId)
          .eq("fileType", args.fileType)
          .eq("version", args.version),
      )
      .first();
  },
});

export const rollback = mutation({
  args: {
    clawId: v.id("claws"),
    fileType: v.union(
      v.literal("soul.md"),
      v.literal("memory.md"),
      v.literal("AGENTS.md"),
    ),
    version: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const claw = await ctx.db.get(args.clawId);
    if (!claw || claw.userId !== userId) throw new Error("Not found");

    const versionDoc = await ctx.db
      .query("configVersions")
      .withIndex("by_claw_type_version", (q) =>
        q
          .eq("clawId", args.clawId)
          .eq("fileType", args.fileType)
          .eq("version", args.version),
      )
      .first();

    if (!versionDoc) throw new Error("Version not found");

    // Get current config to save as a new version before rollback
    const currentConfig = await ctx.db
      .query("clawConfigs")
      .withIndex("by_claw_and_type", (q) =>
        q.eq("clawId", args.clawId).eq("fileType", args.fileType),
      )
      .first();

    if (currentConfig) {
      // Save current as a version
      const existingVersions = await ctx.db
        .query("configVersions")
        .withIndex("by_claw_and_type", (q) =>
          q.eq("clawId", args.clawId).eq("fileType", args.fileType),
        )
        .order("desc")
        .first();

      const nextVersion = (existingVersions?.version ?? 0) + 1;

      await ctx.db.insert("configVersions", {
        clawId: args.clawId,
        fileType: args.fileType,
        content: currentConfig.content,
        version: nextVersion,
        createdAt: Date.now(),
      });

      // Update current config with rolled-back content
      await ctx.db.patch(currentConfig._id, {
        content: versionDoc.content,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.insert("activityLogs", {
      clawId: args.clawId,
      type: "config_update",
      message: `Rolled back ${args.fileType} to version ${args.version}`,
      createdAt: Date.now(),
    });
  },
});
