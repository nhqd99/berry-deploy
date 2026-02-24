"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { randomBytes, createHash } from "crypto";

export const createStreamToken = action({
  args: { clawId: v.id("claws") },
  returns: v.object({ token: v.string(), containerId: v.string() }),
  handler: async (ctx, args): Promise<{ token: string; containerId: string }> => {
    const claw = await ctx.runQuery(api.claws.get, { clawId: args.clawId });
    if (!claw?.containerId) throw new Error("Container not found");

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");

    await ctx.runMutation(internal.streamingMutations.storeToken, {
      tokenHash,
      clawId: args.clawId,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    return { token, containerId: claw.containerId };
  },
});
