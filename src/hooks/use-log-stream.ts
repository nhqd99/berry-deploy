"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const MAX_LINES = 5000;

export function useLogStream(containerId: string | null, token: string | null) {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const clear = useCallback(() => setLines([]), []);

  useEffect(() => {
    if (!containerId || !token) return;

    const url = `/api/logs/${containerId}?token=${token}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (event) => {
      setLines((prev) => {
        const next = [...prev, event.data];
        if (next.length > MAX_LINES) {
          return next.slice(next.length - MAX_LINES);
        }
        return next;
      });
    };

    es.addEventListener("close", () => {
      setConnected(false);
      es.close();
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [containerId, token]);

  return { lines, connected, clear };
}
