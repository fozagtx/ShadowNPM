import { HeroAnimation } from "./HeroAnimation";
import { ArcLogo } from "./ArcLogo";

export function Landing() {
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

      {/* ── Hero terminal animation ── */}
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
