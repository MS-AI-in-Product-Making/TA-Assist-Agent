import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createF6PdfWorkerHandshake } from "./f6-pdf-worker-handshake.js";

function channel() {
  const value = Object.assign(new EventEmitter(), {
    connected: true, exitCode: undefined as number | undefined,
    send: vi.fn(),
    disconnect: vi.fn(() => { value.connected = false; value.emit("disconnect"); }),
  });
  return value;
}

afterEach(() => { vi.useRealTimers(); });

describe("F6 worker completion ownership", () => {
  it("keeps READY worker live until ACK and ignores unknown or premature decisions", () => {
    vi.useFakeTimers();
    const ipc = channel();
    const cleanup = vi.fn(async () => {});
    const handshake = createF6PdfWorkerHandshake(cleanup, ipc);
    ipc.emit("message", "ACK_COMMIT");
    expect(ipc.exitCode).toBeUndefined();
    handshake.ready();
    expect(ipc.send).toHaveBeenCalledWith("READY_SUCCESS", expect.any(Function));
    ipc.emit("message", { status: "ACK_COMMIT" });
    expect(ipc.exitCode).toBeUndefined();
    expect(vi.getTimerCount()).toBe(1);
    ipc.emit("message", "ACK_COMMIT");
    expect(ipc.exitCode).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("controlled ABORT releases a cleaned READY worker with failure", () => {
    vi.useFakeTimers();
    const ipc = channel();
    const handshake = createF6PdfWorkerHandshake(async () => {}, ipc);
    handshake.ready();
    ipc.emit("message", "ABORT");
    expect(ipc.exitCode).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([false, true])("unexpected supervisor disconnect cleans browser before exit (ready=%s)", async (ready) => {
    vi.useFakeTimers();
    const ipc = channel();
    let completeCleanup!: () => void;
    const cleanup = vi.fn(() => new Promise<void>((resolve) => { completeCleanup = resolve; }));
    const handshake = createF6PdfWorkerHandshake(cleanup, ipc);
    if (ready) handshake.ready();
    ipc.emit("disconnect");
    expect(cleanup).toHaveBeenCalledOnce();
    expect(ipc.exitCode).toBeUndefined();
    expect(vi.getTimerCount()).toBe(1);
    handshake.ready();
    ipc.emit("message", "ACK_COMMIT");
    expect(ipc.exitCode).toBeUndefined();
    completeCleanup();
    await Promise.resolve();
    await Promise.resolve();
    expect(ipc.exitCode).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps failure worker owned and rejects any later commit", () => {
    vi.useFakeTimers();
    const ipc = channel();
    const handshake = createF6PdfWorkerHandshake(async () => {}, ipc);
    handshake.fail("cleanup_failed");
    ipc.emit("message", "ACK_COMMIT");
    expect(ipc.send).toHaveBeenCalledWith("cleanup_failed", expect.any(Function));
    expect(ipc.exitCode).toBeUndefined();
    expect(vi.getTimerCount()).toBe(1);
    ipc.emit("disconnect");
  });
});
