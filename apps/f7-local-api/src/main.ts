import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { createF7SessionService } from "./f7-session-service.js";
import { createF7LocalServer, listenF7LocalServer } from "./server.js";

interface ProcessSignalsTarget {
  readonly argv: readonly string[];
  on(event: string, listener: () => void): unknown;
  off(event: string, listener: () => void): unknown;
}

export interface StartF7LocalApplicationOptions {
  readonly createId?: () => string;
  readonly now?: () => string;
  readonly port?: number;
  readonly processTarget?: ProcessSignalsTarget;
}

export interface F7LocalApplicationHandle {
  readonly server: import("node:http").Server;
  readonly address: AddressInfo;
  close: () => Promise<void>;
}

export async function startF7LocalApplication(options: StartF7LocalApplicationOptions = {}): Promise<F7LocalApplicationHandle> {
  const processTarget = options.processTarget ?? process;
  const service = createF7SessionService({
    createId: options.createId ?? randomUUID,
    now: options.now ?? (() => new Date().toISOString()),
  });
  const server = createF7LocalServer({ service });

  let closingPromise: Promise<void> | undefined;
  const cleanupSignalListeners = (): void => {
    processTarget.off("SIGINT", onSignal);
    processTarget.off("SIGTERM", onSignal);
  };

  const close = async (): Promise<void> => {
    if (!closingPromise) {
      closingPromise = new Promise<void>((resolve) => {
        cleanupSignalListeners();
        server.close(() => resolve());
      });
    }
    return closingPromise;
  };

  const onSignal = (): void => {
    void close();
  };

  processTarget.on("SIGINT", onSignal);
  processTarget.on("SIGTERM", onSignal);

  try {
    const address = await listenF7LocalServer(server, options.port ?? 4317);
    return { server, address, close };
  } catch (error) {
    cleanupSignalListeners();
    throw error;
  }
}

export async function runF7LocalApplication(): Promise<void> {
  await startF7LocalApplication({ port: 4317, processTarget: process });
}

function isDirectExecution(processTarget: ProcessSignalsTarget): boolean {
  const entryArg = processTarget.argv[1];
  if (typeof entryArg !== "string") return false;
  return entryArg.endsWith("/main.ts") || entryArg.endsWith("\\main.ts") || entryArg.endsWith("/main.js") || entryArg.endsWith("\\main.js");
}

if (isDirectExecution(process)) {
  runF7LocalApplication().catch(() => {
    console.error("F7 local API failed to start.");
    process.exitCode = 1;
  });
}