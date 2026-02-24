import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const listChannels = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("notificationChannels")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const addChannel = mutation({
  args: {
    type: v.union(v.literal("discord"), v.literal("slack"), v.literal("email")),
    webhookUrl: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (args.type === "email" && !args.email) {
      throw new Error("Email address required for email notifications");
    }
    if ((args.type === "discord" || args.type === "slack") && !args.webhookUrl) {
      throw new Error("Webhook URL required for Discord/Slack notifications");
    }

    return await ctx.db.insert("notificationChannels", {
      userId,
      type: args.type,
      webhookUrl: args.webhookUrl,
      email: args.email,
      enabled: true,
      createdAt: Date.now(),
    });
  },
});

export const toggleChannel = mutation({
  args: { channelId: v.id("notificationChannels"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.userId !== userId) throw new Error("Not found");

    await ctx.db.patch(args.channelId, { enabled: args.enabled });
  },
});

export const removeChannel = mutation({
  args: { channelId: v.id("notificationChannels") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.userId !== userId) throw new Error("Not found");

    await ctx.db.delete(args.channelId);
  },
});

// Called by health check when a claw crashes
export const sendCrashNotification = internalMutation({
  args: {
    userId: v.id("users"),
    clawName: v.string(),
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    // Store a notification record for the user
    const channels = await ctx.db
      .query("notificationChannels")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const enabledChannels = channels.filter((c) => c.enabled);

    // For each enabled channel, create a pending notification
    for (const channel of enabledChannels) {
      await ctx.db.insert("pendingNotifications", {
        channelId: channel._id,
        userId: args.userId,
        title: `Claw "${args.clawName}" crashed`,
        message: args.errorMessage,
        createdAt: Date.now(),
        sent: false,
      });
    }
  },
});

export const listPendingNotifications = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("pendingNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

export const markNotificationRead = mutation({
  args: { notificationId: v.id("pendingNotifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== userId) throw new Error("Not found");

    await ctx.db.patch(args.notificationId, { sent: true });
  },
});

export const markAllRead = mutation({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const unread = await ctx.db
      .query("pendingNotifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("sent"), false))
      .collect();

    for (const n of unread) {
      await ctx.db.patch(n._id, { sent: true });
    }
  },
});
