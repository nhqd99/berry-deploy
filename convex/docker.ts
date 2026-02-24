"use node";

import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { execSync } from "child_process";
import { randomBytes } from "crypto";
import * as fs from "fs";
import { Id } from "./_generated/dataModel";

const OPENCLAW_IMAGE = process.env.OPENCLAW_IMAGE || "openclaw:local";
const DATA_DIR = process.env.OPENCLAW_DATA_DIR || "/data/berry-claw/claws";

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function isValidEnvKey(key: string): boolean {
  return /^[A-Z_][A-Z0-9_]*$/.test(key);
}

function dockerExec(cmd: string): string {
  return execSync(`docker ${cmd}`, { encoding: "utf-8", timeout: 30000 }).trim();
}

export const deployClaw = action({
  args: {
    name: v.string(),
    telegramBotToken: v.optional(v.string()),
    envVars: v.optional(v.any()),
  },
  returns: v.object({
    clawId: v.id("claws"),
    containerId: v.string(),
  }),
  handler: async (ctx, args): Promise<{ clawId: Id<"claws">; containerId: string }> => {
    const gatewayToken = randomBytes(32).toString("hex");

    const containerName = `berry-claw-${args.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
    const configDir = `${DATA_DIR}/${containerName}`;

    const clawId = await ctx.runMutation(api.claws.create, {
      name: args.name,
      containerName,
      gatewayToken,
      telegramBotToken: args.telegramBotToken,
      configDir,
      envVars: args.envVars,
    });

    // Fetch the claw to get the atomically-allocated ports
    const claw = await ctx.runQuery(api.claws.get, { clawId });
    if (!claw) throw new Error("Failed to retrieve created claw");

    try {
      fs.mkdirSync(`${configDir}/config`, { recursive: true });
      fs.mkdirSync(`${configDir}/workspace/skills`, { recursive: true });

      const configs = await ctx.runQuery(api.configs.listByClawId, { clawId });
      for (const config of configs) {
        fs.writeFileSync(`${configDir}/config/${config.fileType}`, config.content, "utf-8");
      }

      const envFlags = [
        `-e HOME=/home/node`,
        `-e TERM=xterm-256color`,
        `-e OPENCLAW_GATEWAY_TOKEN=${shellEscape(gatewayToken)}`,
        `-e NODE_ENV=production`,
      ];
      if (args.telegramBotToken) {
        envFlags.push(`-e TELEGRAM_BOT_TOKEN=${shellEscape(args.telegramBotToken)}`);
      }
      if (args.envVars && typeof args.envVars === "object") {
        for (const [key, value] of Object.entries(args.envVars as Record<string, string>)) {
          if (!isValidEnvKey(key)) throw new Error(`Invalid env var key: ${key}`);
          envFlags.push(`-e ${key}=${shellEscape(String(value))}`);
        }
      }

      const containerId = dockerExec(
        `run -d --name ${containerName} ` +
        `--init --restart unless-stopped ` +
        `-p ${claw.gatewayPort}:18789 -p ${claw.bridgePort}:18790 ` +
        `-v ${configDir}/config:/home/node/.openclaw:rw ` +
        `-v ${configDir}/workspace:/home/node/.openclaw/workspace:rw ` +
        `${envFlags.join(" ")} ` +
        `${OPENCLAW_IMAGE} ` +
        `node openclaw.mjs gateway --allow-unconfigured --bind lan`
      );

      await ctx.runMutation(internal.claws.updateStatus, {
        clawId,
        status: "running",
        containerId,
      });

      await ctx.runMutation(internal.logs.create, {
        clawId,
        type: "deploy",
        message: `Claw "${args.name}" deployed on ports ${claw.gatewayPort}/${claw.bridgePort}`,
      });

      return { clawId, containerId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await ctx.runMutation(internal.claws.updateStatus, {
        clawId,
        status: "error",
        errorMessage: message,
      });
      await ctx.runMutation(internal.logs.create, {
        clawId,
        type: "error",
        message: `Deployment failed: ${message}`,
      });
      throw error;
    }
  },
});

export const startClaw = action({
  args: { clawId: v.id("claws") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const claw = await ctx.runQuery(api.claws.get, { clawId: args.clawId });
    if (!claw?.containerId) throw new Error("Container not found");

    dockerExec(`start ${claw.containerId}`);

    await ctx.runMutation(internal.claws.updateStatus, {
      clawId: args.clawId,
      status: "running",
    });
    await ctx.runMutation(internal.logs.create, {
      clawId: args.clawId,
      type: "start",
      message: `Claw "${claw.name}" started`,
    });
    return null;
  },
});

export const stopClaw = action({
  args: { clawId: v.id("claws") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const claw = await ctx.runQuery(api.claws.get, { clawId: args.clawId });
    if (!claw?.containerId) throw new Error("Container not found");

    dockerExec(`stop -t 10 ${claw.containerId}`);

    await ctx.runMutation(internal.claws.updateStatus, {
      clawId: args.clawId,
      status: "stopped",
    });
    await ctx.runMutation(internal.logs.create, {
      clawId: args.clawId,
      type: "stop",
      message: `Claw "${claw.name}" stopped`,
    });
    return null;
  },
});

export const restartClaw = action({
  args: { clawId: v.id("claws") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const claw = await ctx.runQuery(api.claws.get, { clawId: args.clawId });
    if (!claw?.containerId) throw new Error("Container not found");

    dockerExec(`restart -t 10 ${claw.containerId}`);

    await ctx.runMutation(internal.claws.updateStatus, {
      clawId: args.clawId,
      status: "running",
    });
    await ctx.runMutation(internal.logs.create, {
      clawId: args.clawId,
      type: "restart",
      message: `Claw "${claw.name}" restarted`,
    });
    return null;
  },
});

export const removeClaw = action({
  args: { clawId: v.id("claws") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const claw = await ctx.runQuery(api.claws.get, { clawId: args.clawId });
    if (!claw) throw new Error("Claw not found");

    await ctx.runMutation(internal.claws.updateStatus, {
      clawId: args.clawId,
      status: "removing",
    });

    if (claw.containerId) {
      try { dockerExec(`stop -t 5 ${claw.containerId}`); } catch { /* already stopped */ }
      try { dockerExec(`rm -f ${claw.containerId}`); } catch { /* already removed */ }
    }

    await ctx.runMutation(api.claws.remove, { clawId: args.clawId });
    return null;
  },
});

export const getClawLogs = action({
  args: {
    clawId: v.id("claws"),
    tail: v.optional(v.number()),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const claw = await ctx.runQuery(api.claws.get, { clawId: args.clawId });
    if (!claw?.containerId) return "";

    try {
      return dockerExec(`logs --tail ${args.tail ?? 200} --timestamps ${claw.containerId}`);
    } catch {
      return "Failed to fetch logs";
    }
  },
});

export const syncConfig = action({
  args: {
    clawId: v.id("claws"),
    fileType: v.union(
      v.literal("soul.md"),
      v.literal("memory.md"),
      v.literal("AGENTS.md"),
    ),
    content: v.string(),
    restart: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await ctx.runMutation(api.configs.save, {
      clawId: args.clawId,
      fileType: args.fileType,
      content: args.content,
    });

    const claw = await ctx.runQuery(api.claws.get, { clawId: args.clawId });
    if (!claw) throw new Error("Claw not found");

    const filePath = `${claw.configDir}/config/${args.fileType}`;
    fs.writeFileSync(filePath, args.content, "utf-8");

    if (args.restart && claw.containerId) {
      dockerExec(`restart -t 5 ${claw.containerId}`);
      await ctx.runMutation(internal.logs.create, {
        clawId: args.clawId,
        type: "restart",
        message: `Restarted after updating ${args.fileType}`,
      });
    }
    return null;
  },
});

// --- Skills Sync ---

function resolveOpenClawConfigPath(configDir: string): string {
  return `${configDir}/config/openclaw.json`;
}

function readOpenClawConfig(configDir: string): Record<string, unknown> {
  return readJsonSafe(resolveOpenClawConfigPath(configDir), {});
}

function writeOpenClawConfig(configDir: string, config: Record<string, unknown>): void {
  fs.writeFileSync(resolveOpenClawConfigPath(configDir), JSON.stringify(config, null, 2), "utf-8");
}

function isValidSkillName(name: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/i.test(name) && name.length <= 64;
}

export const addSkill = action({
  args: {
    clawId: v.id("claws"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("skills"),
  handler: async (ctx, args): Promise<Id<"skills">> => {
    if (!isValidSkillName(args.name)) {
      throw new Error("Invalid skill name. Use lowercase letters, numbers, hyphens, and dots.");
    }

    const claw = await ctx.runQuery(api.claws.get, { clawId: args.clawId });
    if (!claw) throw new Error("Claw not found");

    // Save to DB
    const skillId = await ctx.runMutation(api.skills.add, {
      clawId: args.clawId,
      name: args.name,
      description: args.description,
    });

    // Write SKILL.md to workspace/skills/{name}/
    const skillDir = `${claw.configDir}/workspace/skills/${args.name}`;
    fs.mkdirSync(skillDir, { recursive: true });

    const description = args.description || `Custom skill: ${args.name}`;
    const skillMd = `---\nname: ${args.name}\ndescription: ${description}\n---\n\n# ${args.name}\n\n${description}\n`;
    fs.writeFileSync(`${skillDir}/SKILL.md`, skillMd, "utf-8");

    // Enable in openclaw.json
    const config = readOpenClawConfig(claw.configDir);
    if (!config.skills) config.skills = {};
    const skills = config.skills as Record<string, unknown>;
    if (!skills.entries) skills.entries = {};
    const entries = skills.entries as Record<string, unknown>;
    entries[args.name] = { enabled: true };
    writeOpenClawConfig(claw.configDir, config);

    await ctx.runMutation(internal.logs.create, {
      clawId: args.clawId,
      type: "config_update",
      message: `Added skill "${args.name}"`,
    });

    return skillId;
  },
});

