"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
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
import { Save, RotateCcw, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

const FILE_TYPES = ["soul.md", "memory.md", "AGENTS.md"] as const;
type FileType = (typeof FILE_TYPES)[number];

export default function ConfigPage() {
  const params = useParams();
  const clawId = params.clawId as Id<"claws">;
  const [activeTab, setActiveTab] = useState<FileType>("soul.md");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/claw/${clawId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuration</h1>
          <p className="text-muted-foreground">
            Edit soul.md, memory.md, and AGENTS.md
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as FileType)}
      >
        <TabsList>
          {FILE_TYPES.map((ft) => (
            <TabsTrigger key={ft} value={ft}>
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
  const [saved, setSaved] = useState(false);

  // Use local content if edited, otherwise use server content
  const displayContent = content ?? config?.content ?? "";

  const isDirty = content !== null && content !== (config?.content ?? "");

  async function handleSave(restart: boolean) {
    setSaving(true);
    setSaved(false);
    try {
      await syncConfig({
        clawId,
        fileType,
        content: displayContent,
        restart,
      });
      setContent(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  if (config === undefined) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{fileType}</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!isDirty || saving}
            onClick={() => handleSave(false)}
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saved ? "Saved!" : "Save"}
          </Button>
          <Button
            size="sm"
            disabled={!isDirty || saving}
            onClick={() => handleSave(true)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Save & Restart
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Textarea
          value={displayContent}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[400px] font-mono text-sm"
          placeholder={`Enter ${fileType} content...`}
        />
        {isDirty && (
          <p className="mt-2 text-xs text-muted-foreground">
            You have unsaved changes
          </p>
        )}
      </CardContent>
    </Card>
  );
}
