"use client";

import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { ClawCard } from "@/components/claw-card";
import { ClawCardSkeleton } from "@/components/claw-card-skeleton";
import {
  ClawListToolbar,
  type StatusFilter,
  type SortOption,
} from "@/components/claw-list-toolbar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Bot } from "lucide-react";
import Link from "next/link";

const STATUS_ORDER: Record<string, number> = {
  running: 0,
  creating: 1,
  error: 2,
  stopped: 3,
  removing: 4,
};

export default function DashboardPage() {
  const claws = useQuery(api.claws.list);
  const quota = useQuery(api.quotas.getQuota);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const filtered = useMemo(() => {
    if (!claws) return [];
    let result = [...claws];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.containerName.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }

    result.sort((a, b) => {
      switch (sort) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "newest":
          return b.createdAt - a.createdAt;
        case "oldest":
          return a.createdAt - b.createdAt;
        case "status":
          return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
        default:
          return 0;
      }
    });

    return result;
  }, [claws, search, statusFilter, sort]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient">My Claws</h1>
          <p className="mt-1 text-sm text-muted-foreground/80">
            Manage your OpenClaw instances
          </p>
        </div>
        <Link href="/dashboard/claw/new">
          <Button className="btn-gradient text-white font-medium rounded-xl">
            <Plus className="mr-2 h-4 w-4" />
            Deploy New
          </Button>
        </Link>
      </div>

      {quota && (
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground/70">
            {quota.usedClaws}/{quota.maxClaws} Claws
          </span>
          <Progress value={(quota.usedClaws / quota.maxClaws) * 100} className="w-32 h-1.5 [&>div]:bg-gradient-to-r [&>div]:from-indigo-500 [&>div]:to-violet-500" />
        </div>
      )}

      {claws === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ClawCardSkeleton key={i} />
          ))}
        </div>
      ) : claws.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.10] py-20 glass">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10 ring-1 ring-white/[0.06] mb-5">
            <Bot className="h-8 w-8 text-indigo-400/60" />
          </div>
          <h3 className="text-lg font-semibold">No Claws yet</h3>
          <p className="mt-1.5 text-sm text-muted-foreground/70">
            Deploy your first OpenClaw instance to get started.
          </p>
          <Link href="/dashboard/claw/new" className="mt-6">
            <Button className="btn-gradient text-white font-medium rounded-xl">
              <Plus className="mr-2 h-4 w-4" />
              Deploy New Claw
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <ClawListToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sort={sort}
            onSortChange={setSort}
          />
          {filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-sm text-muted-foreground/60">
                No claws match your filters
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((claw) => (
                <ClawCard key={claw._id} claw={claw} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
