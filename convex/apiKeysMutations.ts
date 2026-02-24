import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listKeys = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    // Never return the hash
    return keys.map((k) => ({
      _id: k._id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    }));
  },
});

export const storeKey = internalMutation({
  args: { name: v.string(), keyHash: v.string(), keyPrefix: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.insert("apiKeys", {
      userId,
      name: args.name,
      keyHash: args.keyHash,
      keyPrefix: args.keyPrefix,
      createdAt: Date.now(),
    });
  },
});

export const deleteKey = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const key = await ctx.db.get(args.keyId);
    if (!key || key.userId !== userId) throw new Error("Not found");

    await ctx.db.delete(args.keyId);
  },
});

export const findByHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .first();

    if (!key) return null;
    return { userId: key.userId, keyId: key._id };
  },
});

export const touchLastUsed = internalMutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.keyId, { lastUsedAt: Date.now() });
  },
});