export const toggleSkill = action({
  args: {
    skillId: v.id("skills"),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // Update DB first to get skill info
    await ctx.runMutation(api.skills.toggle, {
      skillId: args.skillId,
      enabled: args.enabled,
    });

    // Re-fetch the skill to get name + clawId
    const skill = await ctx.runQuery(internal.skills.getById, { skillId: args.skillId });
    if (!skill) throw new Error("Skill not found");

    const claw = await ctx.runQuery(api.claws.get, { clawId: skill.clawId });
    if (!claw) throw new Error("Claw not found");

    // Update openclaw.json skills.entries
    const config = readOpenClawConfig(claw.configDir);
    if (!config.skills) config.skills = {};
    const skills = config.skills as Record<string, unknown>;
    if (!skills.entries) skills.entries = {};
    const entries = skills.entries as Record<string, unknown>;
    entries[skill.name] = { enabled: args.enabled };
    writeOpenClawConfig(claw.configDir, config);

    await ctx.runMutation(internal.logs.create, {
      clawId: skill.clawId,
      type: "config_update",
      message: `${args.enabled ? "Enabled" : "Disabled"} skill "${skill.name}"`,
    });

    return null;
  },
});

export const removeSkill = action({
  args: { skillId: v.id("skills") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    // Fetch skill before deleting from DB
    const skill = await ctx.runQuery(internal.skills.getById, { skillId: args.skillId });
    if (!skill) throw new Error("Skill not found");

    const claw = await ctx.runQuery(api.claws.get, { clawId: skill.clawId });
    if (!claw) throw new Error("Claw not found");

    // Delete from DB
    await ctx.runMutation(api.skills.remove, { skillId: args.skillId });

    // Remove SKILL.md directory from workspace
    const skillDir = `${claw.configDir}/workspace/skills/${skill.name}`;
    fs.rmSync(skillDir, { recursive: true, force: true });

    // Remove from openclaw.json skills.entries
    const config = readOpenClawConfig(claw.configDir);
    const skills = (config.skills ?? {}) as Record<string, unknown>;
    const entries = (skills.entries ?? {}) as Record<string, unknown>;
    delete entries[skill.name];
    writeOpenClawConfig(claw.configDir, config);

    await ctx.runMutation(internal.logs.create, {
      clawId: skill.clawId,
      type: "config_update",
      message: `Removed skill "${skill.name}"`,
    });

    return null;
  },
});

