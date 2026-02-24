import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const storeToken = internalMutation({
  args: {
    tokenHash: v.string(),
    clawId: v.id("claws"),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Get the userId from the claw
    const claw = await ctx.db.get(args.clawId);
    if (!claw) throw new Error("Claw not found");

    await ctx.db.insert("streamTokens", {
      tokenHash: args.tokenHash,
      userId: claw.userId,
      clawId: args.clawId,
      expiresAt: args.expiresAt,
    });
  },
});

export const validateToken = internalQuery({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("streamTokens")
      .withIndex("by_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .first();

    if (!token) return null;
    if (token.expiresAt < Date.now()) return null;

    return {
      userId: token.userId,
      clawId: token.clawId,
    };
  },
});
