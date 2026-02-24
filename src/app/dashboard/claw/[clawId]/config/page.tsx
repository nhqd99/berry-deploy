"use client";

import { useState } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ConfigDiffViewer } from "@/components/config-diff-viewer";
import { Save, RotateCcw, Loader2, History } from "lucide-react";
import { toast } from "sonner";

const FILE_TYPES = ["soul.md", "memory.md", "AGENTS.md"] as const;
type FileType = (typeof FILE_TYPES)[number];

export default function ConfigPage() {
  const params = useParams();
  const clawId = params.clawId as Id<"claws">;
  const claw = useQuery(api.claws.get, { clawId });
  const [activeTab, setActiveTab] = useState<FileType>("soul.md");

  return (
    <div className="space-y-6">
      <PageBreadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: claw?.name ?? "...", href: `/dashboard/claw/${clawId}` },
          { label: "Configuration" },
        ]}
      />
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gradient">Configuration</h1>
        <p className="text-sm text-muted-foreground/80">
          Edit soul.md, memory.md, and AGENTS.md
        </p>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as FileType)}
      >
        <TabsList className="bg-white/[0.06] border border-white/[0.10] rounded-xl">
          {FILE_TYPES.map((ft) => (
            <TabsTrigger key={ft} value={ft} className="rounded-lg data-[state=active]:bg-indigo-500/15 data-[state=active]:text-indigo-400 transition-colors duration-200">
              {ft}
            </TabsTrigger>
          ))}
        </TabsList>
        {FILE_TYPES.map((ft) => (
          <TabsContent key={ft} value={ft}>
            <ConfigEditor clawId={clawId} fileType={ft} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ConfigEditor({
  clawId,
  fileType,
}: {
  clawId: Id<"claws">;
  fileType: FileType;
}) {
  const config = useQuery(api.configs.get, { clawId, fileType });
  const syncConfig = useAction(api.docker.syncConfig);

  const [content, setContent] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const displayContent = content ?? config?.content ?? "";
  const isDirty = content !== null && content !== (config?.content ?? "");

  async function handleSave(restart: boolean) {
    setSaving(true);
    try {
      await syncConfig({
        clawId,
        fileType,
        content: displayContent,
        restart,
      });
      setContent(null);
      toast.success(restart ? "Saved & restarted!" : "Saved!");
    } catch (err) {
      toast.error("Save failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }

  if (config === undefined) {
    return (
      <Card className="glass">
        <CardHeader>
          <Skeleton className="h-5 w-24 rounded-lg shimmer bg-white/[0.06]" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] sm:h-[400px] w-full rounded-xl shimmer bg-white/[0.06]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <CardTitle className="text-base font-medium text-muted-foreground">{fileType}</CardTitle>
        <div className="flex flex-col gap-2 sm:flex-row">
          <VersionHistoryDialog
            clawId={clawId}
            fileType={fileType}
            currentContent={config?.content ?? ""}
          />
          <Button
            variant="outline"
            size="sm"
            className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300"
            disabled={!isDirty || saving}
            onClick={() => handleSave(false)}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
          <Button
            size="sm"
            className="btn-gradient text-white rounded-xl"
            disabled={!isDirty || saving}
            onClick={() => handleSave(true)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Save & Restart
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="input-glow rounded-xl">
          <Textarea
            value={displayContent}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[250px] sm:min-h-[400px] font-mono text-sm bg-[oklch(0.11_0.012_264)] border-white/[0.10] rounded-xl text-emerald-400/90 focus-visible:ring-indigo-500/30"
            placeholder={`Enter ${fileType} content...`}
          />
        </div>
        {isDirty && (
          <p className="mt-2 text-xs text-amber-400/80">
            You have unsaved changes
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function VersionHistoryDialog({
  clawId,
  fileType,
  currentContent,
}: {
  clawId: Id<"claws">;
  fileType: FileType;
  currentContent: string;
}) {
  const versions = useQuery(api.configVersions.listVersions, { clawId, fileType });
  const rollback = useMutation(api.configVersions.rollback);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const selectedDoc = versions?.find((v) => v.version === selectedVersion);

  async function handleRollback(version: number) {
    try {
      await rollback({ clawId, fileType, version });
      toast.success(`Rolled back to version ${version}`);
      setOpen(false);
    } catch (err) {
      toast.error("Rollback failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="hover:bg-white/[0.06] rounded-xl transition-all duration-300">
          <History className="mr-2 h-4 w-4 text-indigo-400/60" />
          History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[80vh] overflow-y-auto bg-[oklch(0.15_0.016_264)] border-white/[0.10] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Version History — {fileType}</DialogTitle>
        </DialogHeader>
        {!versions || versions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No previous versions yet. Versions are created each time you save.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {versions.map((v) => (
                <Button
                  key={v.version}
                  variant={selectedVersion === v.version ? "default" : "outline"}
                  size="sm"
                  className={`rounded-xl transition-all duration-300 ${selectedVersion === v.version ? "bg-indigo-500 text-white" : "border-white/[0.10] hover:bg-white/[0.06]"}`}
                  onClick={() => setSelectedVersion(v.version)}
                >
                  v{v.version}
                  <span className="ml-1 text-xs opacity-70">
                    {new Date(v.createdAt).toLocaleString()}
                  </span>
                </Button>
              ))}
            </div>

            {selectedDoc && (
              <div className="space-y-3">
                <ConfigDiffViewer
                  oldContent={selectedDoc.content}
                  newContent={currentContent}
                  oldLabel={`Version ${selectedDoc.version}`}
                  newLabel="Current"
                />
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" size="sm" className="border-white/[0.10] hover:bg-white/[0.06] rounded-xl transition-all duration-300">
                      Rollback to v{selectedDoc.version}
                    </Button>
                  }
                  title={`Rollback to version ${selectedDoc.version}?`}
                  description="The current content will be saved as a new version before rolling back."
                  confirmLabel="Rollback"
                  onConfirm={() => handleRollback(selectedDoc.version)}
                />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
