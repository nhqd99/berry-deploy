import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ClawDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-6 w-48 rounded-lg shimmer bg-white/[0.06]" />
        <Skeleton className="h-5 w-16 rounded-full shimmer bg-white/[0.06]" />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-xl shimmer bg-white/[0.06]" />
        <Skeleton className="h-9 w-20 rounded-xl shimmer bg-white/[0.06]" />
        <Skeleton className="h-9 w-24 rounded-xl shimmer bg-white/[0.06]" />
        <Skeleton className="h-9 w-24 rounded-xl shimmer bg-white/[0.06]" />
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass">
          <CardHeader>
            <Skeleton className="h-5 w-28 rounded-lg shimmer bg-white/[0.06]" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-40 rounded-lg shimmer bg-white/[0.06]" />
            <Skeleton className="h-4 w-36 rounded-lg shimmer bg-white/[0.06]" />
            <Skeleton className="h-4 w-48 rounded-lg shimmer bg-white/[0.06]" />
            <Skeleton className="h-4 w-32 rounded-lg shimmer bg-white/[0.06]" />
          </CardContent>
        </Card>
        <Card className="glass">
          <CardHeader>
            <Skeleton className="h-5 w-28 rounded-lg shimmer bg-white/[0.06]" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-10 w-full rounded-xl shimmer bg-white/[0.06]" />
            <Skeleton className="h-10 w-full rounded-xl shimmer bg-white/[0.06]" />
            <Skeleton className="h-10 w-full rounded-xl shimmer bg-white/[0.06]" />
          </CardContent>
        </Card>
      </div>

      {/* Activity card */}
      <Card className="glass">
        <CardHeader>
          <Skeleton className="h-5 w-32 rounded-lg shimmer bg-white/[0.06]" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-14 rounded-md shimmer bg-white/[0.06]" />
                <Skeleton className="h-4 w-48 rounded-lg shimmer bg-white/[0.06]" />
              </div>
              <Skeleton className="h-3 w-28 rounded-lg shimmer bg-white/[0.06]" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
