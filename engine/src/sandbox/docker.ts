import { execFile } from "node:child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

export function dockerExec(args: string[], timeoutMs: number): Promise<ExecResult> {
  return new Promise((resolve) => {
    const child = execFile("docker", args, {
      maxBuffer: 10 * 1024 * 1024,
      timeout: timeoutMs,
      encoding: "utf-8",
    }, (error, stdout, stderr) => {
      const timedOut = error?.killed === true;
      const errCode = (error as NodeJS.ErrnoException)?.code;

      let exitCode: number;
      if (errCode === "ENOENT") {
        // docker binary not found
        resolve({ stdout: "", stderr: "docker not found", exitCode: 127, timedOut: false });
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

      resolve({ stdout: stdout ?? "", stderr: stderr ?? "", exitCode, timedOut });
    });
  });
}
