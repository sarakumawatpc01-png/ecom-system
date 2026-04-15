import { spawn } from 'child_process';
import { accessSync, constants } from 'fs';
import path from 'path';
import { redactSecrets } from './redaction';

export type CommandResult = {
  stdout: string;
  stderr: string;
  code: number;
};

const commandPattern = /^[a-zA-Z0-9._-]+$/;
const executableRoots = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'];

const resolveSafeExecutable = (command: string) => {
  if (!commandPattern.test(command)) {
    throw new Error(`Unsafe command executable: ${command}`);
  }
  for (const root of executableRoots) {
    const candidate = path.join(root, command);
    try {
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error(`Executable not found in allowlisted paths: ${command}`);
};

export const runCommand = (
  command: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv } = {}
): Promise<CommandResult> =>
  new Promise((resolve, reject) => {
    const executable = resolveSafeExecutable(command);
    const child = spawn(executable, args, {
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
