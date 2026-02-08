import { executeCommand } from "@/lib/stagehand";
import { NextRequest } from "next/server";

export const maxDuration = 300; // 5 min timeout for long agent runs

export async function POST(req: NextRequest) {
  const { command } = await req.json();

  if (!command || typeof command !== "string") {
    return new Response(JSON.stringify({ error: "Missing command" }), {
      status: 400,
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      executeCommand(command.trim(), (event) => {
        const data = JSON.stringify(event);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }).then(() => {
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
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
