"use client";

import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Loader2, User, Lock, Bell, Key, Copy, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const user = useQuery(api.users.getMe);

  if (user === undefined) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient">Settings</h1>
          <p className="text-sm text-muted-foreground/80">Manage your account</p>
        </div>
        <Card className="glass">
          <CardHeader>
            <Skeleton className="h-6 w-24 rounded-lg shimmer bg-white/[0.06]" />
            <Skeleton className="h-4 w-48 rounded-lg shimmer bg-white/[0.06]" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-9 w-full rounded-xl shimmer bg-white/[0.06]" />
            <Skeleton className="h-9 w-full rounded-xl shimmer bg-white/[0.06]" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient">Settings</h1>
        <p className="text-sm text-muted-foreground/80">Manage your account</p>
      </div>

      <ProfileSection name={user?.name ?? ""} email={user?.email ?? ""} />
      <ChangePasswordSection />
      <NotificationChannelsSection />
      <ApiKeysSection />
    </div>
  );
}

function ProfileSection({ name, email }: { name: string; email: string }) {
  const updateProfile = useMutation(api.users.updateProfile);
  const [newName, setNewName] = useState(name);
  const [saving, setSaving] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ name: newName.trim() });
      toast.success("Profile updated");
    } catch (err) {
      toast.error("Failed to update profile", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-4 w-4 text-indigo-400" />
          Profile
        </CardTitle>
        <CardDescription>Update your display name</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled className="bg-white/[0.05] border-white/[0.10] rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Display Name</Label>
            <Input
              id="name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Your name"
              className="bg-white/[0.05] border-white/[0.10] rounded-xl"
            />
          </div>
          <Button type="submit" disabled={saving || !newName.trim() || newName === name} className="btn-gradient text-white rounded-xl">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ChangePasswordSection() {
  const { signIn } = useAuthActions();
  const user = useQuery(api.users.getMe);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword.trim() || newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await signIn("password", {
        email: user?.email ?? "",
        password: currentPassword,
        flow: "signIn",
      });
      await signIn("password", {
        email: user?.email ?? "",
        password: newPassword,
        flow: "reset",
      });
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      toast.error("Failed to change password. Check your current password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-indigo-400" />
          Security
        </CardTitle>
        <CardDescription>Change your password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
              className="bg-white/[0.05] border-white/[0.10] rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              required
              minLength={6}
              className="bg-white/[0.05] border-white/[0.10] rounded-xl"
            />
          </div>
          <Button type="submit" disabled={loading || !currentPassword || !newPassword} className="btn-gradient text-white rounded-xl">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NotificationChannelsSection() {
  const channels = useQuery(api.notifications.listChannels);
  const addChannel = useMutation(api.notifications.addChannel);
  const toggleChannel = useMutation(api.notifications.toggleChannel);
  const removeChannel = useMutation(api.notifications.removeChannel);

  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<"discord" | "slack" | "email">("discord");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newValue.trim()) return;
    setSaving(true);
    try {
      await addChannel({
        type: newType,
        webhookUrl: newType !== "email" ? newValue.trim() : undefined,
        email: newType === "email" ? newValue.trim() : undefined,
      });
      toast.success("Notification channel added");
      setNewValue("");
      setAdding(false);
    } catch (err) {
      toast.error("Failed to add channel", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-400" />
              Notifications
            </CardTitle>
            <CardDescription>Get notified when your claws crash or have issues</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAdding(!adding)} className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300">
            <Plus className="mr-1 h-3 w-3" />
            Add
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {adding && (
          <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-white/[0.10] p-3">
            <div className="space-y-2">
              <Label>Channel Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as typeof newType)}>
                <SelectTrigger className="bg-white/[0.06] border-white/[0.10]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discord">Discord Webhook</SelectItem>
                  <SelectItem value="slack">Slack Webhook</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{newType === "email" ? "Email Address" : "Webhook URL"}</Label>
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={newType === "email" ? "you@example.com" : "https://..."}
                type={newType === "email" ? "email" : "url"}
                required
                className="bg-white/[0.05] border-white/[0.10] rounded-xl"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving} className="btn-gradient text-white rounded-xl">
                {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Save
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)} className="hover:bg-white/[0.06] rounded-xl transition-all duration-300">
                Cancel
              </Button>
            </div>
          </form>
        )}

        {channels === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full bg-white/[0.06]" />
            <Skeleton className="h-10 w-full bg-white/[0.06]" />
          </div>
        ) : channels.length === 0 && !adding ? (
          <p className="text-sm text-muted-foreground">
            No notification channels configured. Add one to get crash alerts.
          </p>
        ) : (
          channels.map((ch) => (
            <div key={ch._id} className="flex items-center justify-between rounded-md border border-white/[0.10] px-3 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="rounded bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5 text-xs font-medium uppercase">
                  {ch.type}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {ch.type === "email" ? ch.email : ch.webhookUrl}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={ch.enabled}
                  onCheckedChange={(enabled) =>
                    toggleChannel({ channelId: ch._id, enabled })
                  }
                />
                <ConfirmDialog
                  title="Remove channel?"
                  description="This notification channel will be deleted."
                  onConfirm={() => { removeChannel({ channelId: ch._id }); }}
                  trigger={
                    <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/5">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  }
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ApiKeysSection() {
  const keys = useQuery(api.apiKeysMutations.listKeys);
  const createKey = useAction(api.apiKeys.createKey);
  const deleteKey = useMutation(api.apiKeysMutations.deleteKey);

  const [creating, setCreating] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!keyName.trim()) return;
    setSaving(true);
    try {
      const result = await createKey({ name: keyName.trim() });
      setNewKey(result.key);
      setKeyName("");
      toast.success("API key created");
    } catch (err) {
      toast.error("Failed to create key", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      toast.success("Copied to clipboard");
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-4 w-4 text-indigo-400" />
              API Keys
            </CardTitle>
            <CardDescription>Manage API keys for programmatic access</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300"
            onClick={() => { setCreating(!creating); setNewKey(null); }}
          >
            <Plus className="mr-1 h-3 w-3" />
            New Key
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {creating && (
          <div className="space-y-3 rounded-xl border border-white/[0.10] p-3">
            {newKey ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Copy this key now — you won&apos;t see it again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-emerald-500/15 text-emerald-400 p-2 text-xs font-mono break-all">
                    {newKey}
                  </code>
                  <Button variant="outline" size="icon" className="h-8 w-8 border-white/[0.1]" onClick={copyKey}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <Button size="sm" variant="ghost" className="hover:bg-white/[0.06] rounded-xl transition-all duration-300" onClick={() => { setNewKey(null); setCreating(false); }}>
                  Done
                </Button>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="space-y-2">
                  <Label>Key Name</Label>
                  <Input
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g. CI/CD Pipeline"
                    required
                    className="bg-white/[0.05] border-white/[0.10] rounded-xl"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={saving} className="btn-gradient text-white rounded-xl">
                    {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Create
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="hover:bg-white/[0.06] rounded-xl transition-all duration-300" onClick={() => setCreating(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {keys === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full bg-white/[0.06]" />
          </div>
        ) : keys.length === 0 && !creating ? (
          <p className="text-sm text-muted-foreground">
            No API keys. Create one to access your claws programmatically.
          </p>
        ) : (
          keys.map((k) => (
            <div key={k._id} className="flex items-center justify-between rounded-md border border-white/[0.10] px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{k.name}</p>
                <p className="text-xs text-muted-foreground">
                  {k.keyPrefix}... · Created {new Date(k.createdAt).toLocaleDateString()}
                  {k.lastUsedAt && ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                </p>
              </div>
              <ConfirmDialog
                title="Delete API key?"
                description="This key will be permanently revoked and cannot be recovered."
                onConfirm={() => { deleteKey({ keyId: k._id as Id<"apiKeys"> }); }}
                trigger={
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/5">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                }
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
