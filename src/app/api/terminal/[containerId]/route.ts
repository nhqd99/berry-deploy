import { spawn, type ChildProcess } from "child_process";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type Session = {
  proc: ChildProcess;
  send: (eventType: string, data: string) => void;
};

// In-memory map of active terminal sessions: sessionId -> Session
const sessions = new Map<string, Session>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> },
) {
  const { containerId } = await params;
  const token = request.nextUrl.searchParams.get("token");
  const sessionId = request.nextUrl.searchParams.get("sessionId");

  if (!token || !containerId || !sessionId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Validate containerId format (hex string, prevent injection)
  if (!/^[a-f0-9]+$/i.test(containerId)) {
    return new Response("Invalid container ID", { status: 400 });
  }

  // Validate sessionId format
  if (!/^[a-z0-9-]+$/i.test(sessionId)) {
    return new Response("Invalid session ID", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Use -i for interactive mode so the shell displays PS1 prompts.
      // Without a real PTY, job control is disabled but prompts still work.
      const proc = spawn("docker", [
        "exec",
        "-i",
        "-e", "TERM=xterm-256color",
        "-e", "PS1=$ ",
        containerId,
        "/bin/sh",
        "-i",
      ]);

      function send(eventType: string, data: string) {
        try {
          const b64 = Buffer.from(data).toString("base64");
          controller.enqueue(
            encoder.encode(`event: ${eventType}\ndata: ${b64}\n\n`),
          );
        } catch {
          // Controller might be closed
        }
      }

      sessions.set(sessionId, { proc, send });

      proc.stdout?.on("data", (chunk: Buffer) => send("output", chunk.toString()));
      proc.stderr?.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        // Suppress the "can't access tty" warning but pass everything else
        const filtered = text.replace(/.*can't access tty; job control turned off\n?/, "");
        if (filtered) send("output", filtered);
      });

      proc.on("close", (code) => {
        sessions.delete(sessionId);
        try {
          controller.enqueue(
            encoder.encode(`event: exit\ndata: ${code ?? 0}\n\n`),
          );
          controller.close();
        } catch {
          // Already closed
        }
      });

      proc.on("error", () => {
        sessions.delete(sessionId);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
        sessions.delete(sessionId);
        proc.kill();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// POST endpoint to send stdin to the terminal session
export async function POST(request: NextRequest) {
  const { sessionId, input } = await request.json();

  if (!sessionId || typeof input !== "string") {
    return new Response("Bad request", { status: 400 });
  }

  const session = sessions.get(sessionId);
  if (!session || !session.proc.stdin?.writable) {
    return new Response("Session not found", { status: 404 });
  }

  try {
    const decoded = Buffer.from(input, "base64").toString();

    // Without a PTY, the terminal driver doesn't translate CR → LF.
    // xterm.js sends \r for Enter. Translate for the shell.
    const translated = decoded.replace(/\r/g, "\n");
    session.proc.stdin.write(translated);

    // Without a PTY, there's no local echo. Echo printable input back
    // so the user can see what they're typing.
    let echo = "";
    for (const ch of decoded) {
      const code = ch.charCodeAt(0);
      if (ch === "\r") {
        echo += "\r\n";
      } else if (code === 0x7f || code === 0x08) {
        // Backspace: erase previous character on screen
        echo += "\b \b";
      } else if (code === 0x03) {
        echo += "^C\r\n";
      } else if (code === 0x04) {
        echo += "^D";
      } else if (code >= 32) {
        echo += ch;
      }
    }
    if (echo) {
      session.send("output", echo);
    }

    return new Response("OK", { status: 200 });
  } catch {
    return new Response("Write failed", { status: 500 });
  }
}
