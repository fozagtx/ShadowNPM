import { useEffect, useCallback } from "react";
import { useAuditStore } from "./stores/auditStore";
import { AUDIT_PATH_RE } from "./lib/types";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { AuditView } from "./components/AuditView";

function App() {
  const isRunning = useAuditStore((s) => s.isRunning);
  const verdict = useAuditStore((s) => s.verdict);
  const auditId = useAuditStore((s) => s.auditId);
  const error = useAuditStore((s) => s.error);
  const connectToSession = useAuditStore((s) => s.connectToSession);
  const reset = useAuditStore((s) => s.reset);
  const hasAudit = isRunning || verdict;

  // On mount: reconnect to active session from URL or sessionStorage
  useEffect(() => {
    if (auditId) return; // already connected
    const match = window.location.pathname.match(AUDIT_PATH_RE);
    const savedId = sessionStorage.getItem("shadownpm_auditId");
    const targetId = match?.[1] || savedId;
    if (targetId) {
      connectToSession(targetId);
    }
  }, [auditId, connectToSession]);

  // Update URL when an audit starts from the landing page
  useEffect(() => {
    if (auditId && !window.location.pathname.includes(auditId)) {
      history.pushState(null, "", `/audit/${auditId}`);
    }
  }, [auditId]);

  // Handle browser back/forward — only reset if user explicitly goes home
  const onPopState = useCallback(() => {
    const match = window.location.pathname.match(AUDIT_PATH_RE);
    if (match) {
      if (match[1] !== auditId) connectToSession(match[1]);
    } else if (window.location.pathname === "/") {
      reset();
    }
  }, [auditId, connectToSession, reset]);

  useEffect(() => {
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [onPopState]);

  return (
    <div
      className="flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}
    >
      <Header />
      <main className={`flex-1 flex flex-col ${hasAudit ? "min-h-0 overflow-hidden" : ""}`}>
        {hasAudit ? <AuditView /> : <Landing />}
        {error && (
          <div
            style={{
              position: "fixed",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--bg-secondary)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius)",
              padding: "10px 20px",
              fontFamily: "var(--font-mono)",
              fontSize: "0.75rem",
              color: "var(--danger)",
              maxWidth: 480,
              textAlign: "center",
              zIndex: 100,
            }}
          >
            {error}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
