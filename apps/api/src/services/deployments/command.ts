import { spawn } from 'child_process';
import { redactSecrets } from './redaction';

export type CommandResult = {
  stdout: string;
  stderr: string;
  code: number;
};

export const runCommand = (
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeout = options.timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill('SIGKILL');
        }, options.timeoutMs)
      : null;

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      if (timeout) clearTimeout(timeout);
      const result = {
        stdout: redactSecrets(stdout),
        stderr: redactSecrets(stderr),
        code: code ?? -1
      };
      if (timedOut) {
        return reject(new Error(`Command timed out: ${command} ${args.join(' ')}`));
      }
      if ((code ?? 1) !== 0) {
        return reject(new Error(`Command failed (${command}): ${result.stderr || result.stdout || 'unknown error'}`));
      }
      return resolve(result);
    });
  });
