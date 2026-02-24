"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, TerminalSquare } from "lucide-react";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const WebTerminal = dynamic(
  () => import("@/components/web-terminal").then((m) => m.WebTerminal),
  { ssr: false },
);

export default function TerminalPage() {
  const params = useParams();
  const clawId = params.clawId as Id<"claws">;

  const claw = useQuery(api.claws.get, { clawId });
  const createStreamToken = useAction(api.streaming.createStreamToken);

  const [session, setSession] = useState<{
    token: string;
    containerId: string;
  } | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function handleConnect() {
    setConnecting(true);
    try {
      const result = await createStreamToken({ clawId });
      setSession(result);
    } catch (err) {
      toast.error("Failed to connect", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setConnecting(false);
    }
  }

  if (claw === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64 rounded-lg shimmer bg-white/[0.06]" />
        <Skeleton className="h-[500px] w-full rounded-xl shimmer bg-white/[0.06]" />
      </div>
    );
  }

  if (!claw) {
    return <p className="text-muted-foreground">Claw not found</p>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] sm:h-[calc(100vh-8rem)]">
      <div className="mb-4">
        <PageBreadcrumb
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: claw.name, href: `/dashboard/claw/${clawId}` },
            { label: "Terminal" },
          ]}
        />
      </div>

      {session ? (
        <div className="flex-1 min-h-0 rounded-xl border border-white/[0.10] overflow-hidden bg-[#141422]">
          <WebTerminal
            containerId={session.containerId}
            token={session.token}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border border-white/[0.10] rounded-xl bg-white/[0.02]">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/15 to-violet-500/10 ring-1 ring-white/[0.06]">
                <TerminalSquare className="h-8 w-8 text-indigo-400/60" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold">Web Terminal</h3>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Open an interactive shell in the container
              </p>
            </div>
            {claw.status !== "running" ? (
              <p className="text-sm text-yellow-400/80">
                Container must be running to open a terminal.
              </p>
            ) : (
              <Button onClick={handleConnect} disabled={connecting} className="btn-gradient text-white rounded-xl">
                {connecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <TerminalSquare className="mr-2 h-4 w-4" />
                )}
                Connect
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
