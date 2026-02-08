"use client";

import { useReducer, useRef, useCallback, useEffect, useState } from "react";
import {
  dashboardReducer,
  initialDashboardState,
  type Business,
  type LogEntry,
} from "@/lib/types";
import {
  SearchIcon,
  Trash2Icon,
  PhoneIcon,
  SparklesIcon,
  MousePointerIcon,
  XIcon,
  MaximizeIcon,
  MinimizeIcon,
  PhoneCallIcon,
  Loader2Icon,
  CheckCircleIcon,
  XCircleIcon,
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ExternalLinkIcon,
} from "lucide-react";
import { Fragment } from "react";

// ─── Call Outcome Badge ───────────────────────────────────────────────
function CallBadge({ status }: { status: Business["callStatus"] }) {
  switch (status) {
    case "calling":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-400">
          <Loader2Icon className="size-2.5 animate-spin" /> Calling
        </span>
      );
    case "interested":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-400">
          <CheckCircleIcon className="size-2.5" /> Interested
        </span>
      );
    case "not_interested":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
          <XCircleIcon className="size-2.5" /> Not Interested
        </span>
      );
    case "unreachable":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-500/20 text-zinc-400">
          <AlertCircleIcon className="size-2.5" /> Unreachable
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
          <XCircleIcon className="size-2.5" /> Error
        </span>
      );
    default:
      return null;
  }
}

// ─── Enrichment Badge ─────────────────────────────────────────────────
function EnrichBadge({ status }: { status: Business["enrichmentStatus"] }) {
  switch (status) {
    case "running":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/20 text-purple-400">
          <Loader2Icon className="size-2.5 animate-spin" /> Researching
        </span>
      );
    case "done":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/20 text-blue-400">
          <CheckCircleIcon className="size-2.5" /> Enriched
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
          <XCircleIcon className="size-2.5" /> Failed
        </span>
      );
    default:
      return null;
  }
}

// ─── Contact Badge ───────────────────────────────────────────────
function ContactBadge({ status, outcome }: { status?: Business["contactStatus"]; outcome?: Business["contactOutcome"] }) {
  switch (status) {
    case "running":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/20 text-sky-400">
          <Loader2Icon className="size-2.5 animate-spin" /> Contacting
        </span>
      );
    case "done":
      if (outcome === "contacted") {
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/20 text-sky-400">
            <CheckCircleIcon className="size-2.5" /> Successfully Contacted
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
          <XCircleIcon className="size-2.5" /> Failed to Message
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">
          <XCircleIcon className="size-2.5" /> Failed to Message
        </span>
      );
    default:
      return null;
  }
}

