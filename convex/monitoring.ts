"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { execSync } from "child_process";

export const getContainerStats = action({
  args: { clawId: v.id("claws") },
  returns: v.union(
    v.object({
      cpuPercent: v.number(),
      memUsage: v.string(),
      memPercent: v.number(),
      netIO: v.string(),
      blockIO: v.string(),
      pids: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const claw = await ctx.runQuery(api.claws.get, { clawId: args.clawId });
    if (!claw?.containerId) return null;

    try {
      const output = execSync(
        `docker stats --no-stream --format '{{json .}}' ${claw.containerId}`,
        { encoding: "utf-8", timeout: 10000 },
      ).trim();

      const stats = JSON.parse(output);

      return {
        cpuPercent: parseFloat(stats.CPUPerc?.replace("%", "") || "0"),
        memUsage: stats.MemUsage || "0B / 0B",
        memPercent: parseFloat(stats.MemPerc?.replace("%", "") || "0"),
        netIO: stats.NetIO || "0B / 0B",
        blockIO: stats.BlockIO || "0B / 0B",
        pids: parseInt(stats.PIDs || "0", 10),
      };
    } catch {
      return null;
    }
  },
});
