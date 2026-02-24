"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { randomBytes, createHash } from "crypto";
import { Id } from "./_generated/dataModel";

export const createKey = action({
  args: { name: v.string() },
  returns: v.object({ key: v.string(), keyPrefix: v.string() }),
  handler: async (ctx, args): Promise<{ key: string; keyPrefix: string }> => {
    const rawKey = `bc_${randomBytes(24).toString("hex")}`;
    const keyPrefix = rawKey.slice(0, 10);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    await ctx.runMutation(internal.apiKeysMutations.storeKey, {
      name: args.name,
      keyHash,
      keyPrefix,
    });

    return { key: rawKey, keyPrefix };
  },
});

export const validateKey = action({
  args: { key: v.string() },
  returns: v.union(v.id("users"), v.null()),
  handler: async (ctx, args): Promise<Id<"users"> | null> => {
    const keyHash = createHash("sha256").update(args.key).digest("hex");
    const result = await ctx.runQuery(internal.apiKeysMutations.findByHash, { keyHash });
    if (!result) return null;

    await ctx.runMutation(internal.apiKeysMutations.touchLastUsed, { keyId: result.keyId });
    return result.userId;
  },
});
