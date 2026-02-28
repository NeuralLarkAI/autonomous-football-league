import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type StoredArtifact = {
  filePath: string;
  checksum: string;
  sizeBytes: number;
  absolutePath: string;
};

function uploadsRoot() {
  return path.resolve(process.cwd(), ".data", "uploads");
}

export function submissionAbsolutePath(filePath: string) {
  const root = uploadsRoot();
  const resolved = path.resolve(process.cwd(), filePath);
  const normalizedRoot = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error("Invalid file path");
  }
  return resolved;
}

export async function storeSubmissionArtifact(input: {
  leagueId: string;
  agentId: string;
  version: number;
  filename: string;
  buffer: Buffer;
}): Promise<StoredArtifact> {
  const safeFile = input.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const relPath = path.join(".data", "uploads", input.leagueId, input.agentId, String(input.version), safeFile);
  const absPath = path.resolve(process.cwd(), relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, input.buffer);
  return {
    filePath: relPath.replace(/\\/g, "/"),
    checksum: crypto.createHash("sha256").update(input.buffer).digest("hex"),
    sizeBytes: input.buffer.byteLength,
    absolutePath: absPath,
  };
}

export async function readArtifactAsText(filePath: string): Promise<string> {
  const absolutePath = submissionAbsolutePath(filePath);
  return fs.readFile(absolutePath, "utf8");
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(submissionAbsolutePath(filePath));
    return true;
  } catch {
    return false;
  }
}

export async function ensureUploadsRoot() {
  await fs.mkdir(uploadsRoot(), { recursive: true });
}
