"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Loader2, Globe, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function DomainPage() {
  const params = useParams();
  const clawId = params.clawId as Id<"claws">;

  const claw = useQuery(api.claws.get, { clawId });
  const setDomain = useAction(api.proxy.setCustomDomain);
  const removeDomain = useAction(api.proxy.removeCustomDomain);

  const [domain, setDomainInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleSetDomain(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setSaving(true);
    try {
      await setDomain({ clawId, domain: domain.trim() });
      toast.success("Custom domain configured");
      setDomainInput("");
    } catch (err) {
      toast.error("Failed to set domain", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveDomain() {
    setRemoving(true);
    try {
      await removeDomain({ clawId });
      toast.success("Custom domain removed");
    } catch (err) {
      toast.error("Failed to remove domain", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setRemoving(false);
    }
  }

  if (claw === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64 rounded-lg shimmer bg-white/[0.06]" />
        <Skeleton className="h-48 w-full rounded-xl shimmer bg-white/[0.06]" />
      </div>
    );
  }

  if (!claw) {
    return <p className="text-muted-foreground">Claw not found</p>;
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: claw.name, href: `/dashboard/claw/${clawId}` },
          { label: "Domain" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient">Custom Domain</h1>
        <p className="text-sm text-muted-foreground/80">
          Point your own domain to this claw&apos;s gateway
        </p>
      </div>

      {/* Current domain */}
      {claw.customDomain && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4 text-indigo-400" />
              Active Domain
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <code className="rounded bg-indigo-500/15 text-indigo-400 px-2 py-1 text-sm font-mono">
                  {claw.customDomain}
                </code>
                <a
                  href={`https://${claw.customDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
              <ConfirmDialog
                title="Remove custom domain?"
                description="Traffic will no longer be routed through this domain. The DNS records will become stale."
                confirmLabel="Remove"
                variant="destructive"
                onConfirm={handleRemoveDomain}
                trigger={
                  <Button variant="ghost" size="sm" disabled={removing} className="hover:bg-white/[0.06] rounded-xl transition-all duration-300">
                    {removing ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-3 w-3" />
                    )}
                    Remove
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Set domain */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">
            {claw.customDomain ? "Change Domain" : "Set Up Domain"}
          </CardTitle>
          <CardDescription>
            Enter your domain and configure DNS to point to this server
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSetDomain} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domain Name</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="myclaw.example.com"
                required
                className="bg-white/[0.05] border-white/[0.10] rounded-xl"
              />
            </div>
            <Button type="submit" disabled={saving || !domain.trim()} className="btn-gradient text-white rounded-xl">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {claw.customDomain ? "Update Domain" : "Set Domain"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* DNS Instructions */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">DNS Configuration</CardTitle>
          <CardDescription>
            Add these records at your DNS provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-white/[0.10]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.10] bg-white/[0.05]">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground/80">Type</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground/80">Name</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground/80">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/[0.10]">
                  <td className="px-3 py-2 font-mono text-indigo-400">A</td>
                  <td className="px-3 py-2 font-mono">
                    {claw.customDomain || "myclaw.example.com"}
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    Your server IP
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-mono text-indigo-400">AAAA</td>
                  <td className="px-3 py-2 font-mono">
                    {claw.customDomain || "myclaw.example.com"}
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    Your server IPv6 (optional)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            After setting DNS records, it may take a few minutes for changes to propagate.
            Caddy will automatically provision an SSL certificate via Let&apos;s Encrypt.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
