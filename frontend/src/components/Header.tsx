import { useState } from "react";
import { useAuditStore } from "../stores/auditStore";
import { useWalletStore } from "../stores/walletStore";
import { PhaseProgress } from "./PhaseProgress";
import { ArcLogo } from "./ArcLogo";

export function Header() {
  const isRunning = useAuditStore((s) => s.isRunning);
  const packageName = useAuditStore((s) => s.packageName);
  const verdict = useAuditStore((s) => s.verdict);
  const reset = useAuditStore((s) => s.reset);
  const startAudit = useAuditStore((s) => s.startAudit);
  const paymentStatus = useAuditStore((s) => s.paymentStatus);
  const walletAddress = useWalletStore((s) => s.address);
  const walletConnect = useWalletStore((s) => s.connect);
  const walletDisconnect = useWalletStore((s) => s.disconnect);
  const walletConnecting = useWalletStore((s) => s.isConnecting);
  const walletError = useWalletStore((s) => s.error);

  const [input, setInput] = useState("");
  const hasAudit = isRunning || verdict;

  const statusColor = verdict
    ? verdict === "DANGEROUS"
      ? "var(--danger)"
      : "var(--safe)"
    : "var(--investigating)";

  const goHome = () => {
    reset();
    history.pushState(null, "", "/");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      startAudit(input.trim());
      setInput("");
    }
  };

  return (
    <header
      className="flex items-center gap-4 shrink-0"
      style={{
        padding: "0 20px",
        height: "var(--header-height)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <button
        onClick={goHome}
        aria-label="Go to home page"
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "1rem",
          letterSpacing: "-0.02em",
          cursor: "pointer",
          background: "none",
          border: "none",
          padding: 0,
          color: "inherit",
          whiteSpace: "nowrap",
        }}
      >
        Shadow<span style={{ color: "var(--accent)" }}>NPM</span>
      </button>

      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.55rem",
          color: "var(--arc-blue)",
          border: "1px solid var(--arc-blue)",
          borderRadius: 9999,
          padding: "1px 8px",
          letterSpacing: "0.04em",
          opacity: 0.75,
          whiteSpace: "nowrap",
        }}
      >
        <ArcLogo size={13} variant="icon" style={{ marginRight: 4 }} />
        Testnet
      </span>

      {/* Audit input — always visible */}
      <div style={{ flex: 1 }} />

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="package name"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius)",
            padding: "5px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
            color: "var(--text)",
            width: 180,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            padding: "5px 14px",
            border: "none",
            borderRadius: "var(--radius)",
            background: "var(--accent)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.75rem",
            cursor: "pointer",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          Audit
        </button>
      </form>

      {paymentStatus && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.68rem",
            color: "var(--arc-blue)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--arc-blue)",
              animation: "pulse-blue 1.5s ease-in-out infinite",
            }}
          />
          {paymentStatus === "wallet-connecting" && "Connecting wallet..."}
          {paymentStatus === "signing" && "Sign in wallet..."}
          {paymentStatus === "retrying" && "Processing payment..."}
        </span>
      )}

      {walletAddress && !paymentStatus ? (
        <button
          onClick={walletDisconnect}
          title="Disconnect wallet"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.55rem",
            color: "var(--safe)",
            border: "1px solid var(--safe)",
            borderRadius: 9999,
            padding: "1px 8px",
            opacity: 0.75,
            whiteSpace: "nowrap",
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--safe)",
            }}
          />
          {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
        </button>
      ) : !walletAddress && !paymentStatus && (
        <button
          onClick={walletConnect}
          disabled={walletConnecting}
          title={walletError || "Connect MetaMask wallet"}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.65rem",
            color: walletError ? "var(--danger)" : "var(--arc-blue)",
            border: `1px solid ${walletError ? "var(--danger)" : "var(--arc-blue)"}`,
            borderRadius: 9999,
            padding: "3px 12px",
            background: "none",
            cursor: walletConnecting ? "wait" : "pointer",
            whiteSpace: "nowrap",
            opacity: walletConnecting ? 0.5 : 0.85,
          }}
        >
          {walletConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
      )}

      {hasAudit && (
        <div
          className="flex items-center gap-2"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            padding: "4px 14px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.8rem",
            whiteSpace: "nowrap",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: statusColor,
            }}
          />
          {packageName}
        </div>
      )}

      {hasAudit && <PhaseProgress />}

      <button
        onClick={() =>
          document.documentElement.classList.toggle("urushi")
        }
        className="flex items-center gap-1"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-mono)",
          fontSize: "0.7rem",
          color: "var(--text-muted)",
          padding: 0,
        }}
        aria-label="Toggle theme"
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--accent)",
          }}
        />
      </button>
    </header>
  );
}
