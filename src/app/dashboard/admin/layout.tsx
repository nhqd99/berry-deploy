"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = useQuery(api.admin.isAdmin);
  const router = useRouter();

  useEffect(() => {
    if (isAdmin === false) {
      router.replace("/dashboard");
    }
  }, [isAdmin, router]);

  if (isAdmin === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded-lg shimmer bg-white/[0.06]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-xl shimmer bg-white/[0.06]" />
          <Skeleton className="h-24 rounded-xl shimmer bg-white/[0.06]" />
          <Skeleton className="h-24 rounded-xl shimmer bg-white/[0.06]" />
          <Skeleton className="h-24 rounded-xl shimmer bg-white/[0.06]" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return <>{children}</>;
}