export const healthCheck = internalAction({
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const runningClaws = await ctx.runQuery(internal.claws.listByStatus, {
      statuses: ["running"],
    });

    for (const claw of runningClaws) {
      if (!claw.containerId) continue;
      try {
        const status = dockerExec(
          `inspect --format '{{.State.Running}}:{{.State.ExitCode}}' ${claw.containerId}`
        );
        const [running, exitCode] = status.split(":");

        if (running !== "true") {
          await ctx.runMutation(internal.claws.updateStatus, {
            clawId: claw._id,
            status: "error",
            errorMessage: `Container exited with code ${exitCode}`,
          });
          await ctx.runMutation(internal.logs.create, {
            clawId: claw._id,
            type: "error",
            message: `Container stopped unexpectedly (exit code: ${exitCode})`,
          });
          // Send crash notification
          await ctx.runMutation(internal.notifications.sendCrashNotification, {
            userId: claw.userId,
            clawName: claw.name,
            errorMessage: `Container exited with code ${exitCode}`,
          });
        } else {
          await ctx.runMutation(internal.claws.updateStatus, {
            clawId: claw._id,
            status: "running",
          });
        }
      } catch {
        await ctx.runMutation(internal.claws.updateStatus, {
          clawId: claw._id,
          status: "error",
          errorMessage: "Container not found",
        });
      }
    }
    return null;
  },
});

