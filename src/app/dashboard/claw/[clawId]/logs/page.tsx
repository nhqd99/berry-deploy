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
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function LogsPage() {
  const params = useParams();
  const clawId = params.clawId as Id<"claws">;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/claw/${clawId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
          <p className="text-muted-foreground">
            Activity logs and container output
          </p>
        </div>
      </div>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity Logs</TabsTrigger>
          <TabsTrigger value="container">Container Logs</TabsTrigger>
        </TabsList>

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

function ActivityLogs({ clawId }: { clawId: Id<"claws"> }) {
  const logs = useQuery(api.logs.list, { clawId, limit: 100 });

  if (logs === undefined) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity logs</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log._id}
                className="flex items-start justify-between border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="flex items-start gap-3">
                  <LogTypeDot type={log.type} />
                  <div>
                    <p className="text-sm">{log.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
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
      setLogs(`Error fetching logs: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Container Output</CardTitle>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
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
          <p className="text-sm text-muted-foreground">
            Click &quot;Load Logs&quot; to fetch container output
          </p>
        ) : (
          <pre className="max-h-[500px] overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap">
            {logs || "No output"}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

function LogTypeDot({ type }: { type: string }) {
  const colors: Record<string, string> = {
    deploy: "bg-blue-500",
    start: "bg-green-500",
    stop: "bg-yellow-500",
    restart: "bg-orange-500",
    config_update: "bg-purple-500",
    error: "bg-red-500",
    health_check: "bg-gray-400",
  };

  return (
    <div className="mt-1.5 flex-shrink-0">
      <div className={`h-2.5 w-2.5 rounded-full ${colors[type] ?? "bg-gray-400"}`} />
    </div>
  );
}
