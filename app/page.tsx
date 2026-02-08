"use client";

import { useChat } from "@ai-sdk/react";
import { useState, Fragment } from "react";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { CopyIcon, FileTextIcon, GlobeIcon, MaximizeIcon, MinimizeIcon, MonitorIcon, PhoneIcon, SearchIcon, StoreIcon } from "lucide-react";

function BrowserViewer({ url, isRunning }: { url: string; isRunning: boolean }) {
  const [fullscreen, setFullscreen] = useState(false);

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {isRunning && (
            <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/30 px-2 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-[10px] font-semibold">LIVE</span>
            </div>
          )}
          <button
            onClick={() => setFullscreen(false)}
            className="flex items-center gap-1 bg-muted hover:bg-accent text-foreground text-xs px-2.5 py-1.5 rounded-md border border-border transition-colors"
          >
            <MinimizeIcon className="size-3" />
            Exit
          </button>
        </div>
        <iframe src={url} className="w-full h-full border-0" allow="clipboard-read; clipboard-write" />
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-md overflow-hidden border border-border bg-black" style={{ height: 220 }}>
      <iframe src={url} className="absolute inset-0 w-full h-full border-0" allow="clipboard-read; clipboard-write" />
      <div className="absolute top-2 right-2 flex items-center gap-1.5">
        {isRunning && (
          <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-400 text-[9px] font-semibold">LIVE</span>
          </div>
        )}
        <button
          onClick={() => setFullscreen(true)}
          className="flex items-center gap-1 bg-black/60 backdrop-blur hover:bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded transition-colors"
        >
          <MaximizeIcon className="size-2.5" />
        </button>
      </div>
    </div>
  );
}

