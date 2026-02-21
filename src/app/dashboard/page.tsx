"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ClawCard } from "@/components/claw-card";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Bot } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const claws = useQuery(api.claws.list);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Claws</h1>
          <p className="text-muted-foreground">
            Manage your OpenClaw instances
          </p>
        </div>
        <Link href="/dashboard/claw/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Deploy New Claw
          </Button>
        </Link>
      </div>

      {claws === undefined ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : claws.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20">
          <Bot className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No Claws yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Deploy your first OpenClaw instance to get started.
          </p>
          <Link href="/dashboard/claw/new" className="mt-4">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Deploy New Claw
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {claws.map((claw) => (
            <ClawCard key={claw._id} claw={claw} />
          ))}
        </div>
      )}
    </div>
  );
}
