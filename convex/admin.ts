import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

async function requireAdmin(ctx: { db: { get: (id: any) => Promise<any> }; auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("Not authorized");
  return userId;
}

export const getSystemStats = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const allUsers = await ctx.db.query("users").collect();
    const allClaws = await ctx.db.query("claws").collect();

    const statusCounts = { running: 0, stopped: 0, error: 0, creating: 0, removing: 0 };
    for (const claw of allClaws) {
      if (claw.status in statusCounts) {
        statusCounts[claw.status as keyof typeof statusCounts]++;
      }
    }

    return {
      totalUsers: allUsers.length,
      totalClaws: allClaws.length,
      ...statusCounts,
    };
  },
});

export const listAllUsers = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    const claws = await ctx.db.query("claws").collect();

    // Count claws per user
    const clawCounts = new Map<string, number>();
    for (const claw of claws) {
      clawCounts.set(claw.userId, (clawCounts.get(claw.userId) ?? 0) + 1);
    }

    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      role: u.role ?? "user",
      clawCount: clawCounts.get(u._id) ?? 0,
    }));
  },
});

export const listAllClaws = query({
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const claws = await ctx.db.query("claws").collect();
    const users = await ctx.db.query("users").collect();

    const userMap = new Map(users.map((u) => [u._id, u]));

    return claws.map((c) => {
      const user = userMap.get(c.userId);
      return {
        _id: c._id,
        name: c.name,
        status: c.status,
        containerName: c.containerName,
        gatewayPort: c.gatewayPort,
        bridgePort: c.bridgePort,
        customDomain: c.customDomain,
        createdAt: c.createdAt,
        errorMessage: c.errorMessage,
        ownerName: user?.name ?? "Unknown",
        ownerEmail: user?.email ?? "Unknown",
      };
    });
  },
});

export const setUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("user")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.userId, { role: args.role });
  },
});

export const isAdmin = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const user = await ctx.db.get(userId);
    return user?.role === "admin";
  },
});
