import { EventEmitter } from "node:events";
import { request } from "node:http";
import { describe, expect, it } from "vitest";
import { startF7LocalApplication } from "./main.js";

class FakeProcessTarget extends EventEmitter {
  argv = ["node", "test-main.ts"];

  override on(event: "SIGINT" | "SIGTERM", listener: () => void): this {
    return super.on(event, listener);
  }

  override off(event: "SIGINT" | "SIGTERM", listener: () => void): this {
    return super.off(event, listener);
  }
}

async function requestStatus(port: number): Promise<number> {
  return await new Promise<number>((resolve) => {
    const req = request({
      host: "127.0.0.1",
      port,
      method: "GET",
      path: "/unknown",
    }, (res) => {
      res.resume();
      res.on("end", () => resolve(res.statusCode ?? 0));
    });
    req.on("error", () => resolve(0));
    req.end();
  });
}

describe("startF7LocalApplication", () => {
  it("starts on loopback and closes on SIGINT with listener cleanup", async () => {
    const processTarget = new FakeProcessTarget();
    const app = await startF7LocalApplication({ port: 0, processTarget });
    const port = app.address.port;

    expect(await requestStatus(port)).toBe(404);
    expect(processTarget.listenerCount("SIGINT")).toBe(1);
    expect(processTarget.listenerCount("SIGTERM")).toBe(1);

    processTarget.emit("SIGINT");
    await app.close();

    expect(processTarget.listenerCount("SIGINT")).toBe(0);
    expect(processTarget.listenerCount("SIGTERM")).toBe(0);
    expect(await requestStatus(port)).toBe(0);
  });

  it("handles repeated signals safely and close is idempotent", async () => {
    const processTarget = new FakeProcessTarget();
    const app = await startF7LocalApplication({ port: 0, processTarget });

    processTarget.emit("SIGTERM");
    processTarget.emit("SIGTERM");
    await app.close();
    await app.close();

    expect(processTarget.listenerCount("SIGINT")).toBe(0);
    expect(processTarget.listenerCount("SIGTERM")).toBe(0);
  });

  it("cleans signal listeners when startup listen fails", async () => {
    const processTarget = new FakeProcessTarget();
    const occupied = await startF7LocalApplication({ port: 0, processTarget });
    const usedPort = occupied.address.port;

    const secondTarget = new FakeProcessTarget();
    await expect(startF7LocalApplication({ port: usedPort, processTarget: secondTarget })).rejects.toBeDefined();
    expect(secondTarget.listenerCount("SIGINT")).toBe(0);
    expect(secondTarget.listenerCount("SIGTERM")).toBe(0);

    await occupied.close();
  });
});