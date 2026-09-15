import type { IncomingMessage, ServerResponse } from "node:http";

export async function readRawBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > maxBytes) {
      throw Object.assign(new Error(`Body exceeds ${Math.round(maxBytes / 1024 / 1024)}MB limit`), { statusCode: 413 });
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

export async function readJsonBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const raw = (await readRawBody(req, maxBytes)).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

/** Only slugify()-shaped ids are ever used as filesystem path segments
 * (book ids, ruleset ids) — reject anything else before it touches disk. */
const SAFE_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

export function isSafeId(id: string): boolean {
  return SAFE_ID_RE.test(id);
}

/** CSRF defense: a browser only omits Origin for a same-origin request (or
 * a non-browser client like curl); a cross-site request always carries an
 * Origin that won't match the Host it's talking to. Rejecting a
 * present-but-mismatched Origin — while still allowing no Origin at all —
 * blocks another website from silently calling these endpoints (which
 * would otherwise write local files or spend the operator's own Anthropic
 * credits) while leaving same-origin and same-device (curl, the app
 * itself, a phone on the same WiFi loading this same origin) untouched. */
export function rejectCrossOrigin(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  const trusted =
    !origin ||
    (() => {
      try {
        return new URL(origin).host === req.headers.host;
      } catch {
        return false;
      }
    })();
  if (!trusted) {
    sendJson(res, 403, { error: "Cross-origin requests are not allowed." });
  }
  return !trusted;
}

/** Splits a "data:image/png;base64,AAAA..." URL into its media type and
 * raw base64 payload, as the Anthropic API's image blocks expect. */
export function splitDataUrl(dataUrl: string): { mediaType: string; data: string } {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) {
    throw Object.assign(new Error("Expected a base64 data URL for each page image"), { statusCode: 400 });
  }
  return { mediaType: match[1], data: match[2] };
}
