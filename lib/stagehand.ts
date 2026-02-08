import { Stagehand } from "@browserbasehq/stagehand";

// --- Persistent Stagehand instance ---
let stagehand: Stagehand | null = null;
let isExecuting = false;

// --- Known site URLs for pre-navigation ---
const SITE_URLS: Record<string, string> = {
  youtube: "https://www.youtube.com",
  google: "https://www.google.com",
  linkedin: "https://www.linkedin.com",
  twitter: "https://www.twitter.com",
  github: "https://www.github.com",
  reddit: "https://www.reddit.com",
  amazon: "https://www.amazon.com",
  wikipedia: "https://www.wikipedia.org",
};

function detectUrl(command: string): string | null {
  const lower = command.toLowerCase();
  const urlMatch = command.match(/https?:\/\/[^\s]+/);
  if (urlMatch) return urlMatch[0];
  for (const [name, url] of Object.entries(SITE_URLS)) {
    if (lower.includes(name)) return url;
  }
  return null;
}

export type UpdateCallback = (event: {
  type: "status" | "step" | "result" | "error";
  message: string;
  data?: { success: boolean; message: string; completed: boolean };
  debugUrl?: string;
  sessionId?: string;
}) => void;

async function getStagehand(onUpdate: UpdateCallback): Promise<Stagehand> {
  if (stagehand) return stagehand;

  onUpdate({ type: "status", message: "Launching browser..." });

  const env = process.env.BROWSERBASE_API_KEY &&
    process.env.BROWSERBASE_API_KEY !== "YOUR_BROWSERBASE_API_KEY"
    ? "BROWSERBASE" as const
    : "LOCAL" as const;

  console.log(`[stagehand] env=${env}, BROWSERBASE_API_KEY=${process.env.BROWSERBASE_API_KEY?.slice(0, 10)}...`);
  onUpdate({ type: "status", message: `Using ${env} browser...` });

  try {
    stagehand = new Stagehand({
      env,
      model: "google/gemini-2.5-flash",
    });
    await stagehand.init();
    console.log(`[stagehand] init complete, sessionId=${stagehand.browserbaseSessionId ?? "local"}`);
  } catch (err) {
    stagehand = null;
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to init Stagehand (${env}): ${msg}`);
  }

  if (env === "BROWSERBASE") {
    onUpdate({
      type: "status",
      message: `Browser ready. Watch live: https://browserbase.com/sessions/${stagehand.browserbaseSessionId}`,
    });
  } else {
    const page = stagehand.context?.pages()[0];
    if (page) await page.goto("about:blank");
    onUpdate({ type: "status", message: "Browser ready (local)." });
  }
  return stagehand;
}

export async function resetStagehand(): Promise<void> {
  if (stagehand) {
    await stagehand.close();
    stagehand = null;
  }
}

export function getIsExecuting() {
  return isExecuting;
}

export function isSessionActive() {
  return stagehand !== null;
}

export async function executeCommand(
  command: string,
  onUpdate: UpdateCallback
): Promise<void> {
  if (isExecuting) {
    onUpdate({ type: "error", message: "A command is already running. Please wait." });
    return;
  }

  isExecuting = true;
  try {
    const sh = await getStagehand(onUpdate);

    // Fetch debug URL for embeddable live view
    if (sh.browserbaseSessionId) {
      let debugUrl = "";
      try {
        const res = await fetch(
          `https://api.browserbase.com/v1/sessions/${sh.browserbaseSessionId}/debug`,
          { headers: { "x-bb-api-key": process.env.BROWSERBASE_API_KEY! } }
        );
        const debug = await res.json();
        debugUrl = debug.debuggerFullscreenUrl ?? "";
      } catch {
        // Fall back to session page link
      }
      onUpdate({
        type: "status",
        message: "Browser session ready",
        debugUrl: debugUrl || `https://www.browserbase.com/sessions/${sh.browserbaseSessionId}`,
        sessionId: sh.browserbaseSessionId,
      });
    }

    onUpdate({ type: "status", message: `Running: "${command}"` });

    // Pre-navigate if command mentions a site
    const url = detectUrl(command);
    if (url) {
      const page = sh.context?.pages()[0];
      const currentUrl = page?.url() ?? "";
      if (!currentUrl.includes(new URL(url).hostname)) {
        onUpdate({ type: "step", message: `Navigating to ${url}...` });
        if (page) {
          await page.goto(url);
          await page.waitForLoadState("domcontentloaded");
        }
      }
    }

    const agent = sh.agent({
      mode: "hybrid",
      model: "google/gemini-3-pro-preview",
      systemPrompt:
        "You are a browser automation assistant. You MUST complete the ENTIRE task before calling done. " +
        "DO NOT call done until every part of the user's instruction has been fulfilled. " +
        "If the instruction has multiple parts, do ALL of them. " +
        "When typing into inputs: click the field first, then type the FULL text. Press Enter to submit. " +
        "Wait for pages to fully load between actions.",
    });

    const result = await agent.execute({
      instruction: command,
      maxSteps: 50,
    });

    onUpdate({
      type: "result",
      message: result.message,
      data: {
        success: result.success,
        message: result.message,
        completed: result.completed,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    onUpdate({ type: "error", message: `Error: ${message}` });
  } finally {
    isExecuting = false;
  }
}
