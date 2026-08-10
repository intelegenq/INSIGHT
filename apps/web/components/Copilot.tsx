"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from "react";

// ── Context Provider ──────────────────────────────────────────

interface CopilotContextValue {
  pageContext: string;
  setPageContext: (ctx: string) => void;
  askQuestion: (question: string) => void;
  openCopilot: () => void;
}

const CopilotContext = createContext<CopilotContextValue>({
  pageContext: "",
  setPageContext: () => {},
  askQuestion: () => {},
  openCopilot: () => {},
});

export function useCopilot() {
  return useContext(CopilotContext);
}

// ── Types ─────────────────────────────────────────────────────

interface Citation {
  evidenceId: string;
  source: string;
  status: string;
  note: string;
  reference?: string;
}

interface AssistantMetadata {
  providerUsed: boolean;
  providerName: string;
  contextSize: number;
  hasSufficientData: boolean;
  timestamp: string;
}

interface AssistantResponse {
  answer: string;
  citations: Citation[];
  projects: { id: string; name: string; category: string; description: string }[];
  narratives: { id: string; name: string; trend: string; note: string }[];
  metadata: AssistantMetadata;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  citations?: Citation[];
  projects?: { id: string; name: string }[];
  contextSize?: number;
  connected?: boolean;
  timestamp: string;
}

// ── Provider Component ────────────────────────────────────────

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [pageContext, setPageContext] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const openCopilot = useCallback(() => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const askQuestion = useCallback((question: string) => {
    setInput(question);
    setIsOpen(true);
    setTimeout(() => {
      // Auto-submit
      const event = new Event("submit", { bubbles: true, cancelable: true });
      document.getElementById("copilot-form")?.dispatchEvent(event);
    }, 200);
  }, []);

  const sendQuestion = useCallback(
    async (question: string) => {
      if (!question.trim() || loading) return;

      const userMsg: Message = {
        id: `msg_${Date.now()}`,
        role: "user",
        text: question,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: question,
            pageContext: pageContext || undefined,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody?.error?.message ?? `HTTP ${res.status}`);
        }

        const data = (await res.json()) as AssistantResponse;
        const aiMsg: Message = {
          id: `msg_${Date.now()}_ai`,
          role: "assistant",
          text: data.answer,
          citations: data.citations,
          projects: data.projects,
          contextSize: data.metadata.contextSize,
          connected: data.metadata.providerUsed,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to get response");
      }
      setLoading(false);
    },
    [loading, pageContext],
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const contextLabel = pageContext
    ? pageContext
        .split("\n")[0]
        ?.replace(/^\[.*?\]\s*/, "")
        .slice(0, 50)
    : "General";

  return (
    <CopilotContext.Provider value={{ pageContext, setPageContext, askQuestion, openCopilot }}>
      {children}

      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          className="copilot-launcher"
          onClick={openCopilot}
          aria-label="Ask Insight"
          title="Ask Insight (Ctrl+K)"
        >
          <span className="copilot-launcher-icon">✦</span>
          <span className="copilot-launcher-text">Ask Insight</span>
        </button>
      )}

      {/* Slide-over Panel */}
      {isOpen && (
        <>
          <div className="copilot-overlay" onClick={() => setIsOpen(false)} />
          <div className="copilot-panel">
            {/* Header */}
            <div className="copilot-header">
              <div className="copilot-header-left">
                <span className="copilot-header-icon">✦</span>
                <span className="copilot-header-title">Ask Insight</span>
              </div>
              <div className="copilot-header-right">
                <span className="copilot-context-badge">{contextLabel}</span>
                <button
                  className="copilot-close"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="copilot-messages" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="copilot-welcome">
                  <p className="copilot-welcome-title">Ask about Solana</p>
                  <p className="copilot-welcome-sub">
                    I answer from Insight&apos;s collected data — evidence-backed, no web browsing.
                  </p>
                  <div className="copilot-suggestions">
                    <button
                      className="copilot-suggestion"
                      onClick={() =>
                        sendQuestion("What is the current state of the Solana ecosystem?")
                      }
                    >
                      Current ecosystem state?
                    </button>
                    <button
                      className="copilot-suggestion"
                      onClick={() => sendQuestion("Which protocols have the highest TVL?")}
                    >
                      Top protocols by TVL?
                    </button>
                    <button
                      className="copilot-suggestion"
                      onClick={() => sendQuestion("What narratives are trending?")}
                    >
                      Trending narratives?
                    </button>
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`copilot-msg copilot-msg-${msg.role}`}>
                  <div className="copilot-msg-role">{msg.role === "user" ? "You" : "Insight"}</div>
                  <div className="copilot-msg-text">{msg.text}</div>

                  {msg.role === "assistant" && (
                    <div className="copilot-msg-meta">
                      {msg.connected !== undefined && (
                        <span className={msg.connected ? "t-badge green" : "t-badge yellow"}>
                          {msg.connected ? "Connected" : "Offline"}
                        </span>
                      )}
                      {msg.contextSize !== undefined && msg.contextSize > 0 && (
                        <span className="copilot-meta-item">{msg.contextSize} context items</span>
                      )}
                      {msg.citations && msg.citations.length > 0 && (
                        <span className="copilot-meta-item">{msg.citations.length} citations</span>
                      )}
                    </div>
                  )}

                  {msg.citations && msg.citations.length > 0 && (
                    <details className="copilot-citations">
                      <summary>Evidence ({msg.citations.length})</summary>
                      <ul>
                        {msg.citations.slice(0, 5).map((c) => (
                          <li key={c.evidenceId}>
                            <span className={`evidence-badge ${c.status}`}>{c.status}</span>
                            <span className="citation-source">{c.source}</span>
                            <span className="citation-note">{c.note.slice(0, 80)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}

              {loading && (
                <div className="copilot-msg copilot-msg-assistant">
                  <div className="copilot-msg-role">Insight</div>
                  <div className="copilot-thinking">
                    <span className="copilot-thinking-dot" />
                    <span className="copilot-thinking-dot" />
                    <span className="copilot-thinking-dot" />
                  </div>
                </div>
              )}

              {error && <div className="copilot-error">{error}</div>}
            </div>

            {/* Input */}
            <div className="copilot-input-area">
              <form
                id="copilot-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendQuestion(input);
                }}
              >
                <textarea
                  ref={inputRef}
                  className="copilot-input"
                  placeholder="Ask anything about Solana..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendQuestion(input);
                    }
                  }}
                  rows={2}
                  disabled={loading}
                />
                <button type="submit" className="copilot-send" disabled={loading || !input.trim()}>
                  {loading ? "..." : "→"}
                </button>
              </form>
              <div className="copilot-input-hint">
                <span>Grounded in Insight data · No web browsing</span>
                <span>Esc to close</span>
              </div>
            </div>
          </div>
        </>
      )}
    </CopilotContext.Provider>
  );
}
