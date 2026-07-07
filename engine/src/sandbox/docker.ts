import { execFile, type ExecFileOptions } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

/**
 * Run a command via child_process.execFile with timeout and output capture.
 * No Docker required — uses the host Node.js runtime.
 */
export function processExec(
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; env?: Record<string, string> } = {},
): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = execFile(
      command,
      args,
      {
        cwd: options.cwd,
        maxBuffer: 10 * 1024 * 1024,
        timeout: options.timeoutMs,
        encoding: "utf-8",
        env: options.env ? { ...process.env, ...options.env } : process.env,
      } as ExecFileOptions,
      (error, stdout, stderr) => {
        const timedOut = error?.killed === true;
        const errCode = (error as NodeJS.ErrnoException)?.code;

        let exitCode: number;
        if (errCode === "ENOENT") {
          resolve({ stdout: "", stderr: `command not found: ${command}`, exitCode: 127, timedOut: false });
          return;
        } else if (timedOut) {
          exitCode = -1;
        } else if (!error) {
          exitCode = 0;
        } else if (errCode === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
          exitCode = -1;
        } else {
          exitCode = child.exitCode ?? 1;
        }

        resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? ""), exitCode, timedOut });
      },
    );
  });
}

/**
 * Parse a shell command string into [command, ...args].
 * Handles simple cases — for complex commands pass args directly.
 */
export function parseShellCmd(cmd: string): { command: string; args: string[] } {
  const trimmed = cmd.trim();
  // Handle "sh -c '...'" pattern
  if (trimmed.startsWith("sh -c ")) {
    const script = trimmed.slice(6);
    return { command: "sh", args: ["-c", script] };
  }
  // Handle "node" commands
  if (trimmed.startsWith("node ")) {
    const parts = trimmed.slice(5).trim();
    // Simple split — for complex args use args directly
    return { command: "node", args: parts.split(/\s+/) };
  }
  // Generic: split on first space
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) {
    return { command: trimmed, args: [] };
  }
  return {
    command: trimmed.slice(0, spaceIdx),
    args: trimmed.slice(spaceIdx + 1).split(/\s+/),
  };
}

// Re-export for backward compatibility with verify.ts
export { processExec as dockerExec };

