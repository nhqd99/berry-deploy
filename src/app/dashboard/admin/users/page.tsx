"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Shield, User } from "lucide-react";
import { toast } from "sonner";

export default function AdminUsersPage() {
  const users = useQuery(api.admin.listAllUsers);
  const setUserRole = useMutation(api.admin.setUserRole);
  const setQuota = useMutation(api.quotas.setQuota);

  const [editingQuota, setEditingQuota] = useState<string | null>(null);
  const [quotaValue, setQuotaValue] = useState("5");

  if (users === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64 rounded-lg shimmer bg-white/[0.06]" />
        <Skeleton className="h-64 w-full rounded-xl shimmer bg-white/[0.06]" />
      </div>
    );
  }

  async function handleRoleChange(userId: Id<"users">, role: "admin" | "user") {
    try {
      await setUserRole({ userId, role });
      toast.success(`Role updated to ${role}`);
    } catch (err) {
      toast.error("Failed to update role", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  async function handleQuotaSave(userId: Id<"users">) {
    const num = parseInt(quotaValue, 10);
    if (isNaN(num) || num < 0) {
      toast.error("Invalid quota value");
      return;
    }
    try {
      await setQuota({ userId, maxClaws: num, maxPorts: num * 2 });
      toast.success("Quota updated");
      setEditingQuota(null);
    } catch (err) {
      toast.error("Failed to update quota", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/dashboard/admin" },
          { label: "Users" },
        ]}
      />

      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-indigo-400" />
        <h1 className="text-2xl font-bold tracking-tight text-gradient">All Users</h1>
        <span className="text-muted-foreground/60 text-sm">({users.length})</span>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <Card key={u._id} className="glass">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0">
                  {u.role === "admin" ? (
                    <Shield className="h-5 w-5 text-amber-400" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{u.name || "Unnamed"}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {u.email} · {u.clawCount} claw{u.clawCount !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Quota */}
                {editingQuota === u._id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      className="w-16 h-8 text-sm bg-white/[0.05] border-white/[0.10] rounded-xl"
                      value={quotaValue}
                      onChange={(e) => setQuotaValue(e.target.value)}
                      type="number"
                      min={0}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300"
                      onClick={() => handleQuotaSave(u._id as Id<"users">)}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="hover:bg-white/[0.06] rounded-xl transition-all duration-300"
                      onClick={() => setEditingQuota(null)}
                    >
                      X
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-muted-foreground/60 hover:bg-white/[0.06] rounded-xl transition-all duration-300"
                    onClick={() => {
                      setEditingQuota(u._id);
                      setQuotaValue("5");
                    }}
                  >
                    Quota
                  </Button>
                )}

                {/* Role */}
                <Select
                  value={u.role}
                  onValueChange={(v) =>
                    handleRoleChange(u._id as Id<"users">, v as "admin" | "user")
                  }
                >
                  <SelectTrigger className="w-24 h-8 bg-white/[0.05] border-white/[0.10] rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
