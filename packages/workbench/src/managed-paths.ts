import { resolve } from "node:path";

export interface ManagedWorkbenchPaths {
  readonly repositoryRoot: string;
  readonly runtimeRoot: string;
  readonly workbenchRoot: string;
  readonly databasePath: string;
}

export function resolveManagedWorkbenchPaths(rootDir: string): ManagedWorkbenchPaths {
  const repositoryRoot = resolve(rootDir);
  const runtimeRoot = resolve(repositoryRoot, "runtime");
  const workbenchRoot = resolve(runtimeRoot, "workbench");

  return {
    repositoryRoot,
    runtimeRoot,
    workbenchRoot,
    databasePath: resolve(workbenchRoot, "workbench.sqlite"),
  };
}