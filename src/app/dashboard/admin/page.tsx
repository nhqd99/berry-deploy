"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import Link from "next/link";
import {
  Users,
  Container,
  Play,
  Square,
  AlertTriangle,
  Shield,
} from "lucide-react";

export default function AdminPage() {
  const stats = useQuery(api.admin.getSystemStats);

  if (stats === undefined) {
    return (
      <div className="space-y-6">
        <PageBreadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin" }]} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl shimmer bg-white/[0.06]" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-blue-400" },
    { label: "Total Claws", value: stats.totalClaws, icon: Container, color: "text-purple-400" },
    { label: "Running", value: stats.running, icon: Play, color: "text-emerald-400" },
    { label: "Stopped", value: stats.stopped, icon: Square, color: "text-yellow-400" },
    { label: "Errors", value: stats.error, icon: AlertTriangle, color: "text-red-400" },
    { label: "Creating", value: stats.creating, icon: Container, color: "text-blue-300" },
  ];

  return (
    <div className="space-y-6">
      <PageBreadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin" }]} />

      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-amber-400" />
        <h1 className="text-2xl font-bold tracking-tight text-gradient">Admin Dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="glass accent-line">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground/70 uppercase tracking-wider">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/dashboard/admin/users">
          <Card className="glass glass-hover cursor-pointer hover:glow-indigo">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-indigo-400" />
                Manage Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View all users, manage roles and quotas
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/admin/claws">
          <Card className="glass glass-hover cursor-pointer hover:glow-indigo">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Container className="h-4 w-4 text-indigo-400" />
                Manage Claws
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View all claws across users, force actions
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
