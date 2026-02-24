"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Rocket, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export default function DeployNewClawPage() {
  const router = useRouter();
  const deployClaw = useAction(api.docker.deployClaw);
  const quota = useQuery(api.quotas.getQuota);

  const [name, setName] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [envVarsText, setEnvVarsText] = useState("");
  const [deploying, setDeploying] = useState(false);

  async function handleDeploy(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setDeploying(true);

    try {
      const envVars: Record<string, string> = {};
      if (envVarsText.trim()) {
        for (const line of envVarsText.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eqIndex = trimmed.indexOf("=");
          if (eqIndex > 0) {
            envVars[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1);
          }
        }
      }

      const result = await deployClaw({
        name: name.trim(),
        telegramBotToken: telegramBotToken.trim() || undefined,
        envVars: Object.keys(envVars).length > 0 ? envVars : undefined,
      });

      toast.success("Claw deployed successfully!");
      router.push(`/dashboard/claw/${result.clawId}`);
    } catch (err) {
      toast.error("Deployment failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setDeploying(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient">Deploy New Claw</h1>
        <p className="text-sm text-muted-foreground/80">
          Launch a new OpenClaw instance with one click
        </p>
      </div>

      {quota && !quota.canCreate && (
        <Card className="border-destructive/50 glass">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Quota reached: {quota.usedClaws}/{quota.maxClaws} claws
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              You cannot deploy more claws. Remove an existing claw or contact admin to increase your quota.
            </p>
          </CardContent>
        </Card>
      )}

      {quota && quota.canCreate && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {quota.usedClaws}/{quota.maxClaws} Claws used
          </span>
          <Progress value={(quota.usedClaws / quota.maxClaws) * 100} className="w-32 h-2 [&>div]:bg-indigo-500" />
        </div>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Configure your new OpenClaw instance. Gateway token and ports will be auto-assigned.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDeploy} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Instance Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-assistant"
                required
                disabled={deploying}
                className="bg-white/[0.05] border-white/[0.10] rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telegram">Telegram Bot Token</Label>
              <Input
                id="telegram"
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyz"
                disabled={deploying}
                className="bg-white/[0.05] border-white/[0.10] rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Get it from <span className="font-medium">@BotFather</span> on Telegram. Leave empty to skip Telegram integration.
              </p>
            </div>

            <div className="rounded-xl bg-white/[0.05] border border-white/[0.10] p-3 text-sm">
              <p className="text-xs text-muted-foreground">
                Ports and gateway token will be auto-assigned on deploy
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="envVars">
                Environment Variables{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="envVars"
                value={envVarsText}
                onChange={(e) => setEnvVarsText(e.target.value)}
                placeholder={"CLAUDE_AI_SESSION_KEY=sk-...\n# Lines starting with # are ignored"}
                rows={4}
                className="font-mono text-sm bg-white/[0.06] border-white/[0.10]"
                disabled={deploying}
              />
            </div>

            <Button
              type="submit"
              className="w-full btn-gradient-emerald text-white rounded-xl"
              disabled={deploying || !name.trim() || (quota !== undefined && !quota?.canCreate)}
            >
              {deploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  Deploy Claw
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
