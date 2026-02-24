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
import { ClawDetailSkeleton } from "@/components/claw-detail-skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { CloneDialog } from "@/components/clone-dialog";
import { ResourceMonitor } from "@/components/resource-monitor";
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
  MessageCircle,
  Check,
  RefreshCw,
  Activity,
  TerminalSquare,
  ChevronRight,
} from "lucide-react";
import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { formatUptime } from "@/lib/utils";
import { toast } from "sonner";

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
    return <ClawDetailSkeleton />;
  }

  if (claw === null) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Claw not found</p>
        <Link href="/dashboard">
          <Button variant="link" className="text-indigo-400 mt-2">Back to dashboard</Button>
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
      toast.success(`${actionName.charAt(0).toUpperCase() + actionName.slice(1)} successful`);
    } catch (err) {
      toast.error(`${actionName} failed`, {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemove() {
    setActionLoading("remove");
    try {
      await removeClaw({ clawId });
      toast.success("Claw removed");
      router.push("/dashboard");
    } catch (err) {
      toast.error("Remove failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setActionLoading(null);
    }
  }

  const uptime =
    claw.status === "running" && claw.lastStartedAt
      ? formatUptime(Date.now() - claw.lastStartedAt)
      : null;

  const managementLinks = [
    { href: `/dashboard/claw/${clawId}/config`, icon: FileText, label: "Configuration", desc: "soul.md, memory.md" },
    { href: `/dashboard/claw/${clawId}/logs`, icon: ScrollText, label: "Activity Logs", desc: "Live & historical" },
    { href: `/dashboard/claw/${clawId}/skills`, icon: Puzzle, label: "Skills", desc: "Manage extensions" },
    { href: `/dashboard/claw/${clawId}/monitoring`, icon: Activity, label: "Monitoring", desc: "CPU, memory, I/O" },
    { href: `/dashboard/claw/${clawId}/terminal`, icon: TerminalSquare, label: "Terminal", desc: "Interactive shell" },
    { href: `/dashboard/claw/${clawId}/domain`, icon: Globe, label: "Custom Domain", desc: claw.customDomain || "Not configured" },
  ];

  return (
    <div className="space-y-8">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: claw.name },
        ]}
      />

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-gradient">{claw.name}</h1>
          <ClawStatusBadge status={claw.status} />
        </div>
        <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
          {claw.containerName}
        </p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300"
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
          className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300"
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
          className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300"
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
        <ConfirmDialog
          trigger={
            <Button
              variant="destructive"
              size="sm"
              className="rounded-xl"
              disabled={actionLoading !== null}
            >
              {actionLoading === "remove" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Remove
            </Button>
          }
          title="Remove this Claw?"
          description="This will stop the container and permanently delete all data. This action cannot be undone."
          confirmLabel="Remove"
          variant="destructive"
          onConfirm={handleRemove}
        />
        <CloneDialog clawId={clawId} clawName={claw.name} />
      </div>

      {/* Resource Monitor (compact) */}
      {claw.status === "running" && (
        <ResourceMonitor clawId={clawId} compact />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Status Card */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Instance Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2.5">
              <Globe className="h-4 w-4 text-indigo-400/60" />
              <span className="text-muted-foreground/80">Gateway</span>
              <span className="ml-auto font-mono text-xs">:{claw.gatewayPort}</span>
            </div>
            <div className="divider-gradient" />
            <div className="flex items-center gap-2.5">
              <Radio className="h-4 w-4 text-indigo-400/60" />
              <span className="text-muted-foreground/80">Bridge</span>
              <span className="ml-auto font-mono text-xs">:{claw.bridgePort}</span>
            </div>
            <div className="divider-gradient" />
            <div className="flex items-center gap-2.5">
              <Container className="h-4 w-4 text-muted-foreground/50" />
              <span className="text-muted-foreground/80">Container</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground/60">
                {claw.containerId?.slice(0, 12) ?? "N/A"}
              </span>
            </div>
            {uptime && (
              <>
                <div className="divider-gradient" />
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-muted-foreground/50" />
                  <span className="text-muted-foreground/80">Uptime</span>
                  <span className="ml-auto text-xs">{uptime}</span>
                </div>
              </>
            )}
            {claw.errorMessage && (
              <div className="mt-2 rounded-xl bg-red-500/8 border border-red-500/15 p-3 text-red-300 text-xs">
                {claw.errorMessage}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links Card */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {managementLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300 hover:bg-white/[0.06]">
                  <link.icon className="h-4 w-4 text-indigo-400/60 group-hover:text-indigo-400 transition-colors duration-300" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium group-hover:text-indigo-300 transition-colors duration-300">{link.label}</p>
                    <p className="text-xs text-muted-foreground/50 truncate">{link.desc}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors duration-300" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Telegram Pairing */}
      {claw.telegramBotToken && claw.status === "running" && (
        <TelegramPairingCard clawId={clawId} />
      )}

      {/* Recent Activity */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {logs && logs.length > 0 ? (
            <div className="space-y-2.5">
              {logs.map((log) => (
                <div
                  key={log._id}
                  className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between pb-2.5 last:pb-0"
                  style={{ borderBottom: "1px solid oklch(1 0 0 / 6%)" }}
                >
                  <div className="flex items-center gap-2.5 text-sm">
                    <LogTypeBadge type={log.type} />
                    <span className="text-foreground/90">{log.message}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground/50 tabular-nums sm:ml-auto">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/50">No activity yet</p>
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

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listPairing({ clawId });
      setRequests(result);
    } catch {
      toast.error("Failed to load pairing requests");
    } finally {
      setLoading(false);
    }
  }, [clawId, listPairing]);

  async function handleApprove(code: string) {
    setApproveLoading(code);
    try {
      const result = await approvePairing({ clawId, code });
      if (result.success) {
        toast.success(`Approved sender ${result.senderId}`);
        setManualCode("");
        await fetchRequests();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to approve");
    } finally {
      setApproveLoading(null);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-indigo-400/60" />
            Telegram Pairing
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchRequests} disabled={loading} className="h-8 w-8 rounded-xl hover:bg-white/[0.06]">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground/60">
          When someone messages your Telegram bot, they get a pairing code. Approve it here to allow them.
        </p>

        {/* Manual code input */}
        <div className="flex gap-2">
          <div className="flex-1 input-glow rounded-xl">
            <Input
              placeholder="Enter pairing code (e.g. ABCD1234)"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              className="font-mono text-sm bg-white/[0.05] border-white/[0.10] rounded-xl"
              maxLength={8}
            />
          </div>
          <Button
            size="sm"
            className="btn-gradient text-white rounded-xl"
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
            <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider">Pending requests</p>
            {requests.map((req) => (
              <div
                key={req.code}
                className="flex items-center justify-between rounded-xl border border-white/[0.10] px-3 py-2.5 bg-white/[0.02]"
              >
                <div className="text-sm">
                  <span className="font-mono font-bold text-indigo-300">{req.code}</span>
                  <span className="ml-2 text-muted-foreground/60">
                    from {req.id}
                  </span>
                  <span className="ml-2 text-[11px] text-muted-foreground/40">
                    {new Date(req.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/[0.10] rounded-xl hover:bg-white/[0.06]"
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
      </CardContent>
    </Card>
  );
}

function LogTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    deploy: "bg-blue-500/10 text-blue-300 border-blue-400/15",
    start: "bg-emerald-500/10 text-emerald-300 border-emerald-400/15",
    stop: "bg-yellow-500/10 text-yellow-300 border-yellow-400/15",
    restart: "bg-orange-500/10 text-orange-300 border-orange-400/15",
    config_update: "bg-purple-500/10 text-purple-300 border-purple-400/15",
    error: "bg-red-500/10 text-red-300 border-red-400/15",
    health_check: "bg-zinc-500/10 text-zinc-400 border-zinc-500/15",
  };

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${colors[type] ?? colors.health_check}`}
    >
      {type}
    </span>
  );
}
