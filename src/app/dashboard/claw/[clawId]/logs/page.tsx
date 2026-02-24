"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { LogViewer } from "@/components/log-viewer";
import { useLogStream } from "@/hooks/use-log-stream";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function LogsPage() {
  const params = useParams();
  const clawId = params.clawId as Id<"claws">;
  const claw = useQuery(api.claws.get, { clawId });

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: claw?.name ?? "...", href: `/dashboard/claw/${clawId}` },
          { label: "Logs" },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient">Logs</h1>
        <p className="text-sm text-muted-foreground/80">
          Activity logs and container output
        </p>
      </div>

      <Tabs defaultValue="stream">
        <TabsList className="bg-white/[0.06] border border-white/[0.10] rounded-xl">
          <TabsTrigger value="stream" className="rounded-lg data-[state=active]:bg-indigo-500/15 data-[state=active]:text-indigo-400 transition-colors duration-200">Live Stream</TabsTrigger>
          <TabsTrigger value="activity" className="rounded-lg data-[state=active]:bg-indigo-500/15 data-[state=active]:text-indigo-400 transition-colors duration-200">Activity Logs</TabsTrigger>
          <TabsTrigger value="container" className="rounded-lg data-[state=active]:bg-indigo-500/15 data-[state=active]:text-indigo-400 transition-colors duration-200">Container Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="stream">
          <StreamingLogs clawId={clawId} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityLogs clawId={clawId} />
        </TabsContent>
        <TabsContent value="container">
          <ContainerLogs clawId={clawId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StreamingLogs({ clawId }: { clawId: Id<"claws"> }) {
  const createStreamToken = useAction(api.streaming.createStreamToken);
  const [streamInfo, setStreamInfo] = useState<{ token: string; containerId: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const { lines, connected, clear } = useLogStream(
    streamInfo?.containerId ?? null,
    streamInfo?.token ?? null,
  );

  async function startStream() {
    setStarting(true);
    try {
      const info = await createStreamToken({ clawId });
      setStreamInfo(info);
    } catch (err) {
      toast.error("Failed to start stream", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setStarting(false);
    }
  }

  if (!streamInfo) {
    return (
      <Card className="glass">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground/60 mb-4">
            Click to start real-time log streaming from the container.
          </p>
          <Button onClick={startStream} disabled={starting} className="btn-gradient text-white rounded-xl">
            {starting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Start Streaming
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <LogViewer lines={lines} connected={connected} onClear={clear} />;
}

function ActivityLogs({ clawId }: { clawId: Id<"claws"> }) {
  const logs = useQuery(api.logs.list, { clawId, limit: 100 });

  if (logs === undefined) {
    return (
      <Card className="glass">
        <CardHeader>
          <Skeleton className="h-5 w-32 rounded-lg shimmer bg-white/[0.06]" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start justify-between border-b border-white/[0.10] pb-3 last:border-0">
              <div className="flex items-start gap-3">
                <Skeleton className="mt-1.5 h-2.5 w-2.5 rounded-full shimmer bg-white/[0.06]" />
                <div>
                  <Skeleton className="h-4 w-48 rounded-lg shimmer bg-white/[0.06]" />
                  <Skeleton className="mt-1 h-3 w-28 rounded-lg shimmer bg-white/[0.06]" />
                </div>
              </div>
              <Skeleton className="h-5 w-14 rounded-md shimmer bg-white/[0.06]" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground/60">No activity logs</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log._id}
                className="flex items-start justify-between border-b border-white/[0.10] pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-start gap-3">
                  <LogTypeDot type={log.type} />
                  <div>
                    <p className="text-sm text-foreground/90">{log.message}</p>
                    <p className="text-[11px] text-muted-foreground/50 tabular-nums">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className="rounded-md border border-white/[0.10] bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium">
                  {log.type}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContainerLogs({ clawId }: { clawId: Id<"claws"> }) {
  const getClawLogs = useAction(api.docker.getClawLogs);
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function fetchLogs() {
    setLoading(true);
    try {
      const result = await getClawLogs({ clawId, tail: 200 });
      setLogs(result);
      setFetched(true);
    } catch (err) {
      toast.error("Failed to fetch logs", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">Container Output</CardTitle>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300">
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {fetched ? "Refresh" : "Load Logs"}
        </Button>
      </CardHeader>
      <CardContent>
        {!fetched && !loading ? (
          <p className="text-sm text-muted-foreground/60">
            Click &quot;Load Logs&quot; to fetch container output
          </p>
        ) : (
          <pre className="max-h-[300px] sm:max-h-[500px] overflow-auto rounded-xl bg-[oklch(0.11_0.012_264)] border border-white/[0.10] p-4 text-xs font-mono text-emerald-400/90 whitespace-pre-wrap">
            {logs || "No output"}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

function LogTypeDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    deploy: "bg-blue-500 shadow-sm shadow-blue-500/50",
    start: "bg-emerald-500 shadow-sm shadow-emerald-500/50",
    stop: "bg-yellow-500 shadow-sm shadow-yellow-500/50",
    restart: "bg-orange-500 shadow-sm shadow-orange-500/50",
    config_update: "bg-purple-500 shadow-sm shadow-purple-500/50",
    error: "bg-red-500 shadow-sm shadow-red-500/50",
    health_check: "bg-zinc-500",
  };

  return (
    <div className="mt-1.5 flex-shrink-0">
      <div className={`h-2.5 w-2.5 rounded-full ${colors[type] ?? "bg-zinc-500"}`} />
    </div>
  );
}
