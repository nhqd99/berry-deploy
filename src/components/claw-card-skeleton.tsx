import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ClawCardSkeleton() {
  return (
    <Card className="glass overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-5 w-32 rounded-lg shimmer bg-white/[0.06]" />
        <Skeleton className="h-5 w-16 rounded-full shimmer bg-white/[0.06]" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          <Skeleton className="h-4 w-40 rounded-lg shimmer bg-white/[0.06]" />
          <Skeleton className="h-4 w-36 rounded-lg shimmer bg-white/[0.06]" />
          <Skeleton className="h-3 w-24 rounded-lg shimmer bg-white/[0.06]" />
        </div>
      </CardContent>
    </Card>
  );
}
