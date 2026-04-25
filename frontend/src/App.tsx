import { useEffect, useCallback } from "react";
import { useAuditStore } from "./stores/auditStore";
import { useWalletStore } from "./stores/walletStore";
import { AUDIT_PATH_RE } from "./lib/types";
import { Header } from "./components/Header";
import { Landing } from "./components/Landing";
import { Dashboard } from "./components/Dashboard";
import { AuditView } from "./components/AuditView";

function App() {
  const isRunning = useAuditStore((s) => s.isRunning);
  const verdict = useAuditStore((s) => s.verdict);
  const auditId = useAuditStore((s) => s.auditId);
  const connectToSession = useAuditStore((s) => s.connectToSession);
  const reset = useAuditStore((s) => s.reset);
  const walletAddress = useWalletStore((s) => s.address);

  const auditError = useAuditStore((s) => s.error);
  const hasAudit = isRunning || verdict || (!!auditId && !!auditError);
  const isConnected = !!walletAddress;

  // On mount: reconnect to active session from URL or sessionStorage
  useEffect(() => {
    if (auditId) return;
    const match = window.location.pathname.match(AUDIT_PATH_RE);
    const savedId = sessionStorage.getItem("shadownpm_auditId");
    const targetId = match?.[1] || savedId;
    if (targetId) {
      connectToSession(targetId);
    }
  }, [auditId, connectToSession]);

  // Update URL when an audit starts
  useEffect(() => {
    if (auditId && !window.location.pathname.includes(auditId)) {
      history.pushState(null, "", `/audit/${auditId}`);
    }
  }, [auditId]);

  // Handle browser back/forward
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

  // Determine which view to show
  let content;
  if (hasAudit) {
    content = <AuditView />;
  } else if (isConnected) {
    content = <Dashboard />;
  } else {
    content = <Landing />;
  }

  return (
    <div
      className="flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}
    >
      <Header />
      <main className={`flex-1 flex flex-col ${hasAudit ? "min-h-0 overflow-hidden" : ""}`}>
        {content}
      </main>
    </div>
  );
}

export default App;
