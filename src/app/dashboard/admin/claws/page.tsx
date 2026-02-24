"use client";

import { useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { ClawStatusBadge } from "@/components/claw-status-badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Container, Square, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";

export default function AdminClawsPage() {
  const claws = useQuery(api.admin.listAllClaws);
  const stopClaw = useAction(api.docker.stopClaw);
  const removeClaw = useAction(api.docker.removeClaw);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (claws === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64 rounded-lg shimmer bg-white/[0.06]" />
        <Skeleton className="h-64 w-full rounded-xl shimmer bg-white/[0.06]" />
      </div>
    );
  }

  async function handleStop(clawId: Id<"claws">) {
    setActionLoading(clawId);
    try {
      await stopClaw({ clawId });
      toast.success("Claw stopped");
    } catch (err) {
      toast.error("Failed to stop", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemove(clawId: Id<"claws">) {
    setActionLoading(clawId);
    try {
      await removeClaw({ clawId });
      toast.success("Claw removed");
    } catch (err) {
      toast.error("Failed to remove", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/dashboard/admin" },
          { label: "Claws" },
        ]}
      />

      <div className="flex items-center gap-2">
        <Container className="h-5 w-5 text-indigo-400" />
        <h1 className="text-2xl font-bold tracking-tight text-gradient">All Claws</h1>
        <span className="text-muted-foreground/60 text-sm">({claws.length})</span>
      </div>

      <div className="space-y-3">
        {claws.length === 0 ? (
          <p className="text-muted-foreground/60 text-sm">No claws deployed yet.</p>
        ) : (
          claws.map((claw) => (
            <Card key={claw._id} className="glass">
              <CardContent className="flex items-center justify-between py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/claw/${claw._id}`}
                      className="font-medium hover:text-indigo-400 transition-colors"
                    >
                      {claw.name}
                    </Link>
                    <ClawStatusBadge status={claw.status} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    Owner: {claw.ownerName} ({claw.ownerEmail}) ·{" "}
                    Ports: {claw.gatewayPort}/{claw.bridgePort}
                    {claw.customDomain && ` · ${claw.customDomain}`}
                  </p>
                  {claw.errorMessage && (
                    <p className="text-xs text-red-400 mt-1 truncate">
                      {claw.errorMessage}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {claw.status === "running" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300"
                      disabled={actionLoading === claw._id}
                      onClick={() => handleStop(claw._id as Id<"claws">)}
                    >
                      {actionLoading === claw._id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Square className="mr-1 h-3 w-3" />
                      )}
                      Stop
                    </Button>
                  )}
                  <ConfirmDialog
                    title="Force remove this claw?"
                    description={`This will permanently remove "${claw.name}" owned by ${claw.ownerEmail}. This action cannot be undone.`}
                    confirmLabel="Remove"
                    variant="destructive"
                    onConfirm={() => handleRemove(claw._id as Id<"claws">)}
                    trigger={
                      <Button
                        variant="ghost"
                        size="sm"
                        className="hover:bg-white/[0.06] rounded-xl transition-all duration-300"
                        disabled={actionLoading === claw._id}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
