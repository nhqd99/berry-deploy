import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const list = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("claws")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const get = query({
  args: { clawId: v.id("claws") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const claw = await ctx.db.get(args.clawId);
    if (!claw || claw.userId !== userId) return null;
    return claw;
  },
});

export const listByStatus = internalQuery({
  args: { statuses: v.array(v.string()) },
  handler: async (ctx, args) => {
    const allClaws = await ctx.db.query("claws").collect();
    return allClaws.filter((c) => args.statuses.includes(c.status));
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    containerName: v.string(),
    gatewayToken: v.string(),
    telegramBotToken: v.optional(v.string()),
    configDir: v.string(),
    envVars: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check quota
    const canCreate = await ctx.runQuery(internal.quotas.checkQuota, { userId });
    if (!canCreate) throw new Error("Quota exceeded: maximum number of claws reached");

    // Allocate ports atomically within this transaction
    const allocations = await ctx.db.query("portAllocations").collect();
    const usedPorts = new Set(allocations.map((a) => a.port));
    const rangeStart = 20000;
    const rangeEnd = 29999;
    let gatewayPort = 0;
    let bridgePort = 0;
    for (let port = rangeStart; port <= rangeEnd; port += 2) {
      if (!usedPorts.has(port) && !usedPorts.has(port + 1)) {
        gatewayPort = port;
        bridgePort = port + 1;
        break;
      }
    }
    if (gatewayPort === 0) throw new Error("No available ports");

    const clawId = await ctx.db.insert("claws", {
      userId,
      name: args.name,
      containerName: args.containerName,
      status: "creating",
      gatewayPort,
      bridgePort,
      gatewayToken: args.gatewayToken,
      telegramBotToken: args.telegramBotToken,
      configDir: args.configDir,
      envVars: args.envVars,
      createdAt: Date.now(),
    });

    // Record port allocations
    await ctx.db.insert("portAllocations", {
      port: gatewayPort,
      clawId,
      type: "gateway",
    });
    await ctx.db.insert("portAllocations", {
      port: bridgePort,
      clawId,
      type: "bridge",
    });

    // Create default config entries
    for (const fileType of ["soul.md", "memory.md", "AGENTS.md"] as const) {
      await ctx.db.insert("clawConfigs", {
        clawId,
        fileType,
        content: getDefaultContent(fileType),
        updatedAt: Date.now(),
      });
    }

    // Log deployment
    await ctx.db.insert("activityLogs", {
      clawId,
      type: "deploy",
      message: `Claw "${args.name}" deployment started`,
      createdAt: Date.now(),
    });

    return clawId;
  },
});

export const updateStatus = internalMutation({
  args: {
    clawId: v.id("claws"),
    status: v.union(
      v.literal("creating"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
      v.literal("removing"),
    ),
    containerId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const update: Record<string, unknown> = { status: args.status };
    if (args.containerId !== undefined) update.containerId = args.containerId;
    if (args.errorMessage !== undefined) update.errorMessage = args.errorMessage;
    if (args.status === "running") {
      update.lastHealthCheck = Date.now();
      update.lastStartedAt = Date.now();
    }

    await ctx.db.patch(args.clawId, update);
  },
});

export const remove = mutation({
  args: { clawId: v.id("claws") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const claw = await ctx.db.get(args.clawId);
    if (!claw || claw.userId !== userId) throw new Error("Not found");

    // Remove port allocations
    const ports = await ctx.db
      .query("portAllocations")
      .filter((q) => q.eq(q.field("clawId"), args.clawId))
      .collect();
    for (const port of ports) {
      await ctx.db.delete(port._id);
    }

    // Remove configs
    const configs = await ctx.db
      .query("clawConfigs")
      .withIndex("by_claw", (q) => q.eq("clawId", args.clawId))
      .collect();
    for (const config of configs) {
      await ctx.db.delete(config._id);
    }

    // Remove skills
    const skills = await ctx.db
      .query("skills")
      .withIndex("by_claw", (q) => q.eq("clawId", args.clawId))
      .collect();
    for (const skill of skills) {
      await ctx.db.delete(skill._id);
    }

    // Remove logs
    const logs = await ctx.db
      .query("activityLogs")
      .withIndex("by_claw", (q) => q.eq("clawId", args.clawId))
      .collect();
    for (const log of logs) {
      await ctx.db.delete(log._id);
    }

    // Remove config versions
    const versions = await ctx.db
      .query("configVersions")
      .withIndex("by_claw_and_type", (q) => q.eq("clawId", args.clawId))
      .collect();
    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    // Delete the claw record
    await ctx.db.delete(args.clawId);
  },
});

export const getNextAvailablePorts = internalQuery({
  handler: async (ctx) => {
    const allocations = await ctx.db.query("portAllocations").collect();
    const usedPorts = new Set(allocations.map((a) => a.port));

    const rangeStart = 20000;
    const rangeEnd = 29999;

    let gatewayPort = 0;
    let bridgePort = 0;

    for (let port = rangeStart; port <= rangeEnd; port += 2) {
      if (!usedPorts.has(port) && !usedPorts.has(port + 1)) {
        gatewayPort = port;
        bridgePort = port + 1;
        break;
      }
    }

    if (gatewayPort === 0) throw new Error("No available ports");
    return { gatewayPort, bridgePort };
  },
});

function getDefaultContent(fileType: "soul.md" | "memory.md" | "AGENTS.md"): string {
  switch (fileType) {
    case "soul.md":
      return "# Soul\n\nYou are a helpful AI assistant.\n";
    case "memory.md":
      return "# Memory\n\n(No memories yet)\n";
    case "AGENTS.md":
      return "---\nmodel: solobiz:claude-sonnet-4.6\n---\n\n# Agents\n\n(Default configuration)\n";
  }
}
