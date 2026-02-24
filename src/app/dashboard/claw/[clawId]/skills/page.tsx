"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SkillsPage() {
  const params = useParams();
  const clawId = params.clawId as Id<"claws">;

  const claw = useQuery(api.claws.get, { clawId });
  const skills = useQuery(api.skills.list, { clawId });
  const addSkill = useAction(api.docker.addSkill);
  const toggleSkill = useAction(api.docker.toggleSkill);
  const removeSkill = useAction(api.docker.removeSkill);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      await addSkill({
        clawId,
        name: newName.trim(),
        description: newDescription.trim() || undefined,
      });
      toast.success(`Skill "${newName.trim()}" added`);
      setNewName("");
      setNewDescription("");
      setShowAdd(false);
    } catch (err) {
      toast.error("Failed to add skill", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  async function handleToggle(skillId: Id<"skills">, enabled: boolean, name: string) {
    try {
      await toggleSkill({ skillId, enabled });
      toast.success(`${name} ${enabled ? "enabled" : "disabled"}`);
    } catch (err) {
      toast.error("Failed to toggle skill", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  async function handleRemove(skillId: Id<"skills">, name: string) {
    try {
      await removeSkill({ skillId });
      toast.success(`Skill "${name}" removed`);
    } catch (err) {
      toast.error("Failed to remove skill", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: claw?.name ?? "...", href: `/dashboard/claw/${clawId}` },
          { label: "Skills" },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gradient">Skills</h1>
          <p className="text-sm text-muted-foreground/80">
            Manage skills for this Claw instance
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="btn-gradient text-white rounded-xl">
          <Plus className="mr-2 h-4 w-4" />
          Add Skill
        </Button>
      </div>

      {showAdd && (
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Add New Skill</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="skill-name">Name</Label>
                <div className="input-glow rounded-xl">
                  <Input
                    id="skill-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., web-search"
                    required
                    className="bg-white/[0.05] border-white/[0.10] rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-desc">Description (optional)</Label>
                <div className="input-glow rounded-xl">
                  <Input
                    id="skill-desc"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="What does this skill do?"
                    className="bg-white/[0.05] border-white/[0.10] rounded-xl"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="btn-gradient text-white rounded-xl">
                  Add
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdd(false)}
                  className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">Installed Skills</CardTitle>
        </CardHeader>
        <CardContent>
          {skills === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-white/[0.10] p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded shimmer bg-white/[0.06]" />
                    <div>
                      <Skeleton className="h-4 w-24 rounded-lg shimmer bg-white/[0.06]" />
                      <Skeleton className="mt-1 h-3 w-40 rounded-lg shimmer bg-white/[0.06]" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-8 rounded-xl shimmer bg-white/[0.06]" />
                </div>
              ))}
            </div>
          ) : skills.length === 0 ? (
            <p className="text-sm text-muted-foreground/60">
              No skills installed yet
            </p>
          ) : (
            <div className="space-y-2">
              {skills.map((skill) => (
                <div
                  key={skill._id}
                  className="flex items-center justify-between rounded-xl border border-white/[0.10] p-3 hover:bg-white/[0.05] transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        handleToggle(skill._id, !skill.enabled, skill.name)
                      }
                      className={`h-4 w-4 rounded border transition-all duration-200 cursor-pointer ${
                        skill.enabled
                          ? "bg-indigo-500 border-indigo-500 shadow-sm shadow-indigo-500/30"
                          : "border-white/[0.2] hover:border-white/[0.4]"
                      }`}
                    >
                      {skill.enabled && (
                        <svg
                          className="h-4 w-4 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                    <div>
                      <p className="text-sm font-medium">{skill.name}</p>
                      {skill.description && (
                        <p className="text-xs text-muted-foreground/60">
                          {skill.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    }
                    title={`Remove "${skill.name}"?`}
                    description="This skill will be permanently removed from this Claw."
                    confirmLabel="Remove"
                    variant="destructive"
                    onConfirm={() => handleRemove(skill._id, skill.name)}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
