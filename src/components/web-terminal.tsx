"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface WebTerminalProps {
  containerId: string;
  token: string;
}

export function WebTerminal({ containerId, token }: WebTerminalProps) {
  const termRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const eventSourceRef = useRef<EventSource | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendInput = useCallback(async (data: string) => {
    try {
      const encoded = btoa(data);
      await fetch(`/api/terminal/${containerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          input: encoded,
        }),
      });
    } catch {
      // Silently fail on input send errors
    }
  }, [containerId]);

  useEffect(() => {
    if (!termRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Menlo', monospace",
      fontSize: 14,
      theme: {
        background: "#141422",
        foreground: "#e4e4e7",
        cursor: "#e4e4e7",
        selectionBackground: "#27272a",
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(termRef.current);

    // Small delay to ensure the DOM is ready for fitting
    requestAnimationFrame(() => {
      fitAddon.fit();
    });

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Handle user input -> POST to server
    terminal.onData((data) => {
      sendInput(data);
    });

    // Connect SSE for output
    const sessionId = sessionIdRef.current;
    const url = `/api/terminal/${containerId}?token=${encodeURIComponent(token)}&sessionId=${encodeURIComponent(sessionId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("output", (event) => {
      try {
        const decoded = atob(event.data);
        terminal.write(decoded);
      } catch {
        // Ignore decode errors
      }
    });

    es.addEventListener("exit", () => {
      terminal.write("\r\n\x1b[33m[Session ended]\x1b[0m\r\n");
      setConnected(false);
    });

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        setConnected(false);
        setError("Connection closed");
      }
    };

    // Resize observer
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit();
      });
    });
    observer.observe(termRef.current);

    return () => {
      observer.disconnect();
      es.close();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      eventSourceRef.current = null;
    };
  }, [containerId, token, sendInput]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[oklch(0.13_0.012_264)] border-b border-white/[0.10] text-xs">
        <span className="font-mono text-muted-foreground/60">
          container:{containerId.slice(0, 12)}
        </span>
        <span className={`text-xs ${connected ? "text-emerald-500" : "text-red-400"}`}>
          {connected ? "Connected" : error ?? "Disconnected"}
        </span>
      </div>
      <div ref={termRef} className="flex-1 min-h-0" />
    </div>
  );
}
