import { useState } from "react";
import { useAuditStore } from "../stores/auditStore";
import { useWalletStore } from "../stores/walletStore";
import { HeroAnimation } from "./HeroAnimation";
import { ArcLogo } from "./ArcLogo";

export function Landing() {
  const startAudit = useAuditStore((s) => s.startAudit);
  const paymentStatus = useAuditStore((s) => s.paymentStatus);
  const walletAddress = useWalletStore((s) => s.address);
  const walletConnect = useWalletStore((s) => s.connect);
  const walletConnecting = useWalletStore((s) => s.isConnecting);
  const walletError = useWalletStore((s) => s.error);

  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    startAudit(input.trim());
  };

  const isConnected = !!walletAddress;

  return (
    <div
      className="flex-1 flex flex-col items-center justify-start gap-6"
      style={{ padding: "48px 20px 80px" }}
    >
      <h1
        className="text-center leading-[1.1]"
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "clamp(2.2rem, 5vw, 4rem)",
          letterSpacing: "-0.03em",
        }}
      >
        Trust nothing
        <br />
        verify everything
        <span style={{ color: "var(--text-muted)" }}>.</span>
      </h1>
      <p
        className="text-center max-w-[420px] leading-[1.7]"
        style={{ color: "var(--text-dim)", fontSize: "0.95rem" }}
      >
        Agentic security research for npm packages with x402 payments on{" "}
        <ArcLogo size={18} style={{ verticalAlign: "-3px" }} />
      </p>

      {/* Step 1: Connect Wallet */}
      {!isConnected && (
        <button
          onClick={walletConnect}
          disabled={walletConnecting}
          style={{
            padding: "12px 32px",
            border: "none",
            borderRadius: "var(--radius)",
            background: "var(--arc-blue)",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.9rem",
            cursor: walletConnecting ? "wait" : "pointer",
            letterSpacing: "0.02em",
            fontFamily: "var(--font-mono)",
            opacity: walletConnecting ? 0.6 : 1,
            marginTop: 8,
          }}
        >
          {walletConnecting ? "Connecting..." : "Connect Wallet to Start"}
        </button>
      )}

      {walletError && !isConnected && (
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            color: "var(--danger)",
          }}
        >
          {walletError}
        </p>
      )}

      {/* Step 2: Enter package name (only after wallet connected) */}
      {isConnected && (
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2"
          style={{ marginTop: 8 }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="package name (e.g. lodash)"
            autoFocus
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius)",
              padding: "10px 16px",
              fontFamily: "var(--font-mono)",
              fontSize: "0.9rem",
              color: "var(--text)",
              width: 280,
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || !!paymentStatus}
            className="disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              padding: "10px 20px",
              border: "none",
              borderRadius: "var(--radius)",
              background: "var(--accent)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-mono)",
            }}
          >
            {paymentStatus === "signing"
              ? "Sign in wallet..."
              : paymentStatus === "retrying"
                ? "Processing..."
                : "Pay & Audit"}
          </button>
        </form>
      )}

      {/* Hero terminal animation */}
      <HeroAnimation />

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.65rem",
          color: "var(--text-muted)",
          letterSpacing: "0.01em",
        }}
      >
        $0.001 USDC per audit &middot; Settled on{" "}
        <a
          href="https://arc.network"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}
        >
          <ArcLogo size={14} />
        </a>
        {" "}&middot; LLM by{" "}
        <a
          href="https://featherless.ai"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#a78bfa", textDecoration: "none" }}
        >
          Featherless
        </a>
      </p>
    </div>
  );
}
