/**
 * Validation + extraction of file uploads from a multipart form body.
 * Both /api/support/start and /api/support/send accept attachments and
 * forward them to Discord; this is the single point where we decide
 * what's allowed and what isn't.
 *
 * Caps are intentionally below Discord's free-tier 10 MB per file so we
 * never get a "Request entity too large" from the API after the user
 * already waited for an upload.
 */

import type {OutboundFile} from './discord';

export const MAX_FILES = 5;
export const MAX_PER_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_TOTAL_BYTES = 24 * 1024 * 1024; // 24 MB

const ALLOWED_MIME_PREFIXES = [
  'image/',
  'text/',
  'video/mp4',
  'video/webm',
  'audio/',
  'application/pdf',
  'application/zip',
  'application/x-zip',
  'application/json',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/octet-stream', // logs, .bin, .hex etc — type often missing
];

export type ExtractedFiles =
  | {ok: true; files: OutboundFile[]}
  | {ok: false; message: string};

export async function extractAttachments(
  form: FormData,
  field = 'files',
): Promise<ExtractedFiles> {
  const raw = form.getAll(field).filter((x): x is File => x instanceof File && x.size > 0);
  if (!raw.length) return {ok: true, files: []};
  if (raw.length > MAX_FILES) {
    return {ok: false, message: `Too many files (max ${MAX_FILES}).`};
  }

  let total = 0;
  const out: OutboundFile[] = [];
  for (const f of raw) {
    if (f.size > MAX_PER_FILE_BYTES) {
      return {
        ok: false,
        message: `${f.name} is over the 8 MB limit.`,
      };
    }
    total += f.size;
    if (total > MAX_TOTAL_BYTES) {
      return {ok: false, message: 'Total attachment size exceeds 24 MB.'};
    }
    const type = f.type || 'application/octet-stream';
    if (!ALLOWED_MIME_PREFIXES.some((p) => type.startsWith(p))) {
      return {
        ok: false,
        message: `${f.name}: file type ${type} is not allowed.`,
      };
    }
    out.push({
      name: f.name || 'file',
      type,
      data: await f.arrayBuffer(),
    });
  }
  return {ok: true, files: out};
}
