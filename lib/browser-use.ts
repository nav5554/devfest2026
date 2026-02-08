const API_BASE = "https://api.browser-use.com/api/v2";

function getApiKey(): string {
  const key = process.env.BROWSER_USE_API_KEY;
  if (!key) throw new Error("BROWSER_USE_API_KEY is required");
  return key;
}

function headers(): Record<string, string> {
  return {
    "X-Browser-Use-API-Key": getApiKey(),
    "Content-Type": "application/json",
  };
}

// --- Types ---

interface TaskStep {
  number: number;
  memory: string;
  evaluationPreviousGoal: string;
  nextGoal: string;
  url: string;
  actions: string[];
}

interface TaskView {
  id: string;
  sessionId: string;
  llm: string;
  task: string;
  status: "started" | "paused" | "finished" | "stopped";
  startedAt: string;
  finishedAt: string | null;
  steps: TaskStep[];
  output: string | null;
  isSuccess: boolean | null;
}

interface SessionView {
  id: string;
  status: "active" | "stopped";
  liveUrl: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export type UpdateCallback = (event: {
  type: "status" | "step" | "result" | "error";
  message: string;
  data?: { success: boolean; message: string; completed: boolean };
  debugUrl?: string;
  sessionId?: string;
}) => void;

// --- Active session tracking (survives hot reloads) ---
const g = globalThis as unknown as { _browserUseSessionId?: string };

export function getActiveSessionId(): string | undefined {
  return g._browserUseSessionId;
}

export function isSessionActive(): boolean {
  return !!g._browserUseSessionId;
}

// --- API calls ---

export async function createTask(
  instruction: string,
  startUrl?: string
): Promise<{ taskId: string; sessionId: string }> {
  // Browser Use requires https URLs
  let safeUrl = startUrl || undefined;
  if (safeUrl && safeUrl.startsWith("http://")) {
    safeUrl = safeUrl.replace("http://", "https://");
  }

  const res = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      task: instruction,
      llm: "gemini-2.5-flash",
      startUrl: safeUrl,
      maxSteps: 20,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser Use create task failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  g._browserUseSessionId = data.sessionId;
  return { taskId: data.id, sessionId: data.sessionId };
}

export async function getTask(taskId: string): Promise<TaskView> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser Use get task failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function getSession(sessionId: string): Promise<SessionView> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Browser Use get session failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function getSessionLiveUrl(sessionId: string): Promise<string | null> {
  const session = await getSession(sessionId);
  return session.liveUrl;
}

export async function stopSession(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: "PATCH",
    headers: headers(),
    body: JSON.stringify({ action: "stop" }),
  });
  if (g._browserUseSessionId === sessionId) {
    g._browserUseSessionId = undefined;
  }
}

export async function stopActiveSession(): Promise<void> {
  const sid = g._browserUseSessionId;
  if (sid) {
    await stopSession(sid);
  }
}

// --- High-level: run task with SSE-style updates ---

export async function runTask(
  instruction: string,
  onUpdate: UpdateCallback,
  startUrl?: string
): Promise<{ output: string; success: boolean }> {
  onUpdate({ type: "status", message: "Creating browser task..." });

  const { taskId, sessionId } = await createTask(instruction, startUrl);

  // Get live URL for browser viewer
  const liveUrl = await getSessionLiveUrl(sessionId);
  if (liveUrl) {
    onUpdate({
      type: "status",
      message: "Browser session ready",
      debugUrl: liveUrl,
      sessionId,
    });
  }

  onUpdate({ type: "status", message: `Running: "${instruction.slice(0, 80)}..."` });

  // Poll until complete
  let lastStepCount = 0;
  const maxWait = 10 * 60 * 1000; // 10 min
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, 3000));

    const task = await getTask(taskId);

    // Report new steps
    if (task.steps.length > lastStepCount) {
      for (let i = lastStepCount; i < task.steps.length; i++) {
        const step = task.steps[i];
        const msg = step.nextGoal || step.memory || `Step ${step.number}`;
        onUpdate({ type: "step", message: msg });
      }
      lastStepCount = task.steps.length;
    }

    if (task.status === "finished" || task.status === "stopped") {
      const output = task.output || "";
      const success = task.isSuccess ?? false;

      onUpdate({
        type: "result",
        message: output || "Task completed",
        data: { success, message: output, completed: true },
      });

      // Stop the session to free resources
      try {
        await stopSession(sessionId);
      } catch {}

      return { output, success };
    }
  }

  // Timeout
  try {
    await stopSession(sessionId);
  } catch {}
  throw new Error("Browser Use task timed out after 10 minutes");
}
