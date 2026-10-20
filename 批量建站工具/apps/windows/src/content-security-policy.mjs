/** The workbench embeds untrusted sites in sandboxed srcdoc frames. Chromium
 * inherits this response policy into those frames, then intersects their own
 * stricter policy with it. Local preview assets use BOTH data: and blob: URLs;
 * every applicable resource directive must allow them here or the child cannot
 * restore them with a meta policy. Native privileges are separately main-frame
 * gated in preload.cjs and main.mjs; this does not grant file/IPC access.
 */
export const WORKBENCH_CONTENT_SECURITY_POLICY = [
  "default-src 'self' data: blob:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
  "style-src 'self' 'unsafe-inline' data: blob: https:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: blob: https:",
  "media-src 'self' data: blob:",
  "connect-src 'self' data: blob: https: http://127.0.0.1:*",
  "worker-src 'self' blob:",
  "frame-src 'self' blob: data:",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ');