// ─── Browser Viewer ───────────────────────────────────────────────────
function BrowserViewer({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <span className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 px-2 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-[10px] font-semibold">
              LIVE
            </span>
          </span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-muted hover:bg-accent text-foreground text-xs px-2.5 py-1.5 rounded-md border border-border transition-colors"
          >
            <ExternalLinkIcon className="size-3" />
          </a>
          <button
            onClick={() => setFullscreen(false)}
            className="bg-muted hover:bg-accent text-foreground text-xs px-2.5 py-1.5 rounded-md border border-border transition-colors"
          >
            <MinimizeIcon className="size-3" />
          </button>
          <button
            onClick={onClose}
            className="bg-muted hover:bg-accent text-foreground text-xs px-2.5 py-1.5 rounded-md border border-border transition-colors"
          >
            <XIcon className="size-3" />
          </button>
        </div>
        <iframe
          src={url}
          className="w-full h-full border-0"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    );
  }

  return (
    <div className="relative rounded-md overflow-hidden border border-border bg-black">
      {iframeBlocked ? (
        <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center" style={{ height: 300 }}>
          <span className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 px-2 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-xs font-semibold">LIVE</span>
          </span>
          <p className="text-muted-foreground text-sm">Browser view can&apos;t be embedded here</p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLinkIcon className="size-3.5" />
            Watch live in new tab
          </a>
        </div>
      ) : (
        <iframe
          src={url}
          className="w-full border-0"
          style={{ height: 300 }}
          allow="clipboard-read; clipboard-write"
          onError={() => setIframeBlocked(true)}
          onLoad={(e) => {
            // Detect if iframe loaded but content was blocked
            try {
              const frame = e.currentTarget;
              if (frame.contentDocument === null) setIframeBlocked(true);
            } catch {
              setIframeBlocked(true);
            }
          }}
        />
      )}
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        <span className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-[9px] font-semibold">LIVE</span>
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-black/60 hover:bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded transition-colors"
        >
          <ExternalLinkIcon className="size-2.5" />
        </a>
        <button
          onClick={() => setFullscreen(true)}
          className="bg-black/60 hover:bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded transition-colors"
        >
          <MaximizeIcon className="size-2.5" />
        </button>
        <button
          onClick={onClose}
          className="bg-black/60 hover:bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded transition-colors"
        >
          <XIcon className="size-2.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────
export default function Dashboard() {
  const [state, dispatch] = useReducer(dashboardReducer, initialDashboardState);
  const [searchInput, setSearchInput] = useState("");
  const [callOutcomeFor, setCallOutcomeFor] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const logEndRef = useRef<HTMLDivElement>(null);

  const toggleFilter = useCallback((filter: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }, []);

  // Auto-scroll activity log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.activityLog.length]);

  const addLog = useCallback(
    (type: LogEntry["type"], message: string) => {
      dispatch({
        type: "ADD_LOG",
        entry: { timestamp: Date.now(), message, type },
      });
    },
    []
  );

  // ── Search ──────────────────────────────────────────────────────
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      dispatch({ type: "SET_SEARCH_LOADING", query });
      addLog("info", `Searching for "${query}"...`);

      const match = query.match(/^(.+?)\s+in\s+(.+)$/i);
      const searchTerm = match ? match[1].trim() : query;
      const location = match ? match[2].trim() : "United States";

      try {
        const res = await fetch("/api/search-businesses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ searchTerm, location }),
        });
        const data = await res.json();

        if (data.error) {
          dispatch({ type: "SET_SEARCH_ERROR", error: data.error });
          addLog("error", `Search failed: ${data.error}`);
        } else {
          dispatch({
            type: "SET_SEARCH_RESULTS",
            businesses: data.businesses,
          });
          addLog(
            "success",
            `Found ${data.businesses.length} businesses for "${searchTerm}" in ${location}`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Search failed";
        dispatch({ type: "SET_SEARCH_ERROR", error: msg });
        addLog("error", msg);
      }
    },
    [addLog]
  );

  // ── Enrich ──────────────────────────────────────────────────────
  const handleEnrich = useCallback(
    async (business: Business, mode: "quick" | "deep") => {
      if (mode === "deep") {
        dispatch({
          type: "UPDATE_BUSINESS",
          id: business.id,
          updates: { contactStatus: "running" },
        });
        addLog("info", `Contacting ${business.name}...`);
      } else {
        dispatch({
          type: "UPDATE_BUSINESS",
          id: business.id,
          updates: { enrichmentStatus: "running" },
        });
        addLog("info", `Quick enriching ${business.name}...`);
      }

      try {
        const res = await fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: business.name,
            website: business.website,
            address: business.address,
            mode,
          }),
        });

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === "step") {
                addLog("info", event.message);
                if (event.debugUrl) {
                  dispatch({
                    type: "SET_BROWSER_VIEW",
                    url: event.debugUrl,
                    visible: true,
                  });
                }
              }
              if (event.type === "result") {
                dispatch({
                  type: "UPDATE_BUSINESS",
                  id: business.id,
                  updates: {
                    ...event.data,
                    ...(mode === "deep"
                      ? { contactStatus: "done" as const, contactOutcome: "contacted" as const }
                      : { enrichmentStatus: "done" as const }),
                  },
                });
                dispatch({ type: "SET_BROWSER_VIEW", url: "", visible: false });
                addLog("success", mode === "deep"
                  ? `Contact complete for ${business.name}`
                  : `Enrichment complete for ${business.name}`);
              }
              if (event.type === "error") {
                dispatch({
                  type: "UPDATE_BUSINESS",
                  id: business.id,
                  updates: mode === "deep"
                    ? { contactStatus: "error" as const }
                    : { enrichmentStatus: "error" as const },
                });
                dispatch({ type: "SET_BROWSER_VIEW", url: "", visible: false });
                addLog("error", mode === "deep"
                  ? `Contact failed for ${business.name}`
                  : event.message);
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } catch (err) {
        dispatch({
          type: "UPDATE_BUSINESS",
          id: business.id,
          updates: mode === "deep"
            ? { contactStatus: "error" as const }
            : { enrichmentStatus: "error" as const },
        });
        addLog(
          "error",
          mode === "deep"
            ? `Contact failed for ${business.name}: ${err instanceof Error ? err.message : "Unknown error"}`
            : `Enrichment failed for ${business.name}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    },
    [addLog]
  );

  // ── Call ─────────────────────────────────────────────────────────
  const handleCall = useCallback(
    async (business: Business) => {
      if (!business.phone) {
        addLog("error", `No phone number for ${business.name}`);
        return;
      }

      dispatch({
        type: "UPDATE_BUSINESS",
        id: business.id,
        updates: { callStatus: "calling" },
      });
      addLog("info", `Calling ${business.name} at ${business.phone}...`);

      try {
        const res = await fetch("/api/call-business", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: business.phone,
            companyName: business.name,
            address: business.address,
            category: business.category,
            website: business.website,
          }),
        });
        const data = await res.json();

        if (data.success) {
          dispatch({
            type: "UPDATE_BUSINESS",
            id: business.id,
            updates: { callSid: data.callSid },
          });
          addLog(
            "success",
            `Call placed to ${business.name}${data.testMode ? " (test mode)" : ""}`
          );

          // Poll for call completion
          pollCallStatus(business.id, data.callSid);
        } else {
          dispatch({
            type: "UPDATE_BUSINESS",
            id: business.id,
            updates: { callStatus: "error" },
          });
          addLog("error", `Call failed: ${data.error}`);
        }
      } catch (err) {
        dispatch({
          type: "UPDATE_BUSINESS",
          id: business.id,
          updates: { callStatus: "error" },
        });
        addLog(
          "error",
          `Call error: ${err instanceof Error ? err.message : "Unknown"}`
        );
      }
    },
    [addLog]
  );

  const pollCallStatus = useCallback(
    (businessId: string, callSid: string) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/call-status?callSid=${callSid}`);
          const data = await res.json();

          // Fetch live transcript on every tick
          try {
            const liveRes = await fetch(`/api/call-transcript?callSid=${callSid}&live=true`);
            const liveData = await liveRes.json();
            if (liveData.transcript?.length > 0) {
              dispatch({
                type: "UPDATE_BUSINESS",
                id: businessId,
                updates: { transcript: liveData.transcript },
              });
            }
          } catch {}

          if (
            data.status === "completed" ||
            data.status === "failed" ||
            data.status === "busy" ||
            data.status === "no-answer" ||
            data.status === "canceled"
          ) {
            clearInterval(interval);
            addLog("info", `Call ended (${data.status}). Analyzing transcript...`);

            // Fetch transcript + AI classification
            try {
              const txRes = await fetch(`/api/call-transcript?callSid=${callSid}`);
              const txData = await txRes.json();
              const transcript = txData.transcript ?? [];
              const classification = txData.classification;

              dispatch({
                type: "UPDATE_BUSINESS",
                id: businessId,
                updates: {
                  transcript,
                  callStatus: classification || (data.status === "completed" ? "unreachable" : "unreachable"),
                },
              });

              if (transcript.length > 0) {
                addLog("success", `Transcript: ${transcript.length} turns. AI classified as: ${classification || "unknown"}`);
              } else {
                addLog("info", `No transcript captured.`);
                setCallOutcomeFor(businessId);
              }
            } catch {
              // Fallback to manual classification
              dispatch({
                type: "UPDATE_BUSINESS",
                id: businessId,
                updates: { callStatus: data.status === "completed" ? "idle" : "unreachable" },
              });
              setCallOutcomeFor(businessId);
              addLog("info", `Could not get transcript. Classify manually.`);
            }
          }
        } catch {
          // keep polling
        }
      }, 5000);

      // Stop polling after 5 minutes
      setTimeout(() => clearInterval(interval), 300000);
    },
    [addLog]
  );

  // ── Enrich All ──────────────────────────────────────────────────
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);
  const handleEnrichAll = useCallback(async () => {
    const enrichable = state.businesses.filter(
      (b) => b.enrichmentStatus === "idle"
    );
    if (enrichable.length === 0) {
      addLog("info", "No businesses to enrich.");
      return;
    }

    setIsEnrichingAll(true);
    addLog("info", `Enriching ${enrichable.length} businesses...`);

    for (let i = 0; i < enrichable.length; i++) {
      addLog("info", `Enriching ${i + 1}/${enrichable.length}: ${enrichable[i].name}`);
      await handleEnrich(enrichable[i], "quick");
    }

    setIsEnrichingAll(false);
    addLog("success", "Enrich all complete.");
  }, [state.businesses, handleEnrich, addLog]);

  // ── Classify call outcome ───────────────────────────────────────
  const classifyCall = useCallback(
    (
      businessId: string,
      outcome: "interested" | "not_interested" | "unreachable"
    ) => {
      dispatch({
        type: "UPDATE_BUSINESS",
        id: businessId,
        updates: { callStatus: outcome },
      });
      setCallOutcomeFor(null);
      addLog(
        outcome === "interested" ? "success" : "info",
        `Classified as ${outcome.replace("_", " ")}`
      );
    },
    [addLog]
  );

  const isSearching = state.searchStatus === "loading";

  // Filter businesses based on active filters
  const filteredBusinesses = state.businesses.filter((biz) => {
    if (activeFilters.size === 0) return true;
    if (activeFilters.has("interested") && biz.callStatus === "interested") return true;
    if (activeFilters.has("not_interested") && biz.callStatus === "not_interested") return true;
    if (activeFilters.has("unreachable") && biz.callStatus === "unreachable") return true;
    if (activeFilters.has("contacted") && biz.contactOutcome === "contacted") return true;
    if (activeFilters.has("contact_failed") && (biz.contactStatus === "error" || (biz.contactStatus === "done" && biz.contactOutcome === "not_contacted"))) return true;
    if (activeFilters.has("enriched") && biz.enrichmentStatus === "done") return true;
    if (activeFilters.has("not_started") && biz.callStatus === "idle" && biz.enrichmentStatus === "idle" && (!biz.contactStatus || biz.contactStatus === "idle")) return true;
    return false;
  });

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <PhoneCallIcon className="size-5 text-green-500" />
          <h1 className="text-lg font-semibold">LeadFlow</h1>
          <span className="text-xs text-muted-foreground">
            AI Sales Dashboard
          </span>
        </div>
        <div className="flex items-center gap-2">
          {state.businesses.length > 0 && (
            <button
              onClick={handleEnrichAll}
              disabled={isEnrichingAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
            >
              {isEnrichingAll ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : (
                <SparklesIcon className="size-3" />
              )}
              {isEnrichingAll ? "Enriching..." : "Enrich All"}
            </button>
          )}
        </div>
      </header>

      {/* ── Search Bar ─────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch(searchInput);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder='Search businesses... e.g. "coffee shops in New York"'
              className="w-full pl-10 pr-4 py-2.5 rounded-none border border-border bg-muted/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchInput.trim()}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-none bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <SearchIcon className="size-4" />
            )}
            Search
          </button>
        </form>
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      {state.businesses.length > 0 && (
        <div className="px-6 py-2 border-b border-border flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">Filter:</span>
          {[
            { key: "interested", label: "Interested", color: "bg-green-500/20 text-green-400 border-green-500/30" },
            { key: "not_interested", label: "Not Interested", color: "bg-red-500/20 text-red-400 border-red-500/30" },
            { key: "unreachable", label: "Unreachable", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
            { key: "contacted", label: "Contacted", color: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
            { key: "contact_failed", label: "Contact Failed", color: "bg-red-500/20 text-red-400 border-red-500/30" },
            { key: "enriched", label: "Enriched", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
            { key: "not_started", label: "Not Started", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => toggleFilter(f.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                activeFilters.has(f.key)
                  ? f.color
                  : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
              }`}
            >
              <span className={`size-2.5 rounded-sm border ${
                activeFilters.has(f.key)
                  ? "bg-current border-current"
                  : "border-muted-foreground/40"
              }`} />
              {f.label}
            </button>
          ))}
          {activeFilters.size > 0 && (
            <button
              onClick={() => setActiveFilters(new Set())}
              className="text-[11px] text-muted-foreground hover:text-foreground ml-1 transition-colors"
            >
              Clear
            </button>
          )}
          <span className="text-[11px] text-muted-foreground/50 ml-auto">
            {filteredBusinesses.length} of {state.businesses.length}
          </span>
        </div>
      )}

      {/* ── Main Content ───────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Business Table ──────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-6">
          {state.searchStatus === "loading" && state.businesses.length === 0 ? (
            <div className="overflow-x-auto rounded-none border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium w-6"></th>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Phone</th>
                    <th className="px-3 py-2 text-left font-medium">Address</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-3 py-3"><div className="h-3.5 w-3.5 bg-muted rounded" /></td>
                      <td className="px-3 py-3">
                        <div className="h-4 bg-muted rounded w-36 mb-1.5" />
                        <div className="h-3 bg-muted/60 rounded w-20" />
                      </td>
                      <td className="px-3 py-3"><div className="h-3.5 bg-muted rounded w-28" /></td>
                      <td className="px-3 py-3"><div className="h-3.5 bg-muted rounded w-40" /></td>
                      <td className="px-3 py-3"><div className="h-5 bg-muted rounded-full w-16" /></td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1">
                          <div className="h-6 w-6 bg-muted rounded" />
                          <div className="h-6 w-6 bg-muted rounded" />
                          <div className="h-6 w-6 bg-muted rounded" />
                          <div className="h-6 w-6 bg-muted rounded" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : state.businesses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <SearchIcon className="size-24 mb-6 opacity-20" />
              <p className="text-2xl font-semibold">Look for businesses to connect with</p>
              <div className="flex gap-2 mt-6">
                {[
                  "coffee shops in New York",
                  "dentists in San Francisco",
                  "plumbers in Chicago",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSearchInput(s);
                      handleSearch(s);
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/50 hover:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-none border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium w-6"></th>
                    <th className="px-3 py-2 text-left font-medium">Name</th>
                    <th className="px-3 py-2 text-left font-medium">Phone</th>
                    <th className="px-3 py-2 text-left font-medium">Address</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredBusinesses.map((biz) => (
                    <Fragment key={biz.id}>
                    <tr
                      className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                        biz.callStatus === "interested"
                          ? "bg-green-500/5"
                          : biz.callStatus === "not_interested"
                            ? "bg-red-500/5"
                            : biz.contactOutcome === "contacted"
                              ? "bg-sky-500/5"
                              : ""
                      }`}
                      onClick={() => setExpandedRow(expandedRow === biz.id ? null : biz.id)}
                    >
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {expandedRow === biz.id
                          ? <ChevronUpIcon className="size-3.5" />
                          : <ChevronDownIcon className="size-3.5" />}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-foreground">
                          {biz.website ? (
                            <a
                              href={biz.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {biz.name}
                            </a>
                          ) : (
                            biz.name
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {biz.category && (
                            <span className="text-[10px] text-muted-foreground">
                              {biz.category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                        {biz.phone || "N/A"}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate">
                        {biz.address || "N/A"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-1">
                          <EnrichBadge status={biz.enrichmentStatus} />
                          <ContactBadge status={biz.contactStatus} outcome={biz.contactOutcome} />
                          <CallBadge status={biz.callStatus} />
                        </div>
                      </td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {/* Call outcome picker */}
                          {callOutcomeFor === biz.id && (
                            <div className="flex items-center gap-1 mr-2">
                              <button
                                onClick={() => classifyCall(biz.id, "interested")}
                                className="px-2 py-0.5 text-[10px] rounded bg-green-600 hover:bg-green-500 text-white transition-colors"
                              >
                                Interested
                              </button>
                              <button
                                onClick={() => classifyCall(biz.id, "not_interested")}
                                className="px-2 py-0.5 text-[10px] rounded bg-red-600 hover:bg-red-500 text-white transition-colors"
                              >
                                Not Int.
                              </button>
                              <button
                                onClick={() => classifyCall(biz.id, "unreachable")}
                                className="px-2 py-0.5 text-[10px] rounded bg-zinc-600 hover:bg-zinc-500 text-white transition-colors"
                              >
                                N/A
                              </button>
                            </div>
                          )}

                          {/* Quick enrich */}
                          <button
                            onClick={() => handleEnrich(biz, "quick")}
                            disabled={biz.enrichmentStatus === "running"}
                            title="Quick enrich (Firecrawl + Gemini)"
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                          >
                            <SparklesIcon className="size-3.5" />
                          </button>

                          {/* Deep enrich (contact) */}
                          <button
                            onClick={() => handleEnrich(biz, "deep")}
                            disabled={biz.contactStatus === "running"}
                            title="Contact business (Stagehand browser)"
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                          >
                            <MousePointerIcon className="size-3.5" />
                          </button>

                          {/* Call */}
                          <button
                            onClick={() => handleCall(biz)}
                            disabled={!biz.phone || biz.callStatus === "calling"}
                            title="Call this business"
                            className="p-1.5 rounded hover:bg-green-500/20 text-green-500 hover:text-green-400 disabled:opacity-30 disabled:text-muted-foreground transition-colors"
                          >
                            <PhoneIcon className="size-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => dispatch({ type: "DELETE_BUSINESS", id: biz.id })}
                            title="Remove"
                            className="p-1.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <Trash2Icon className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Expandable detail row ──────────────────────── */}
                    {expandedRow === biz.id && (
                      <tr className="bg-muted/10">
                        <td colSpan={6} className="px-6 py-3">
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            {/* Enrichment info */}
                            <div>
                              <div className="font-medium text-muted-foreground uppercase tracking-wider text-[10px] mb-2">
                                Enrichment Data
                              </div>
                              {biz.enrichmentStatus === "done" ? (
                                <div className="space-y-1.5">
                                  {biz.about && (
                                    <p className="text-muted-foreground italic mb-2">{biz.about}</p>
                                  )}
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground w-16 shrink-0">Owner:</span>
                                    <span className="text-foreground">{biz.ownerName || "—"}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground w-16 shrink-0">Email:</span>
                                    <span className="text-foreground">{biz.email || "—"}</span>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="text-muted-foreground w-16 shrink-0">Direct #:</span>
                                    <span className="text-foreground font-mono">{biz.ceoPhone || "—"}</span>
                                  </div>
                                  {biz.website && (
                                    <div className="flex gap-2">
                                      <span className="text-muted-foreground w-16 shrink-0">Website:</span>
                                      <a href={biz.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">{biz.website}</a>
                                    </div>
                                  )}
                                </div>
                              ) : biz.enrichmentStatus === "running" ? (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Loader2Icon className="size-3 animate-spin" />
                                  Researching...
                                </div>
                              ) : (
                                <p className="text-muted-foreground/50">
                                  Click the sparkle or cursor icon to enrich this business.
                                </p>
                              )}
                            </div>

                            {/* Call transcript */}
                            <div>
                              <div className="font-medium text-muted-foreground uppercase tracking-wider text-[10px] mb-2">
                                Call Transcript
                              </div>
                              {biz.transcript.length > 0 ? (
                                <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-md bg-muted/30 p-2">
                                  {biz.transcript.map((turn, j) => (
                                    <div key={j} className="flex gap-2">
                                      <span className={`shrink-0 font-medium ${turn.role === "ai" ? "text-blue-400" : "text-amber-400"}`}>
                                        {turn.role === "ai" ? "AI:" : "Them:"}
                                      </span>
                                      <span className="text-muted-foreground">{turn.text}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : biz.callStatus === "calling" ? (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Loader2Icon className="size-3 animate-spin" />
                                  Call in progress...
                                </div>
                              ) : (
                                <p className="text-muted-foreground/50">
                                  No call transcript yet.
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Activity Panel ──────────────────────────────────── */}
        <div className="w-80 border-l border-border flex flex-col bg-muted/20">
          <div className="px-4 py-3 border-b border-border text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Activity
          </div>

          {/* Log entries */}
          <div className="flex-1 overflow-auto px-4 py-2 space-y-1">
            {state.activityLog.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 mt-4 text-center">
                Activity will appear here
              </p>
            ) : (
              state.activityLog.map((entry, i) => (
                <div key={i} className="flex gap-2 text-xs py-1">
                  <span className="text-muted-foreground/50 font-mono shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span
                    className={
                      entry.type === "error"
                        ? "text-red-400"
                        : entry.type === "success"
                          ? "text-green-400"
                          : "text-muted-foreground"
                    }
                  >
                    {entry.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>

          {/* Watch live link */}
          {state.browserViewVisible && state.browserViewUrl && (
            <div className="border-t border-border px-4 py-2">
              <a
                href={state.browserViewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Watch live
                <ExternalLinkIcon className="size-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
