import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import { DEPLOYMENT_CONFIG } from '../../config/deployment';
import { runCommand } from './command';

type ZipEntryInfo = {
  filename: string;
  file_size: number;
  compress_size: number;
  is_dir: boolean;
  is_symlink: boolean;
  is_device: boolean;
};

const pythonInspectScript = `
import json, stat, sys, zipfile
zpath = sys.argv[1]
entries = []
with zipfile.ZipFile(zpath, 'r') as zf:
  for info in zf.infolist():
    mode = (info.external_attr >> 16) & 0xFFFF
    entries.append({
      'filename': info.filename,
      'file_size': int(info.file_size),
      'compress_size': int(info.compress_size),
      'is_dir': info.is_dir(),
      'is_symlink': stat.S_ISLNK(mode),
      'is_device': stat.S_ISCHR(mode) or stat.S_ISBLK(mode) or stat.S_ISFIFO(mode) or stat.S_ISSOCK(mode)
    })
print(json.dumps({'entries': entries}))
`;

const pythonExtractScript = `
import os, stat, sys, zipfile
zpath = sys.argv[1]
outdir = sys.argv[2]
os.makedirs(outdir, exist_ok=True)
with zipfile.ZipFile(zpath, 'r') as zf:
  for info in zf.infolist():
    mode = (info.external_attr >> 16) & 0xFFFF
    if stat.S_ISLNK(mode) or stat.S_ISCHR(mode) or stat.S_ISBLK(mode) or stat.S_ISFIFO(mode) or stat.S_ISSOCK(mode):
      raise RuntimeError(f'Unsupported zip entry type: {info.filename}')
    target = os.path.realpath(os.path.join(outdir, info.filename))
    if not target.startswith(os.path.realpath(outdir) + os.sep) and target != os.path.realpath(outdir):
      raise RuntimeError(f'Path traversal detected: {info.filename}')
    if info.is_dir():
      os.makedirs(target, exist_ok=True)
      continue
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with zf.open(info, 'r') as src, open(target, 'wb') as dst:
      dst.write(src.read())
`;

const allowedDisallowedPrefix = ['/', '\\'];
const blockedExtensions = new Set(['.exe', '.dll', '.bat', '.cmd', '.ps1', '.sh']);

export const isZipSignature = async (archivePath: string) => {
  const file = await readFile(archivePath);
  if (file.byteLength < 4) return false;
  const signature = file.subarray(0, 4);
  return (
    (signature[0] === 0x50 && signature[1] === 0x4b && signature[2] === 0x03 && signature[3] === 0x04) ||
    (signature[0] === 0x50 && signature[1] === 0x4b && signature[2] === 0x05 && signature[3] === 0x06) ||
    (signature[0] === 0x50 && signature[1] === 0x4b && signature[2] === 0x07 && signature[3] === 0x08)
  );
};

export const inspectZipArchive = async (archivePath: string): Promise<ZipEntryInfo[]> => {
  const { stdout } = await runCommand('python3', ['-c', pythonInspectScript, archivePath], { timeoutMs: 60_000 });
  const payload = JSON.parse(stdout) as { entries: ZipEntryInfo[] };
  return payload.entries || [];
};

export const validateZipEntries = (entries: ZipEntryInfo[]) => {
  let extractedBytes = 0;
  let compressedBytes = 0;
  let fileCount = 0;

  for (const entry of entries) {
    const normalized = path.posix.normalize(entry.filename || '');
    if (!normalized || normalized === '.') continue;

    if (normalized.includes('..') || allowedDisallowedPrefix.some((prefix) => normalized.startsWith(prefix))) {
      throw new Error(`ZIP contains unsafe path: ${entry.filename}`);
    }

    if (entry.is_symlink || entry.is_device) {
      throw new Error(`ZIP contains unsupported entry type: ${entry.filename}`);
    }

    if (!entry.is_dir) {
      fileCount += 1;
      extractedBytes += entry.file_size;
      compressedBytes += entry.compress_size;
      const ext = path.extname(normalized).toLowerCase();
      if (blockedExtensions.has(ext)) {
        throw new Error(`ZIP contains blocked extension: ${entry.filename}`);
      }
    }
  }

  if (fileCount > DEPLOYMENT_CONFIG.maxFileCount) {
    throw new Error('ZIP file count exceeds configured limit');
  }
  if (compressedBytes > DEPLOYMENT_CONFIG.maxCompressedBytes) {
    throw new Error('ZIP compressed size exceeds configured limit');
  }
  if (extractedBytes > DEPLOYMENT_CONFIG.maxExtractedBytes) {
    throw new Error('ZIP extracted size exceeds configured limit');
  }

  return { fileCount, extractedBytes, compressedBytes };
};

export const runMalwareScanHook = async (archivePath: string) => {
  if (!DEPLOYMENT_CONFIG.malwareScannerCommand) return;
  const args = DEPLOYMENT_CONFIG.malwareScannerArgs.map((arg) => arg.replaceAll('{file}', archivePath));
  await runCommand(DEPLOYMENT_CONFIG.malwareScannerCommand, args, { timeoutMs: 120_000 });
};

export const extractZipSafely = async (archivePath: string, workspacePath: string) => {
  await mkdir(workspacePath, { recursive: true });
  await runCommand('python3', ['-c', pythonExtractScript, archivePath, workspacePath], { timeoutMs: 180_000 });
};
