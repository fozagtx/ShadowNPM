import { useState } from "react";
import { useAuditStore } from "../stores/auditStore";
import { ActivityFeed } from "./ActivityFeed";
import { CodeViewer } from "./CodeViewer";
import { VerdictBanner } from "./VerdictBanner";
import { FileExplorer } from "./FileExplorer";
import { ResultsPanel } from "./ResultsPanel";

export function AuditView() {
  const [fileExplorerOpen, setFileExplorerOpen] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const verdict = useAuditStore((s) => s.verdict);
  const error = useAuditStore((s) => s.error);
  const isRunning = useAuditStore((s) => s.isRunning);
  const packageName = useAuditStore((s) => s.packageName);
  const startAudit = useAuditStore((s) => s.startAudit);
  const reset = useAuditStore((s) => s.reset);

  // Auto-switch to results when verdict first arrives (adjust state during render)
  const [prevVerdict, setPrevVerdict] = useState(verdict);
  if (verdict !== prevVerdict) {
    setPrevVerdict(verdict);
    if (verdict && !prevVerdict) {
      setShowResults(true);
    }
  }

  // Show error overlay when audit fails mid-scan
  if (error && !isRunning && !verdict) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ padding: 40 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.9rem",
            color: "var(--danger)",
            background: "rgba(255,60,60,0.08)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius)",
            padding: "20px 28px",
            maxWidth: 500,
            textAlign: "center",
          }}
        >
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Audit failed</p>
          <p style={{ fontSize: "0.8rem", marginBottom: 16 }}>{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => { if (packageName) startAudit(packageName); }}
              style={{
                padding: "8px 20px",
                border: "none",
                borderRadius: "var(--radius)",
                background: "var(--accent)",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              Retry
            </button>
            <button
              onClick={() => { reset(); history.pushState(null, "", "/"); }}
              style={{
                padding: "8px 20px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                background: "none",
                color: "var(--text-dim)",
                fontWeight: 600,
                fontSize: "0.8rem",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <VerdictBanner />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Activity Feed — left */}
        <div
          className="flex flex-col shrink-0 overflow-hidden"
          style={{
            width: "var(--sidebar-width)",
            minWidth: "var(--sidebar-width)",
            borderRight: "1px solid var(--border)",
          }}
        >
          <ActivityFeed />
        </div>

        {/* Right panel — results or code viewer */}
        <div className="flex-1 flex flex-col min-w-0">
          {showResults && verdict ? (
            <ResultsPanel
              onShowCode={() => setShowResults(false)}
            />
          ) : (
            <CodeViewer
              onToggleFiles={() => setFileExplorerOpen((o) => !o)}
              filesOpen={fileExplorerOpen}
              onShowResults={verdict ? () => setShowResults(true) : undefined}
            />
          )}
        </div>

        {/* File Explorer — right, collapsible */}
        {!showResults && (
          <FileExplorer
            open={fileExplorerOpen}
            onClose={() => setFileExplorerOpen(false)}
          />
        )}
      </div>
    </>
  );
}
