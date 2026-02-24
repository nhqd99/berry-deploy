import { cn } from "@/lib/utils";

type ClawStatus = "creating" | "running" | "stopped" | "error" | "removing";

const statusConfig: Record<
  ClawStatus,
  { label: string; dotColor: string; bg: string }
> = {
  creating: {
    label: "Creating",
    dotColor: "bg-blue-400 animate-pulse shadow-sm shadow-blue-400/50",
    bg: "bg-blue-500/10 text-blue-300 border border-blue-400/15",
  },
  running: {
    label: "Running",
    dotColor: "bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50",
    bg: "bg-emerald-500/10 text-emerald-300 border border-emerald-400/15",
  },
  stopped: {
    label: "Stopped",
    dotColor: "bg-zinc-500",
    bg: "bg-zinc-500/10 text-zinc-400 border border-zinc-500/15",
  },
  error: {
    label: "Error",
    dotColor: "bg-red-400 shadow-sm shadow-red-400/50",
    bg: "bg-red-500/10 text-red-300 border border-red-400/15",
  },
  removing: {
    label: "Removing",
    dotColor: "bg-amber-400 animate-pulse shadow-sm shadow-amber-400/50",
    bg: "bg-amber-500/10 text-amber-300 border border-amber-400/15",
  },
};

export function ClawStatusBadge({ status }: { status: ClawStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide backdrop-blur-sm",
        config.bg,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)} />
      {config.label}
    </span>
  );
}