// --- Telegram Pairing ---

type PairingRequest = {
  id: string;
  code: string;
  createdAt: string;
  lastSeenAt: string;
  meta?: Record<string, string>;
};

type PairingStore = {
  version: 1;
  requests: PairingRequest[];
};

type AllowFromStore = {
  version: 1;
  allowFrom: string[];
};

function resolvePairingPath(configDir: string): string {
  return `${configDir}/config/credentials/telegram-pairing.json`;
}

function resolveAllowFromPath(configDir: string): string {
  return `${configDir}/config/credentials/telegram-allowFrom.json`;
}

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

export const listTelegramPairing = action({
  args: { clawId: v.id("claws") },
  returns: v.array(v.object({
    id: v.string(),
    code: v.string(),
    createdAt: v.string(),
  })),
  handler: async (ctx, args): Promise<Array<{ id: string; code: string; createdAt: string }>> => {
    const claw = await ctx.runQuery(api.claws.get, { clawId: args.clawId });
    if (!claw) throw new Error("Claw not found");

    const filePath = resolvePairingPath(claw.configDir);
    const store = readJsonSafe<PairingStore>(filePath, { version: 1, requests: [] });
    const now = Date.now();
    const TTL = 60 * 60 * 1000; // 1 hour

    return (store.requests || [])
      .filter((r) => {
        const created = Date.parse(r.createdAt);
        return Number.isFinite(created) && now - created < TTL;
      })
      .map((r) => ({ id: r.id, code: r.code, createdAt: r.createdAt }));
  },
});

export const approveTelegramPairing = action({
  args: {
    clawId: v.id("claws"),
    code: v.string(),
  },
  returns: v.union(
    v.object({ success: v.literal(true), senderId: v.string() }),
    v.object({ success: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, args): Promise<{ success: true; senderId: string } | { success: false; error: string }> => {
    const claw = await ctx.runQuery(api.claws.get, { clawId: args.clawId });
    if (!claw) throw new Error("Claw not found");

    const code = args.code.trim().toUpperCase();
    if (!code) return { success: false, error: "Code is empty" };

    const pairingPath = resolvePairingPath(claw.configDir);
    const store = readJsonSafe<PairingStore>(pairingPath, { version: 1, requests: [] });

    const idx = (store.requests || []).findIndex(
      (r) => String(r.code || "").toUpperCase() === code,
    );
    if (idx < 0) return { success: false, error: "No pending request for this code" };

    const entry = store.requests[idx];
    const senderId = entry.id;

    // Remove from pending
    store.requests.splice(idx, 1);
    fs.mkdirSync(`${claw.configDir}/config/credentials`, { recursive: true });
    fs.writeFileSync(pairingPath, JSON.stringify(store, null, 2), "utf-8");

    // Add to allowFrom
    const allowPath = resolveAllowFromPath(claw.configDir);
    const allowStore = readJsonSafe<AllowFromStore>(allowPath, { version: 1, allowFrom: [] });
    if (!allowStore.allowFrom.includes(senderId)) {
      allowStore.allowFrom.push(senderId);
    }
    fs.writeFileSync(allowPath, JSON.stringify(allowStore, null, 2), "utf-8");

    await ctx.runMutation(internal.logs.create, {
      clawId: args.clawId,
      type: "config_update",
      message: `Approved Telegram pairing for sender ${senderId}`,
    });

    return { success: true, senderId };
  },
});
