"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ClawStatusBadge } from "@/components/claw-status-badge";
import { Globe, Radio } from "lucide-react";
import { Doc } from "@convex/_generated/dataModel";
import { formatUptime } from "@/lib/utils";

export function ClawCard({ claw }: { claw: Doc<"claws"> }) {
  const uptime = claw.status === "running" && claw.lastStartedAt
    ? formatUptime(Date.now() - claw.lastStartedAt)
    : null;

  return (
    <Link href={`/dashboard/claw/${claw._id}`}>
      <Card className="transition-shadow hover:shadow-md cursor-pointer">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-semibold">{claw.name}</CardTitle>
          <ClawStatusBadge status={claw.status} />
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5" />
              <span>Gateway: :{claw.gatewayPort}</span>
            </div>
            <div className="flex items-center gap-2">
              <Radio className="h-3.5 w-3.5" />
              <span>Bridge: :{claw.bridgePort}</span>
            </div>
            {uptime && (
              <div className="text-xs text-muted-foreground/70">
                Uptime: {uptime}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
