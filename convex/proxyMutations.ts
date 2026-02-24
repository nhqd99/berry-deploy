import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const updateClawDomain = internalMutation({
  args: {
    clawId: v.id("claws"),
    domain: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.clawId, {
      customDomain: args.domain ?? undefined,
    });
  },
});

export const listClawsWithDomains = internalQuery({
  handler: async (ctx) => {
    const allClaws = await ctx.db.query("claws").collect();
    return allClaws.filter((c) => c.customDomain);
  },
});
