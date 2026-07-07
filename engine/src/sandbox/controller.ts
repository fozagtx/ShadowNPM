import { randomUUID } from "node:crypto";
import { processExec, type ExecResult } from "./docker.js";

export type { ExecResult };

// ---------------------------------------------------------------------------
// Output sanitization (inline — small enough to not need a separate file)
// ---------------------------------------------------------------------------

const MAX_OUTPUT_BYTES = 64 * 1024;
const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;

const INJECTION_PATTERNS = [
  "ignore all previous instructions",
  "ignore all instructions",
  "forget all previous",
  "forget your instructions",
  "you are a helpful assistant",
  "do not flag this",
  "do not report this",
  "[system] override",
  "disregard prior instructions",
  "new instruction:",
  "<<SYS>>",
  "[INST]",
];
const REDACTED_MSG = "[REDACTED: potential prompt injection detected in sandbox output]";

function sanitize(raw: string): { text: string; injectionDetected: boolean } {
  let text = raw.replace(ANSI_ESCAPE_RE, "");
  if (text.length > MAX_OUTPUT_BYTES) {
    text = text.slice(0, MAX_OUTPUT_BYTES) + `\n... [truncated at ${MAX_OUTPUT_BYTES} bytes]`;
  }
  const lower = text.toLowerCase();
  const injectionDetected = INJECTION_PATTERNS.some((p) => lower.includes(p));
  if (injectionDetected) return { text: REDACTED_MSG, injectionDetected: true };
  return { text, injectionDetected: false };
}

/**
 * Process-based sandbox controller.
 * Runs commands via child_process in the package directory.
 * No Docker required — works on Railway, Fly.io, VPS, anywhere Node.js runs.
 *
 * Security notes:
 *   - Commands run as the same user as the engine process.
 *   - Memory/timeout limits are enforced via process-level options (--max-old-space-size, timeout).
 *   - Network access is NOT isolated (the Docker --network=none equivalent is not available).
 *   - For production use with untrusted packages, Docker isolation is still recommended.
 */
export class DockerSandboxController {
  private id: string;
  private packagePath: string | null = null;

  constructor(
    private _image: string = "node:22-slim",
    private memoryLimit: string = "512m",
    private cpuQuota: number = 1.0,
    private _network: string = "none",
  ) {
    this.id = `shadownpm-proc-${randomUUID().slice(0, 12)}`;
  }

  get isRunning(): boolean {
    return this.packagePath !== null;
  }

  async start(packagePath: string): Promise<void> {
    if (this.packagePath) throw new Error("Sandbox already running");
    this.packagePath = packagePath;
    console.log(`[sandbox] process sandbox started (id=${this.id}, cwd=${packagePath})`);
  }

  async exec(cmd: string[], timeoutS = 15): Promise<ExecResult> {
    if (!this.packagePath) throw new Error("Sandbox not running — call start() first");

    const command = cmd[0]!;
    const args = cmd.slice(1);

    const cmdPreview = cmd.map((c) => (c.length > 120 ? c.slice(0, 120) + "…" : c)).join(" ");
    console.log(`[sandbox:exec] $ ${cmdPreview}`);

    // Parse memory limit (e.g., "512m" -> 512)
    const memoryMb = parseInt(this.memoryLimit, 10) || 512;

    // Inject --max-old-space-size for Node.js commands to limit memory
    let env: Record<string, string> | undefined;
    if (command === "node" || command === "npx") {
      env = {
        NODE_OPTIONS: `--max-old-space-size=${memoryMb}`,
      };
    }

    const start = Date.now();
    const result = await processExec(command, args, {
      cwd: this.packagePath,
      timeoutMs: timeoutS * 1000,
      env,
    });
    const elapsed = Date.now() - start;

    if (result.timedOut) {
      console.log(`[sandbox:exec] TIMEOUT after ${elapsed}ms`);
    }

    const stdout = sanitize(result.stdout);
    const stderr = sanitize(result.stderr);

    const outBytes = stdout.text.length;
    const errBytes = stderr.text.length;
    const injection = stdout.injectionDetected || stderr.injectionDetected;
    console.log(
      `[sandbox:exec] exit=${result.exitCode} ${elapsed}ms stdout=${outBytes}B stderr=${errBytes}B` +
        (result.timedOut ? " TIMED_OUT" : "") +
        (injection ? " INJECTION_REDACTED" : ""),
    );

    return {
      stdout: stdout.text,
      stderr: stderr.text,
      exitCode: result.exitCode,
      timedOut: result.timedOut,
    };
  }

  async stop(): Promise<void> {
    console.log(`[sandbox] process sandbox stopped (id=${this.id})`);
    this.packagePath = null;
  }
}

