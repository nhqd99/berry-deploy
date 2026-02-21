import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ClawStatus = "creating" | "running" | "stopped" | "error" | "removing";

const statusConfig: Record<
  ClawStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  creating: { label: "Creating", variant: "secondary" },
  running: { label: "Running", variant: "default" },
  stopped: { label: "Stopped", variant: "outline" },
  error: { label: "Error", variant: "destructive" },
  removing: { label: "Removing", variant: "secondary" },
};

export function ClawStatusBadge({ status }: { status: ClawStatus }) {
  const config = statusConfig[status];
  return (
    <Badge
      variant={config.variant}
      className={cn(
        status === "running" &&
          "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400",
      )}
    >
      {status === "running" && (
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      )}
      {config.label}
    </Badge>
  );
}
