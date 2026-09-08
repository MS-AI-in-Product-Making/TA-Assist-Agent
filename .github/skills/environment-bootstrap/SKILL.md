---
name: environment-bootstrap
description: Use when starting a repository workflow before dependencies are installed, dependency installation fails, or a required build tool such as tsc is missing.
user-invocable: true
argument-hint: "[<repository-path>]"
---

# Environment Bootstrap

Prepare and verify the repository environment before running a product workflow. Treat a missing build tool as a recoverable environment condition, not an immediate reason to hand work back to the user.

## Workflow

1. Resolve the repository path from the active workspace or the supplied path. Do not infer a different repository.
2. Diagnose before repair: inspect the runtime versions, package manager configuration, lockfile, local dependency state, and complete failing command output.
3. Run `npm run environment:bootstrap` from the repository root.
4. If the command succeeds, continue the caller's original workflow without asking the user to repeat the request.
5. If it fails, use the complete error to identify the failing boundary. Retry only when the next action follows directly from evidence and does not weaken repository or machine security.
6. Report a blocker only after safe recovery paths are exhausted. Include the command, error code, established cause, attempted recovery, and exact user action still required.

## Safety Boundaries

- Do not modify global or user-level npm configuration.
- Do not delete the lockfile. Update it automatically only after npm proves that package manifests and lockfile metadata are out of sync; use `--package-lock-only --ignore-scripts`, preserve manifest constraints, and inspect the resulting diff.
- Keep dependency lifecycle scripts disabled during bootstrap. Run a required lifecycle action separately only after the repository explicitly documents it and the action has been reviewed.
- Do not request credentials, tokens, MFA responses, or secrets in chat.
- Do not bypass TLS, disable certificate validation, or use untrusted package sources.
- Do not request administrator elevation through an interactive terminal.
- Stop for user action only when repair requires permission, credentials, administrator access, a system-level runtime installation, or an unavailable approved package source.

## Completion Gate

Environment preparation is complete only when dependency installation and the repository build both succeed. Warnings are not failures unless the command exits nonzero or the required tool remains unavailable.