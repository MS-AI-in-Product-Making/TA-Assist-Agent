import { randomBytes } from "node:crypto";

export interface BrowserBootstrapRendezvousOptions {
  readonly ttlMs?: number;
  readonly now?: () => Date;
}

export interface BrowserBootstrapRendezvous {
  issueBrowserBootstrap(sessionId?: string): Promise<string>;
  consumeBrowserBootstrap(nonce: string): Promise<{ readonly accepted: boolean; readonly sessionId?: string }>;
}

interface BootstrapRecord {
  readonly expiresAtMs: number;
  consumed: boolean;
  readonly sessionId?: string;
}

export function createBrowserBootstrapRendezvous(options: BrowserBootstrapRendezvousOptions = {}): BrowserBootstrapRendezvous {
  const ttlMs = options.ttlMs ?? 60_000;
  const now = options.now ?? (() => new Date());
  const nonces = new Map<string, BootstrapRecord>();

  return {
    async issueBrowserBootstrap(sessionId) {
      const nonce = randomBytes(16).toString("base64url");
      nonces.set(nonce, { expiresAtMs: now().getTime() + ttlMs, consumed: false, ...(sessionId === undefined ? {} : { sessionId }) });
      return nonce;
    },

    async consumeBrowserBootstrap(nonce: string) {
      const record = nonces.get(nonce);
      if (record === undefined || record.consumed || record.expiresAtMs < now().getTime()) {
        return { accepted: false };
      }

      record.consumed = true;
      nonces.delete(nonce);
      return { accepted: true, ...(record.sessionId === undefined ? {} : { sessionId: record.sessionId }) };
    },
  };
}

export function renderBootstrapPage(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>TA Assist Workbench</title></head>
<body><main id="app"><h1>TA Assist Workbench 需要重新连接</h1><p>请从 VS Code 执行 TA Assist: Resume Session，生成一次性安全恢复链接。</p></main><script src="/bootstrap.js"></script></body>
</html>`;
}

export function renderBootstrapScript(): string {
  return `(() => {
  const params = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : '');
  const nonce = params.get('bootstrap');
  if (!nonce) return;
  history.replaceState(null, '', location.pathname + location.search);
  fetch('/api/bootstrap', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ nonce })
  }).then((response) => {
    if (!response.ok) throw new Error('bootstrap rejected');
    location.replace(location.pathname + location.search);
  }).catch(() => {
    document.getElementById('app').textContent = 'Workbench authentication failed. Relaunch TA Assist.';
  }).finally(() => params.delete('bootstrap'));
})();`;
}