import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  users: defineTable({
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    role: v.optional(v.union(v.literal("admin"), v.literal("user"))),
  }).index("email", ["email"]),

  claws: defineTable({
    userId: v.id("users"),
    name: v.string(),
    containerId: v.optional(v.string()),
    containerName: v.string(),
    status: v.union(
      v.literal("creating"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error"),
      v.literal("removing"),
    ),
    gatewayPort: v.number(),
    bridgePort: v.number(),
    gatewayToken: v.string(),
    telegramBotToken: v.optional(v.string()),
    configDir: v.string(),
    envVars: v.optional(v.any()),
    customDomain: v.optional(v.string()),
    createdAt: v.number(),
    lastStartedAt: v.optional(v.number()),
    lastHealthCheck: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_container", ["containerId"])
    .index("by_status", ["status"]),

  clawConfigs: defineTable({
    clawId: v.id("claws"),
    fileType: v.union(
      v.literal("soul.md"),
      v.literal("memory.md"),
      v.literal("AGENTS.md"),
    ),
    content: v.string(),
    updatedAt: v.number(),
  })
    .index("by_claw", ["clawId"])
    .index("by_claw_and_type", ["clawId", "fileType"]),

  activityLogs: defineTable({
    clawId: v.id("claws"),
    type: v.union(
      v.literal("deploy"),
      v.literal("start"),
      v.literal("stop"),
      v.literal("restart"),
      v.literal("config_update"),
      v.literal("error"),
      v.literal("health_check"),
    ),
    message: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_claw", ["clawId"])
    .index("by_claw_and_time", ["clawId", "createdAt"]),

  skills: defineTable({
    clawId: v.id("claws"),
    name: v.string(),
    description: v.optional(v.string()),
    enabled: v.boolean(),
    config: v.optional(v.any()),
    createdAt: v.number(),
  }).index("by_claw", ["clawId"]),

  portAllocations: defineTable({
    port: v.number(),
    clawId: v.id("claws"),
    type: v.union(v.literal("gateway"), v.literal("bridge")),
  }).index("by_port", ["port"]),

  configVersions: defineTable({
    clawId: v.id("claws"),
    fileType: v.union(
      v.literal("soul.md"),
      v.literal("memory.md"),
      v.literal("AGENTS.md"),
    ),
    content: v.string(),
    version: v.number(),
    createdAt: v.number(),
  })
    .index("by_claw_and_type", ["clawId", "fileType"])
    .index("by_claw_type_version", ["clawId", "fileType", "version"]),

  notificationChannels: defineTable({
    userId: v.id("users"),
    type: v.union(
      v.literal("discord"),
      v.literal("slack"),
      v.literal("email"),
    ),
    webhookUrl: v.optional(v.string()),
    email: v.optional(v.string()),
    enabled: v.boolean(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  apiKeys: defineTable({
    userId: v.id("users"),
    name: v.string(),
    keyHash: v.string(),
    keyPrefix: v.string(),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_hash", ["keyHash"]),

  userQuotas: defineTable({
    userId: v.id("users"),
    maxClaws: v.number(),
    maxPorts: v.number(),
  }).index("by_user", ["userId"]),

  streamTokens: defineTable({
    tokenHash: v.string(),
    userId: v.id("users"),
    clawId: v.id("claws"),
    expiresAt: v.number(),
  })
    .index("by_hash", ["tokenHash"])
    .index("by_expiry", ["expiresAt"]),

  pendingNotifications: defineTable({
    channelId: v.id("notificationChannels"),
    userId: v.id("users"),
    title: v.string(),
    message: v.string(),
    createdAt: v.number(),
    sent: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_channel", ["channelId"]),
});
