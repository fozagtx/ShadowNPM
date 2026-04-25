import { useState, useEffect, useRef, useCallback } from "react";

/* ── npm logo SVG (official mark) ── */
const NpmLogo = ({ size = 14 }: { size?: number }) => (
  <svg
    viewBox="0 0 780 250"
    width={size * 3}
    height={size}
    aria-label="npm"
    style={{ display: "inline-block", verticalAlign: "middle" }}
  >
    <path
      fill="#CB3837"
      d="M240,250h100v-50h100V0H240V250z M340,50h50v100h-50V50z M480,0v200h100V50h50v150h50V50h50v150h50V0H480z M0,200h100V50h50v150h50V0H0V200z"
    />
  </svg>
);

/* ── Shield icon ── */
const ShieldIcon = ({ color = "var(--safe)" }: { color?: string }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

/* ── Skull icon ── */
const SkullIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="var(--danger)"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "inline-block", verticalAlign: "middle", marginRight: 4 }}
  >
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <path d="M8 20v-4a8 8 0 0 1 8 0v4" />
    <path d="M12 4a8 8 0 0 0-8 8v2h16v-2a8 8 0 0 0-8-8z" />
  </svg>
);

/* ── Animated line that appears after a delay ── */
function Line({
  children,
  delay,
  onShow,
}: {
  children: React.ReactNode;
  delay: number;
  onShow?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(true);
      if (!fired.current) {
        fired.current = true;
        onShow?.();
      }
    }, delay);
    return () => clearTimeout(t);
  }, [delay, onShow]);

  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible && elRef.current) {
      elRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [visible]);

  if (!visible) return null;

  return <div ref={elRef} className="terminal-line terminal-fade-in">{children}</div>;
}

/* ── Typing animation ── */
function Typed({
  text,
  delay,
  speed = 40,
  onDone,
}: {
  text: string;
  delay: number;
  speed?: number;
  onDone?: () => void;
}) {
  const [chars, setChars] = useState("");
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const doneFired = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started || finished) return;
    if (chars.length < text.length) {
      const t = setTimeout(
        () => setChars(text.slice(0, chars.length + 1)),
        speed
      );
      return () => clearTimeout(t);
    }
    setFinished(true);
    if (!doneFired.current) {
      doneFired.current = true;
      onDone?.();
    }
  }, [started, chars, text, speed, finished, onDone]);

  if (!started) return null;

  return (
    <div className="terminal-line">
      <span style={{ color: "var(--text-muted)" }}>$ </span>
      <span style={{ color: "var(--text)" }}>{chars}</span>
      {!finished && <span className="terminal-blink">|</span>}
    </div>
  );
}

/* ── Animated progress bar ── */
function Progress({
  delay,
  duration = 1400,
  color = "var(--safe)",
  onDone,
}: {
  delay: number;
  duration?: number;
  color?: string;
  onDone?: () => void;
}) {
  const [started, setStarted] = useState(false);
  const [pct, setPct] = useState(0);
  const doneFired = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    const steps = 20;
    const interval = duration / steps;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setPct(i / steps);
      if (i >= steps) {
        clearInterval(id);
        if (!doneFired.current) {
          doneFired.current = true;
          onDone?.();
        }
      }
    }, interval);
    return () => clearInterval(id);
  }, [started, duration, onDone]);

  if (!started) return null;

  const filled = Math.round(pct * 20);
  return (
    <div className="terminal-line" style={{ color }}>
      {"\u2588".repeat(filled)}
      {"\u2591".repeat(20 - filled)} {Math.round(pct * 100)}%
    </div>
  );
}

