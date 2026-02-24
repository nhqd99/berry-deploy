import { spawn } from "child_process";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ containerId: string }> },
) {
  const { containerId } = await params;
  const token = request.nextUrl.searchParams.get("token");

  if (!token || !containerId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Validate containerId format (hex string, prevent injection)
  if (!/^[a-f0-9]+$/i.test(containerId)) {
    return new Response("Invalid container ID", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn("docker", [
        "logs",
        "-f",
        "--tail",
        "200",
        "--timestamps",
        containerId,
      ]);

      function send(data: string) {
        try {
          const lines = data.split("\n");
          for (const line of lines) {
            if (line.trim()) {
              controller.enqueue(encoder.encode(`data: ${line}\n\n`));
            }
          }
        } catch {
          // Controller might be closed
        }
      }

      proc.stdout.on("data", (chunk: Buffer) => send(chunk.toString()));
      proc.stderr.on("data", (chunk: Buffer) => send(chunk.toString()));

      proc.on("close", () => {
        try {
          controller.enqueue(encoder.encode("event: close\ndata: stream ended\n\n"));
          controller.close();
        } catch {
          // Already closed
        }
      });

      proc.on("error", () => {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });

      // Clean up on client disconnect
      request.signal.addEventListener("abort", () => {
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
