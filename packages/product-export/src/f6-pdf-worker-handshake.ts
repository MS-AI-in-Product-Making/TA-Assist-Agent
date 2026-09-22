interface WorkerChannel {
  readonly connected: boolean;
  exitCode?: string | number | null | undefined;
  on(event: "message" | "disconnect", listener: (message?: unknown) => void): unknown;
  send?: (message: string, callback: (error: Error | null) => void) => unknown;
  disconnect: () => void;
}

export function createF6PdfWorkerHandshake(
  cleanup: () => Promise<void>,
  channel: WorkerChannel = process,
): { ready: () => void; fail: (status: "execution_failed" | "cleanup_failed") => void } {
  let state: "rendering" | "ready" | "failed" | "disconnected" | "released" = "rendering";
  // IPC alone can be unreferenced by Node. Hold our PID until the owner decides.
  const ownership = setInterval(() => {}, 1_000);
  const release = (code: number) => {
    state = "released";
    channel.exitCode = code;
    clearInterval(ownership);
    if (channel.connected) channel.disconnect();
  };
  const disconnected = () => {
    if (state === "released" || state === "disconnected") return;
    state = "disconnected";
    void cleanup().then(() => release(1), () => release(1));
  };
  channel.on("disconnect", disconnected);
  channel.on("message", (message) => {
    if (state !== "ready") return;
    if (message === "ACK_COMMIT") release(0);
    else if (message === "ABORT") release(1);
  });
  const send = (status: string) => {
    if (!channel.connected || channel.send === undefined) { disconnected(); return; }
    try { channel.send(status, (error) => { if (error != null) disconnected(); }); } catch { disconnected(); }
  };
  if (!channel.connected) disconnected();
  return {
    ready: () => {
      if (state !== "rendering") return;
      state = "ready";
      send("READY_SUCCESS");
    },
    fail: (status) => {
      if (state !== "rendering") return;
      state = "failed";
      send(status);
    },
  };
}
