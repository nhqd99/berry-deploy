"use client";

import { useState, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cpu, MemoryStick, Network, HardDrive, Activity } from "lucide-react";

type Stats = {
  cpuPercent: number;
  memUsage: string;
  memPercent: number;
  netIO: string;
  blockIO: string;
  pids: number;
};

export function ResourceMonitor({
  clawId,
  compact = false,
}: {
  clawId: Id<"claws">;
  compact?: boolean;
}) {
  const getStats = useAction(api.monitoring.getContainerStats);
  const [stats, setStats] = useState<Stats | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const result = await getStats({ clawId });
      if (result) setStats(result);
    } catch {
      // Silently fail — container might not be running
    }
  }, [clawId, getStats]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (!stats) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3 w-3 text-indigo-400" />
          <Progress value={stats.cpuPercent} className="w-16 h-1.5 [&>div]:bg-indigo-500" />
          <span className="text-muted-foreground">{stats.cpuPercent.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MemoryStick className="h-3 w-3 text-emerald-400" />
          <Progress value={stats.memPercent} className="w-16 h-1.5 [&>div]:bg-emerald-500" />
          <span className="text-muted-foreground">{stats.memPercent.toFixed(1)}%</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-400/60" />
          Resources
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-indigo-400/60" />
              <span>CPU</span>
            </div>
            <span className="font-mono text-xs tabular-nums">{stats.cpuPercent.toFixed(1)}%</span>
          </div>
          <Progress value={stats.cpuPercent} className="[&>div]:bg-indigo-500" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <MemoryStick className="h-4 w-4 text-emerald-400/60" />
              <span>Memory</span>
            </div>
            <span className="font-mono text-xs tabular-nums">{stats.memUsage} ({stats.memPercent.toFixed(1)}%)</span>
          </div>
          <Progress value={stats.memPercent} className="[&>div]:bg-emerald-500" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-muted-foreground/50" />
            <div>
              <p className="text-xs text-muted-foreground/60">Network I/O</p>
              <p className="font-mono text-xs tabular-nums">{stats.netIO}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-muted-foreground/50" />
            <div>
              <p className="text-xs text-muted-foreground/60">Block I/O</p>
              <p className="font-mono text-xs tabular-nums">{stats.blockIO}</p>
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground/50 tabular-nums">
          PIDs: {stats.pids}
        </div>
      </CardContent>
    </Card>
  );
}
