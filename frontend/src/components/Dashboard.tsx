import { useState } from "react";
import { useAuditStore } from "../stores/auditStore";
import { ArcLogo } from "./ArcLogo";

export function Dashboard() {
  const startAudit = useAuditStore((s) => s.startAudit);
  const isRunning = useAuditStore((s) => s.isRunning);
  const paymentStatus = useAuditStore((s) => s.paymentStatus);
  const error = useAuditStore((s) => s.error);
  const paymentTxHash = useAuditStore((s) => s.paymentTxHash);

  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    startAudit(input.trim());
  };

  const buttonLabel = paymentStatus === "sending"
    ? "Confirm in wallet..."
    : paymentStatus === "verifying"
      ? "Verifying payment..."
      : "Audit";

  return (
    <div
      className="flex-1 flex flex-col items-center justify-start gap-6"
      style={{ padding: "48px 20px 80px" }}
    >
      <h2
        style={{
          fontFamily: "var(--font-heading)",
          fontWeight: 700,
          fontSize: "1.6rem",
          letterSpacing: "-0.02em",
        }}
      >
        Audit a package
      </h2>

      <p
        style={{
          color: "var(--text-dim)",
          fontSize: "0.85rem",
          fontFamily: "var(--font-mono)",
          maxWidth: 400,
          textAlign: "center",
        }}
      >
        Enter an npm package name to scan for malicious code.
        <br />
        <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
          $0.001 USDC per audit on{" "}
          <ArcLogo size={13} style={{ verticalAlign: "-2px" }} />
        </span>
      </p>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2"
        style={{ marginTop: 4 }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. lodash"
          autoFocus
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius)",
            padding: "10px 16px",
            fontFamily: "var(--font-mono)",
            fontSize: "0.9rem",
            color: "var(--text)",
            width: 260,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isRunning || !!paymentStatus}
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
          {buttonLabel}
        </button>
      </form>

      {error && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem",
            color: "var(--danger)",
            maxWidth: 440,
            textAlign: "center",
            background: "rgba(255,60,60,0.08)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius)",
            padding: "14px 20px",
          }}
        >
          <p style={{ marginBottom: 8 }}>{error}</p>
          <button
            onClick={() => { if (input.trim()) startAudit(input.trim()); }}
            style={{
              padding: "6px 16px",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius)",
              background: "none",
              color: "var(--danger)",
              fontWeight: 600,
              fontSize: "0.75rem",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {paymentTxHash && (
        <a
          href={`https://testnet.arcscan.app/tx/${paymentTxHash}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.7rem",
            color: "var(--accent)",
            textDecoration: "underline",
          }}
        >
          View payment tx on ArcScan
        </a>
      )}
    </div>
  );
}
