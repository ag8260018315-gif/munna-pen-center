import { appendFile, mkdir, open } from "node:fs/promises";
import path from "node:path";
import type { Enquiry, NewEnquiry } from "@/lib/domain/types";
import { generateEnquiryIdentity } from "@/lib/domain/identifiers";
import { StorageUnavailableError, type EnquiryRepository } from "@/lib/repositories/types";

/**
 * V1 enquiry store: one JSON object per line in `<dir>/enquiries.jsonl`.
 *
 * ⚠ Works on a server with a persistent disk (VPS, Docker volume, local dev).
 * Serverless hosts (e.g. Vercel) have a read-only / ephemeral filesystem — writes
 * fail, the form shows its WhatsApp fallback, and nothing is silently lost.
 * Connect a database (Phase 2) before launching on serverless.
 */
export class FileEnquiryRepository implements EnquiryRepository {
  private readonly file: string;

  constructor(
    private readonly directory: string,
    private readonly options: { maxReadBytes?: number } = {},
  ) {
    this.file = path.join(directory, "enquiries.jsonl");
  }

  async create(input: NewEnquiry): Promise<Enquiry> {
    const enquiry: Enquiry = {
      ...input,
      ...generateEnquiryIdentity(),
      status: "NEW",
      createdAt: new Date().toISOString(),
    };

    try {
      await mkdir(this.directory, { recursive: true });
      // Leading "\n": if an earlier append was cut short (disk full, power loss) the file may end mid-line;
      // starting on a fresh line keeps THIS record readable. Blank lines are skipped when reading.
      await appendFile(this.file, `\n${JSON.stringify(enquiry)}\n`, { encoding: "utf8", mode: 0o600 });
    } catch (cause) {
      throw new StorageUnavailableError("Could not write enquiry to disk", { cause });
    }
    return enquiry;
  }

  async list({ limit = 100 }: { limit?: number } = {}): Promise<Enquiry[]> {
    const raw = await this.readNewest();
    if (raw === null) return [];

    const enquiries: Enquiry[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        enquiries.push(JSON.parse(line) as Enquiry);
      } catch {
        // Skip a corrupt line rather than losing every other enquiry.
      }
    }
    return enquiries.reverse().slice(0, limit);
  }

  /**
   * The newest part of the file as text (at most `maxReadBytes`, default 32 MB), or null if there is no file yet.
   * Bounded on purpose: reading a store that has grown huge in one go would exceed V8's string limit and take
   * the owner's only view of their leads down with it.
   */
  private async readNewest(): Promise<string | null> {
    const maxBytes = this.options.maxReadBytes ?? 32 * 1024 * 1024;
    let handle;
    try {
      handle = await open(this.file, "r");
      const { size } = await handle.stat();
      const start = Math.max(0, size - maxBytes);
      const buffer = Buffer.alloc(size - start);
      await handle.read(buffer, 0, buffer.length, start);
      const text = buffer.toString("utf8");
      // When the read started mid-file its first line is cut off: drop it.
      return start > 0 ? text.slice(text.indexOf("\n") + 1) : text;
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new StorageUnavailableError("Could not read enquiries from disk", { cause });
    } finally {
      await handle?.close();
    }
  }
}
