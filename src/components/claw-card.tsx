"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClawStatusBadge } from "@/components/claw-status-badge";
import { Globe, Radio, Clock } from "lucide-react";
import { Doc } from "@convex/_generated/dataModel";
import { formatUptime } from "@/lib/utils";

export function ClawCard({ claw }: { claw: Doc<"claws"> }) {
  const uptime = claw.status === "running" && claw.lastStartedAt
    ? formatUptime(Date.now() - claw.lastStartedAt)
    : null;

  return (
    <Link href={`/dashboard/claw/${claw._id}`}>
      <Card className="glass glass-hover group cursor-pointer relative overflow-hidden">
        {/* Top accent line */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold transition-colors duration-300 group-hover:text-indigo-300">{claw.name}</CardTitle>
          <ClawStatusBadge status={claw.status} />
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2.5">
              <Globe className="h-3.5 w-3.5 text-indigo-400/60" />
              <span className="font-mono text-xs">:{claw.gatewayPort}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Radio className="h-3.5 w-3.5 text-indigo-400/60" />
              <span className="font-mono text-xs">:{claw.bridgePort}</span>
            </div>
            {uptime && (
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground/60">
                <Clock className="h-3 w-3" />
                <span>{uptime}</span>
              </div>
            )}
          </div>
        </CardContent>

        {/* Hover glow */}
        <div className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 h-20 w-40 rounded-full bg-indigo-500/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </Card>
    </Link>
  );
}
