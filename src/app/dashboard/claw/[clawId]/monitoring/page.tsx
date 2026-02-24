"use client";

import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { ResourceMonitor } from "@/components/resource-monitor";

export default function MonitoringPage() {
  const params = useParams();
  const clawId = params.clawId as Id<"claws">;
  const claw = useQuery(api.claws.get, { clawId });

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: claw?.name ?? "...", href: `/dashboard/claw/${clawId}` },
          { label: "Monitoring" },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient">Resource Monitoring</h1>
        <p className="text-sm text-muted-foreground/80">
          Live resource usage for this container
        </p>
      </div>

      {claw?.status === "running" ? (
        <ResourceMonitor clawId={clawId} />
      ) : (
        <div className="glass py-16 text-center">
          <p className="text-sm text-muted-foreground/60">
            Container is not running. Start the claw to view resource stats.
          </p>
        </div>
      )}
    </div>
  );
}
