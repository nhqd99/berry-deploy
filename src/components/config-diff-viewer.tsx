"use client";

import { diffLines } from "diff";

export function ConfigDiffViewer({
  oldContent,
  newContent,
  oldLabel,
  newLabel,
}: {
  oldContent: string;
  newContent: string;
  oldLabel?: string;
  newLabel?: string;
}) {
  const diff = diffLines(oldContent, newContent);

  return (
    <div className="rounded-xl border border-white/[0.10] overflow-hidden">
      <div className="flex bg-white/[0.05] px-3 py-1.5 text-xs font-medium">
        <span className="flex-1 text-red-400/80">{oldLabel ?? "Previous"}</span>
        <span className="flex-1 text-emerald-400/80">{newLabel ?? "Current"}</span>
      </div>
      <pre className="p-3 text-xs font-mono overflow-auto max-h-[400px] bg-[oklch(0.11_0.012_264)]">
        {diff.map((part, i) => {
          if (part.added) {
            return (
              <span key={i} className="bg-emerald-500/15 text-emerald-300">
                {part.value}
              </span>
            );
          }
          if (part.removed) {
            return (
              <span key={i} className="bg-red-500/15 text-red-300">
                {part.value}
              </span>
            );
          }
          return <span key={i}>{part.value}</span>;
        })}
      </pre>
    </div>
  );
}
