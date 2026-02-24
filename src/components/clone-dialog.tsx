"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function CloneDialog({ clawId, clawName }: { clawId: Id<"claws">; clawName: string }) {
  const cloneClaw = useAction(api.templates.cloneClaw);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState(`${clawName}-copy`);
  const [loading, setLoading] = useState(false);

  async function handleClone() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const result = await cloneClaw({
        sourceClawId: clawId,
        newName: newName.trim(),
      });
      toast.success("Claw cloned successfully!");
      setOpen(false);
      router.push(`/dashboard/claw/${result.clawId}`);
    } catch (err) {
      toast.error("Clone failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300">
          <Copy className="mr-2 h-4 w-4" />
          Clone
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[oklch(0.15_0.016_264)] border-white/[0.10] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Clone Claw</DialogTitle>
          <DialogDescription>
            Create a copy of &ldquo;{clawName}&rdquo; with all configurations and skills.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="clone-name">New Instance Name</Label>
            <Input
              id="clone-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="my-clone"
              disabled={loading}
              className="bg-white/[0.05] border-white/[0.10] rounded-xl"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading} className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300">
            Cancel
          </Button>
          <Button onClick={handleClone} disabled={loading || !newName.trim()} className="btn-gradient text-white rounded-xl">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Clone
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
