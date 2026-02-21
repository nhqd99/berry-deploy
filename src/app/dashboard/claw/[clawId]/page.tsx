"use client";

import { useQuery, useAction } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClawStatusBadge } from "@/components/claw-status-badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  Play,
  Square,
  RotateCcw,
  Trash2,
  FileText,
  ScrollText,
  Puzzle,
  Globe,
  Radio,
  Container,
  Clock,
  Loader2,
  ArrowLeft,
  MessageCircle,
  Check,
  RefreshCw,
} from "lucide-react";
import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { formatUptime } from "@/lib/utils";

export default function ClawDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clawId = params.clawId as Id<"claws">;

  const claw = useQuery(api.claws.get, { clawId });
  const logs = useQuery(api.logs.list, { clawId, limit: 10 });

  const startClaw = useAction(api.docker.startClaw);
  const stopClaw = useAction(api.docker.stopClaw);
  const restartClaw = useAction(api.docker.restartClaw);
  const removeClaw = useAction(api.docker.removeClaw);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (claw === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (claw === null) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Claw not found</p>
        <Link href="/dashboard">
          <Button variant="link">Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  async function handleAction(
    actionName: string,
    fn: (args: { clawId: Id<"claws"> }) => Promise<unknown>,
  ) {
    setActionLoading(actionName);
    try {
      await fn({ clawId });
    } catch (err) {
      console.error(`${actionName} failed:`, err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemove() {
    if (!confirm("Are you sure you want to remove this Claw? This action cannot be undone.")) {
      return;
    }
    setActionLoading("remove");
    try {
      await removeClaw({ clawId });
      router.push("/dashboard");
    } catch (err) {
      console.error("Remove failed:", err);
      setActionLoading(null);
    }
  }

  const uptime =
    claw.status === "running" && claw.lastStartedAt
      ? formatUptime(Date.now() - claw.lastStartedAt)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{claw.name}</h1>
            <ClawStatusBadge status={claw.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {claw.containerName}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={claw.status !== "stopped" || actionLoading !== null}
          onClick={() => handleAction("start", startClaw)}
        >
          {actionLoading === "start" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Start
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={claw.status !== "running" || actionLoading !== null}
          onClick={() => handleAction("stop", stopClaw)}
        >
          {actionLoading === "stop" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Square className="mr-2 h-4 w-4" />
          )}
          Stop
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={claw.status !== "running" || actionLoading !== null}
          onClick={() => handleAction("restart", restartClaw)}
        >
          {actionLoading === "restart" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          Restart
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={actionLoading !== null}
          onClick={handleRemove}
        >
          {actionLoading === "remove" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Remove
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Instance Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Gateway:</span>
              <span className="font-mono">:{claw.gatewayPort}</span>
            </div>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Bridge:</span>
              <span className="font-mono">:{claw.bridgePort}</span>
            </div>
            <div className="flex items-center gap-2">
              <Container className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Container:</span>
              <span className="font-mono text-xs">
                {claw.containerId?.slice(0, 12) ?? "N/A"}
              </span>
            </div>
            {uptime && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Uptime:</span>
                <span>{uptime}</span>
              </div>
            )}
            {claw.errorMessage && (
              <div className="rounded-md bg-destructive/10 p-2 text-destructive text-xs">
                {claw.errorMessage}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href={`/dashboard/claw/${clawId}/config`}>
              <Button variant="outline" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                Configuration (soul.md, memory.md)
              </Button>
            </Link>
            <Link href={`/dashboard/claw/${clawId}/logs`}>
              <Button variant="outline" className="w-full justify-start">
                <ScrollText className="mr-2 h-4 w-4" />
                Activity Logs
              </Button>
            </Link>
            <Link href={`/dashboard/claw/${clawId}/skills`}>
              <Button variant="outline" className="w-full justify-start">
                <Puzzle className="mr-2 h-4 w-4" />
                Skills
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Telegram Pairing */}
      {claw.telegramBotToken && claw.status === "running" && (
        <TelegramPairingCard clawId={clawId} />
      )}

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {logs && logs.length > 0 ? (
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log._id}
                  className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <LogTypeBadge type={log.type} />
                    <span>{log.message}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No activity yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TelegramPairingCard({ clawId }: { clawId: Id<"claws"> }) {
  const listPairing = useAction(api.docker.listTelegramPairing);
  const approvePairing = useAction(api.docker.approveTelegramPairing);

  const [requests, setRequests] = useState<Array<{ id: string; code: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [approveLoading, setApproveLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await listPairing({ clawId });
      setRequests(result);
    } catch {
      setMessage({ type: "error", text: "Failed to load pairing requests" });
    } finally {
      setLoading(false);
    }
  }, [clawId, listPairing]);

  async function handleApprove(code: string) {
    setApproveLoading(code);
    setMessage(null);
    try {
      const result = await approvePairing({ clawId, code });
      if (result.success) {
        setMessage({ type: "success", text: `Approved sender ${result.senderId}` });
        setManualCode("");
        await fetchRequests();
      } else {
        setMessage({ type: "error", text: result.error });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to approve" });
    } finally {
      setApproveLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Telegram Pairing
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchRequests} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          When someone messages your Telegram bot, they get a pairing code. Approve it here to allow them.
        </p>

        {/* Manual code input */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter pairing code (e.g. ABCD1234)"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            className="font-mono text-sm"
            maxLength={8}
          />
          <Button
            size="sm"
            disabled={!manualCode.trim() || approveLoading !== null}
            onClick={() => handleApprove(manualCode.trim())}
          >
            {approveLoading === manualCode.trim() ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Pending requests */}
        {requests.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Pending requests:</p>
            {requests.map((req) => (
              <div
                key={req.code}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="text-sm">
                  <span className="font-mono font-bold">{req.code}</span>
                  <span className="ml-2 text-muted-foreground">
                    from {req.id}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {new Date(req.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={approveLoading !== null}
                  onClick={() => handleApprove(req.code)}
                >
                  {approveLoading === req.code ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="mr-1 h-3 w-3" />
                  )}
                  Approve
                </Button>
              </div>
            ))}
          </div>
        )}

        {message && (
          <p className={`text-xs ${message.type === "success" ? "text-green-600" : "text-destructive"}`}>
            {message.text}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function LogTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    deploy: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    start: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    stop: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    restart: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    config_update: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    health_check: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${colors[type] ?? colors.health_check}`}
    >
      {type}
    </span>
  );
}