export default function Chat() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat();
  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      <Conversation className="flex-1">
        <ConversationContent className="px-4 py-6 space-y-1">
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={<MonitorIcon className="size-6 text-muted-foreground" />}
              title="Stagehand Controller"
              description="Chat with AI or ask it to control a browser."
            >
              <div className="flex flex-wrap gap-2 mt-3 justify-center">
                {[
                  "Go to wikipedia.org and search for AI",
                  "Search Google for weather in NYC",
                  "Go to github.com trending",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      sendMessage({ text: suggestion });
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </ConversationEmptyState>
          )}
          {messages.map((message, idx) => (
            <Fragment key={message.id}>
              {message.parts.map((part, i) => {
                switch (part.type) {
                  case "text":
                    return (
                      <Fragment key={`${message.id}-${i}`}>
                        <Message from={message.role}>
                          <MessageContent>
                            <MessageResponse>{part.text}</MessageResponse>
                          </MessageContent>
                        </Message>
                        {message.role === "assistant" &&
                          idx === messages.length - 1 && (
                            <MessageActions>
                              <MessageAction
                                tooltip="Copy"
                                onClick={() =>
                                  navigator.clipboard.writeText(part.text)
                                }
                              >
                                <CopyIcon className="size-3" />
                              </MessageAction>
                            </MessageActions>
                          )}
                      </Fragment>
                    );
                  case "tool-browser": {
                    const toolPart = part as {
                      state: string;
                      output?: unknown;
                    };
                    const data = toolPart.output as {
                      status?: string;
                      log?: string[];
                      debugUrl?: string;
                      summary?: string;
                    } | null;
                    const log = data?.log ?? [];
                    const running =
                      toolPart.state !== "result" ||
                      data?.status === "running";
                    const debugUrl = data?.debugUrl;

                    return (
                      <Message from="assistant" key={`${message.id}-${i}`}>
                        <MessageContent>
                          <div className="space-y-2">
                            {/* Browser viewer */}
                            {debugUrl && (
                              <BrowserViewer url={debugUrl} isRunning={running} />
                            )}
                            {/* Status */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <GlobeIcon className={`size-3.5 ${running ? "text-amber-400 animate-spin" : "text-green-500"}`} />
                              <span>
                                {running
                                  ? "Executing browser action..."
                                  : "Browser action complete"}
                              </span>
                            </div>
                            {/* Log */}
                            {log.length > 0 && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                                  {log.length} step{log.length !== 1 ? "s" : ""}
                                </summary>
                                <div className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto rounded-md bg-muted/50 p-2">
                                  {log.map((line: string, j: number) => (
                                    <div key={j} className="text-muted-foreground font-mono">
                                      {line}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        </MessageContent>
                      </Message>
                    );
                  }
                  case "tool-search": {
                    const toolPart = part as { state: string; output?: unknown };
                    const data = toolPart.output as {
                      query?: string;
                      results?: { url: string; title: string; snippet: string }[];
                      error?: string;
                    } | null;
                    const searching = toolPart.state !== "result";

                    return (
                      <Message from="assistant" key={`${message.id}-${i}`}>
                        <MessageContent>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <SearchIcon className={`size-3.5 ${searching ? "animate-pulse text-amber-400" : "text-green-500"}`} />
                              <span>
                                {searching
                                  ? "Searching the web..."
                                  : data?.error
                                    ? `Search failed: ${data.error}`
                                    : `Found ${data?.results?.length ?? 0} results for "${data?.query}"`}
                              </span>
                            </div>
                            {data?.results && data.results.length > 0 && (
                              <div className="space-y-1.5">
                                {data.results.map((r, j) => (
                                  <a
                                    key={j}
                                    href={r.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-md bg-muted/50 px-2.5 py-2 hover:bg-muted transition-colors"
                                  >
                                    <div className="text-xs font-medium text-foreground">{r.title}</div>
                                    <div className="text-[10px] text-muted-foreground truncate">{r.url}</div>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </MessageContent>
                      </Message>
                    );
                  }
                  case "tool-scrape": {
                    const toolPart = part as { state: string; output?: unknown };
                    const data = toolPart.output as {
                      url?: string;
                      title?: string;
                      content?: string;
                      error?: string;
                    } | null;
                    const scraping = toolPart.state !== "result";

                    return (
                      <Message from="assistant" key={`${message.id}-${i}`}>
                        <MessageContent>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <FileTextIcon className={`size-3.5 ${scraping ? "animate-pulse text-amber-400" : "text-green-500"}`} />
                              <span>
                                {scraping
                                  ? "Scraping page..."
                                  : data?.error
                                    ? `Failed: ${data.error}`
                                    : `Scraped: ${data?.title || data?.url || "page"}`}
                              </span>
                            </div>
                            {data?.content && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                                  View scraped content
                                </summary>
                                <div className="mt-1.5 max-h-48 overflow-y-auto rounded-md bg-muted/50 p-2 text-muted-foreground font-mono whitespace-pre-wrap">
                                  {data.content.slice(0, 2000)}
                                  {data.content.length > 2000 && "..."}
                                </div>
                              </details>
                            )}
                          </div>
                        </MessageContent>
                      </Message>
                    );
                  }
                  case "tool-find_businesses": {
                    const toolPart = part as { state: string; output?: unknown };
                    const data = toolPart.output as {
                      searchTerm?: string;
                      location?: string;
                      businesses?: { name: string; phone: string; address: string; website: string; category: string }[];
                      error?: string;
                    } | null;
                    const loading = toolPart.state !== "result";

                    return (
                      <Message from="assistant" key={`${message.id}-${i}`}>
                        <MessageContent>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <StoreIcon className={`size-3.5 ${loading ? "animate-pulse text-amber-400" : "text-green-500"}`} />
                              <span>
                                {loading
                                  ? "Finding businesses..."
                                  : data?.error
                                    ? `Error: ${data.error}`
                                    : `Found ${data?.businesses?.length ?? 0} businesses for "${data?.searchTerm}" in ${data?.location}`}
                              </span>
                            </div>
                            {data?.businesses && data.businesses.length > 0 && (
                              <div className="overflow-x-auto rounded-md border border-border">
                                <table className="w-full text-xs">
                                  <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                      <th className="px-2 py-1.5 text-left font-medium">Name</th>
                                      <th className="px-2 py-1.5 text-left font-medium">Phone</th>
                                      <th className="px-2 py-1.5 text-left font-medium">Address</th>
                                      <th className="px-2 py-1.5 text-left font-medium">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border">
                                    {data.businesses.map((biz, j) => (
                                      <tr key={j} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-2 py-1.5 font-medium text-foreground">
                                          {biz.website ? (
                                            <a href={biz.website} target="_blank" rel="noopener noreferrer" className="hover:underline">{biz.name}</a>
                                          ) : biz.name}
                                        </td>
                                        <td className="px-2 py-1.5 text-muted-foreground font-mono">{biz.phone || "N/A"}</td>
                                        <td className="px-2 py-1.5 text-muted-foreground max-w-[200px] truncate">{biz.address || "N/A"}</td>
                                        <td className="px-2 py-1.5">
                                          {biz.phone && (
                                            <button
                                              onClick={() => {
                                                sendMessage({ text: `Call ${biz.name} at ${biz.phone}` });
                                              }}
                                              className="flex items-center gap-1 text-[10px] bg-green-600 hover:bg-green-500 text-white px-2 py-0.5 rounded transition-colors"
                                            >
                                              <PhoneIcon className="size-2.5" />
                                              Call
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </MessageContent>
                      </Message>
                    );
                  }
                  case "tool-call_business": {
                    const toolPart = part as { state: string; output?: unknown };
                    const data = toolPart.output as {
                      success?: boolean;
                      callSid?: string;
                      toNumber?: string;
                      companyName?: string;
                      testMode?: boolean;
                      error?: string;
                    } | null;
                    const calling = toolPart.state !== "result";

                    return (
                      <Message from="assistant" key={`${message.id}-${i}`}>
                        <MessageContent>
                          <div className="flex items-center gap-2 text-xs">
                            <PhoneIcon className={`size-3.5 ${calling ? "animate-pulse text-green-400" : data?.success ? "text-green-500" : "text-red-500"}`} />
                            <span className="text-muted-foreground">
                              {calling
                                ? "Placing call..."
                                : data?.error
                                  ? `Call failed: ${data.error}`
                                  : `Called ${data?.companyName} at ${data?.toNumber}${data?.testMode ? " (test mode)" : ""}`}
                            </span>
                            {data?.callSid && (
                              <span className="text-[10px] text-muted-foreground/50 font-mono">
                                SID: {data.callSid.slice(0, 12)}...
                              </span>
                            )}
                          </div>
                        </MessageContent>
                      </Message>
                    );
                  }
                  default:
                    return null;
                }
              })}
            </Fragment>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input */}
      <div className="p-4">
        <PromptInput
          onSubmit={(message: PromptInputMessage) => {
            if (message.text?.trim()) {
              sendMessage({ text: message.text });
              setInput("");
            }
          }}
          className="mt-2"
        >
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.currentTarget.value)}
              placeholder="Chat or give a browser command..."
              autoFocus
            />
          </PromptInputBody>
          <PromptInputFooter>
            <div />
            <PromptInputSubmit
              status={isLoading ? "streaming" : "ready"}
              disabled={!input.trim() && !isLoading}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
