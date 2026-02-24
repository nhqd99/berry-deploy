"use client";

import { useState, useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowDown,
  Pause,
  Play,
  Search,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

export function LogViewer({
  lines,
  connected,
  onClear,
}: {
  lines: string[];
  connected: boolean;
  onClear: () => void;
}) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const [search, setSearch] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const displayLines = paused ? [] : lines; // When paused, freeze display
  const filteredLines = search
    ? displayLines.filter((l) => l.toLowerCase().includes(search.toLowerCase()))
    : displayLines;

  useEffect(() => {
    if (autoScroll && !paused && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines.length, autoScroll, paused]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          {connected ? (
            <Wifi className="h-3 w-3 text-emerald-500" />
          ) : (
            <WifiOff className="h-3 w-3 text-red-500" />
          )}
          <span className="text-muted-foreground">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <div className="flex-1" />
        <div className="relative input-glow rounded-xl">
          <Search className="absolute left-2 top-1.5 h-3 w-3 text-muted-foreground/50" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 w-40 pl-7 text-xs bg-white/[0.05] border-white/[0.10] rounded-xl"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 hover:bg-white/[0.06] rounded-lg transition-all duration-300"
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 hover:bg-white/[0.06] rounded-lg transition-all duration-300"
          onClick={() => setAutoScroll(!autoScroll)}
          data-active={autoScroll}
          title={autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
        >
          <ArrowDown className={`h-3 w-3 ${autoScroll ? "text-indigo-400" : ""}`} />
        </Button>
        <Button variant="ghost" size="sm" className="h-7 hover:bg-white/[0.06] rounded-lg transition-all duration-300" onClick={onClear}>
          <Trash2 className="h-3 w-3" />
        </Button>
        <span className="text-xs text-muted-foreground/50 tabular-nums">
          {filteredLines.length} lines
        </span>
      </div>

      {/* Log output */}
      <ScrollArea className="h-[500px] rounded-xl border border-white/[0.10] bg-[oklch(0.11_0.012_264)]">
        <pre className="p-3 text-xs font-mono text-emerald-400/90">
          {filteredLines.length === 0 ? (
            <span className="text-muted-foreground">
              {paused ? "Paused..." : "Waiting for logs..."}
            </span>
          ) : (
            filteredLines.map((line, i) => {
              if (search) {
                const parts = highlightSearch(line, search);
                return (
                  <div key={i} className="leading-5">
                    {parts}
                  </div>
                );
              }
              return (
                <div key={i} className="leading-5">
                  {line}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </pre>
      </ScrollArea>
    </div>
  );
}

function highlightSearch(text: string, query: string) {
  const parts: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  let lastIndex = 0;

  let idx = lower.indexOf(queryLower);
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }
    parts.push(
      <mark key={idx} className="bg-amber-500/30 text-amber-300 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>,
    );
    lastIndex = idx + query.length;
    idx = lower.indexOf(queryLower, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
