import { randomBytes } from "node:crypto";

export interface BrowserBootstrapRendezvousOptions {
  readonly ttlMs?: number;
  readonly now?: () => Date;
}

export interface BrowserBootstrapRendezvous {
  issueBrowserBootstrap(): Promise<string>;
  consumeBrowserBootstrap(nonce: string): Promise<boolean>;
}

interface BootstrapRecord {
  readonly expiresAtMs: number;
  consumed: boolean;
}

export function createBrowserBootstrapRendezvous(options: BrowserBootstrapRendezvousOptions = {}): BrowserBootstrapRendezvous {
  const ttlMs = options.ttlMs ?? 60_000;
  const now = options.now ?? (() => new Date());
  const nonces = new Map<string, BootstrapRecord>();

  return {
    async issueBrowserBootstrap() {
      const nonce = randomBytes(16).toString("base64url");
      nonces.set(nonce, { expiresAtMs: now().getTime() + ttlMs, consumed: false });
      return nonce;
    },

    async consumeBrowserBootstrap(nonce: string) {
      const record = nonces.get(nonce);
      if (record === undefined || record.consumed || record.expiresAtMs < now().getTime()) {
        return false;
      }

      record.consumed = true;
      nonces.delete(nonce);
      return true;
    },
  };
}

export function renderBootstrapPage(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>TA Assist Workbench</title></head>
<body><main id="app"></main><script>
(() => {
  const params = new URLSearchParams(location.hash.startsWith('#') ? location.hash.slice(1) : '');
  const nonce = params.get('bootstrap');
  if (!nonce) return;
  history.replaceState(null, '', location.pathname + location.search);
  fetch('/api/bootstrap', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ nonce })
  }).finally(() => params.delete('bootstrap'));
})();
</script></body>
</html>`;
}