/* ── Terminal chrome (dots + title) ── */
function TerminalChrome({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`terminal-window ${className || ""}`}>
      <div className="terminal-header">
        <div className="terminal-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <span className="terminal-title">{title}</span>
      </div>
      <div className="terminal-body">{children}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  SCENARIO 1: Without ShadowNPM — blind install, compromised             */
/* ────────────────────────────────────────────────────────────────────────── */

function ScenarioWithout({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState(0);
  // 0 = typing command
  // 1 = resolving
  // 2 = installed (looks fine)
  // 3 = attack reveals itself
  // 4 = compromised alert
  // 5 = done, transition

  const goPhase = useCallback((n: number) => setPhase(n), []);

  return (
    <TerminalChrome title="terminal" className={phase >= 3 ? "terminal-danger-border" : ""}>
      {/* Type the install command */}
      <Typed
        text="npm install event-stream@3.3.6"
        delay={400}
        speed={35}
        onDone={() => goPhase(1)}
      />

      {/* Resolving + progress */}
      {phase >= 1 && (
        <Line delay={200}>
          <span style={{ color: "var(--text-dim)" }}>
            <NpmLogo size={10} /> resolving packages...
          </span>
        </Line>
      )}
      {phase >= 1 && (
        <Progress
          delay={500}
          duration={1200}
          color="var(--text-dim)"
          onDone={() => goPhase(2)}
        />
      )}

      {/* Installed successfully (false sense of security) */}
      {phase >= 2 && (
        <Line delay={100}>
          <span style={{ color: "var(--text-dim)" }}>
            added 23 packages in 2.1s
          </span>
        </Line>
      )}
      {phase >= 2 && (
        <Line delay={400}>
          <span style={{ color: "var(--safe)" }}>
            + event-stream@3.3.6
          </span>
          <span style={{ color: "var(--text-dim)" }}> installed successfully</span>
        </Line>
      )}
      {phase >= 2 && (
        <Line delay={800}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
            0 vulnerabilities found
          </span>
        </Line>
      )}

      {/* 3 seconds later: the attack */}
      {phase >= 2 && (
        <Line delay={2000} onShow={() => goPhase(3)}>
          <span style={{ color: "var(--text-muted)", fontSize: "0.65rem", display: "block", margin: "8px 0 4px" }}>
            --- 3 days later ---
          </span>
        </Line>
      )}

      {phase >= 3 && (
        <Line delay={300}>
          <span style={{ color: "var(--danger)" }} className="terminal-glitch">
            <SkullIcon /> postinstall hook executing silently...
          </span>
        </Line>
      )}
      {phase >= 3 && (
        <Line delay={800}>
          <span style={{ color: "var(--danger)" }}>
            {">"} reading ~/.ssh/id_rsa
          </span>
        </Line>
      )}
      {phase >= 3 && (
        <Line delay={1200}>
          <span style={{ color: "var(--danger)" }}>
            {">"} reading ~/.aws/credentials
          </span>
        </Line>
      )}
      {phase >= 3 && (
        <Line delay={1600}>
          <span style={{ color: "var(--danger)" }}>
            {">"} exfiltrating to https://evil.corp/collect
          </span>
        </Line>
      )}

      {/* Final alert */}
      {phase >= 3 && (
        <Line delay={2400} onShow={() => goPhase(4)}>
          <div className="terminal-alert">
            <span className="alert-icon">!</span>
            <div>
              <strong>SYSTEM COMPROMISED</strong>
              <br />
              Supply chain attack via flatmap-stream.
              <br />
              SSH keys, AWS credentials, and wallet mnemonics exfiltrated.
              <br />
              <span style={{ opacity: 0.7 }}>
                npm audit did not catch this.
              </span>
            </div>
          </div>
        </Line>
      )}

      {phase >= 4 && (
        <Line delay={1500} onShow={() => goPhase(5)}>
          <span style={{ color: "var(--danger)", fontWeight: 700, display: "block", marginTop: 6 }}>
            You found out too late. The damage is done.
          </span>
        </Line>
      )}

      {phase >= 5 && (
        <Line delay={2500} onShow={onComplete}>
          <span />
        </Line>
      )}
    </TerminalChrome>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  SCENARIO 2: With ShadowNPM — catches phishing before install            */
/* ────────────────────────────────────────────────────────────────────────── */

function ScenarioWith() {
  const [phase, setPhase] = useState(0);
  // 0 = typing command
  // 1 = payment on Arc
  // 2 = scanning
  // 3 = findings
  // 4 = verdict

  const goPhase = useCallback((n: number) => setPhase(n), []);

  return (
    <TerminalChrome title="terminal" className={phase >= 4 ? "terminal-safe-border" : ""}>
      {/* Type the audit command */}
      <Typed
        text="shadownpm install event-stream@3.3.6"
        delay={400}
        speed={30}
        onDone={() => goPhase(1)}
      />

      {/* Payment on Arc */}
      {phase >= 1 && (
        <Line delay={200}>
          <span style={{ color: "var(--text-dim)" }}>
            <ShieldIcon color="var(--arc-blue)" />
            checking on-chain audit registry...
          </span>
        </Line>
      )}
      {phase >= 1 && (
        <Line delay={700}>
          <span style={{ color: "var(--text-muted)" }}>
            {">"} no existing audit found. requesting new audit.
          </span>
        </Line>
      )}
      {phase >= 1 && (
        <Line delay={1100}>
          <span style={{ color: "var(--arc-blue)" }}>
            {">"} paying $0.001 USDC via x402 on Arc...
          </span>
        </Line>
      )}
      {phase >= 1 && (
        <Line delay={1600} onShow={() => goPhase(2)}>
          <span style={{ color: "var(--arc-blue)" }}>
            {">"} tx 0x7f2a...c4e1 confirmed
          </span>
        </Line>
      )}

      {/* Scanning */}
      {phase >= 2 && (
        <Line delay={200}>
          <span style={{ color: "var(--text-dim)" }}>
            {">"} analyzing source code & dependencies...
          </span>
        </Line>
      )}
      {phase >= 2 && (
        <Progress
          delay={500}
          duration={1500}
          color="var(--investigating)"
          onDone={() => goPhase(3)}
        />
      )}

      {/* Findings */}
      {phase >= 3 && (
        <Line delay={200}>
          <span style={{ color: "var(--suspected)" }}>
            {">"} SUSPICIOUS: obfuscated code in node_modules/flatmap-stream/index.js
          </span>
        </Line>
      )}
      {phase >= 3 && (
        <Line delay={700}>
          <span style={{ color: "var(--suspected)" }}>
            {">"} SUSPICIOUS: postinstall script reads process.env
          </span>
        </Line>
      )}
      {phase >= 3 && (
        <Line delay={1200}>
          <span style={{ color: "var(--danger)" }}>
            {">"} CONFIRMED: sandbox caught outbound HTTP with stolen credentials
          </span>
        </Line>
      )}
      {phase >= 3 && (
        <Line delay={1800}>
          <span style={{ color: "var(--danger)" }}>
            {">"} PHISHING: targets cryptocurrency wallet applications
          </span>
        </Line>
      )}

      {/* Verdict */}
      {phase >= 3 && (
        <Line delay={2500} onShow={() => goPhase(4)}>
          <div className="terminal-verdict terminal-verdict-danger" style={{ marginTop: 8 }}>
            <div className="verdict-header">
              <span className="verdict-badge verdict-badge-danger">
                DANGEROUS
              </span>
              <span className="verdict-score">Score: 1/10</span>
            </div>
            <div className="verdict-detail">
              Supply chain attack — steals SSH keys, AWS credentials &amp; crypto wallet
              mnemonics via obfuscated postinstall dependency
            </div>
            <div className="verdict-capabilities">
              <span className="cap-tag cap-danger">credential-theft</span>
              <span className="cap-tag cap-danger">data-exfiltration</span>
              <span className="cap-tag cap-danger">obfuscated-code</span>
            </div>
            <div className="verdict-action" style={{ marginTop: 6 }}>
              {">"} verdict published to IPFS + ENS on-chain
            </div>
          </div>
        </Line>
      )}

      {phase >= 4 && (
        <Line delay={800}>
          <span style={{ color: "var(--danger)", fontWeight: 600 }}>
            {">"} INSTALL BLOCKED. Package is dangerous.
          </span>
        </Line>
      )}

      {phase >= 4 && (
        <Line delay={1500}>
          <span style={{ color: "var(--safe)", fontWeight: 700, display: "block", marginTop: 4 }}>
            <ShieldIcon /> Crisis averted. ShadowNPM caught it before a single byte ran on your machine.
          </span>
        </Line>
      )}
    </TerminalChrome>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Main export                                                             */
/* ────────────────────────────────────────────────────────────────────────── */

export function HeroAnimation() {
  const [scene, setScene] = useState<"without" | "with">("without");

  return (
    <div className="hero-animation-container">
      <div className="hero-scene-labels">
        <button
          className="scene-tab"
          onClick={() => setScene("without")}
          style={{
            color:
              scene === "without" ? "var(--danger)" : "var(--text-muted)",
            borderColor:
              scene === "without" ? "var(--danger)" : "var(--border)",
          }}
        >
          without ShadowNPM
        </button>
        <button
          className="scene-tab"
          onClick={() => setScene("with")}
          style={{
            color:
              scene === "with" ? "var(--safe)" : "var(--text-muted)",
            borderColor:
              scene === "with" ? "var(--safe)" : "var(--border)",
          }}
        >
          with ShadowNPM
        </button>
      </div>

      <div className="hero-terminal-wrapper">
        {scene === "without" ? (
          <ScenarioWithout
            key={"without-" + Date.now()}
            onComplete={() => setScene("with")}
          />
        ) : (
          <ScenarioWith key={"with-" + Date.now()} />
        )}
      </div>
    </div>
  );
}
