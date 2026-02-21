"use client";

import { useState } from "react";
import { useAction } from "convex/react";
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
import { Loader2, Rocket } from "lucide-react";

export default function DeployNewClawPage() {
  const router = useRouter();
  const deployClaw = useAction(api.docker.deployClaw);

  const [name, setName] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [envVarsText, setEnvVarsText] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");

  async function handleDeploy(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setDeploying(true);
    setError("");

    try {
      // Parse env vars from KEY=VALUE format
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

      router.push(`/dashboard/claw/${result.clawId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deployment failed");
      setDeploying(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Deploy New Claw</h1>
        <p className="text-muted-foreground">
          Launch a new OpenClaw instance with one click
        </p>
      </div>

      <Card>
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
              />
              <p className="text-xs text-muted-foreground">
                Get it from <span className="font-medium">@BotFather</span> on Telegram. Leave empty to skip Telegram integration.
              </p>
            </div>

            <div className="rounded-md bg-muted p-3 text-sm">
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
                className="font-mono text-sm"
                disabled={deploying}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={deploying || !name.trim()}
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
