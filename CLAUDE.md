# @coroboros/pdf-cleaner

Strip metadata and links from PDFs locally. Removes `/Link` annotations and wipes the Info dict plus any XMP metadata stream. Ships as both a programmatic library and an `npx` CLI. No upload, no tracking.

## Canonical rules

Follows the Coroboros engineering global rules. Repo-specific divergences are stated inline in `## Rules` below.

## Tech Stack
- TypeScript strict, ES modules + CJS dual build (tsdown)
- Vitest + `fast-check` for property tests, Biome for lint/format
- `mitata` for benchmarks (`pnpm bench`)
- Node.js 22 LTS
- One runtime dependency: [`pdf-lib`](https://github.com/Hopding/pdf-lib) (pure JS, no native bindings, no network)

## Commands
- `pnpm build` — bundle ESM + CJS + types to `dist/`
- `pnpm test` — run the Vitest suite (unit + property-based)
- `pnpm lint` / `pnpm lint:fix` — Biome check
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm bench` — build then run `bench/pdf-cleaner.bench.mjs` against the five fixture buckets
- `pnpm dev` — tsdown watch mode

## Important Files
- `src/index.ts` — public entry: `clean`, `CleanInput`, `CleanOptions`, `CleanError`, `CleanErrorCode`
- `src/cli.ts` — bin shell that calls `runCli` and exits with its return code
- `src/cli-runner.ts` — argv parsing via `node:util.parseArgs`, single-file + batch modes, `--in-place` confirmation; exported for in-process tests
- `src/clean.ts` — core `clean(input, options?)`; all pdf-lib calls live here, plus `AbortSignal` checkpoints
- `src/error.ts` — `CleanError` class with `code` + `cause`
- `tests/` — one spec per source module + `tests/clean.property.test.ts` for `fast-check` invariants; `tests/fixtures.ts` builds PDFs in memory at test time
- `bench/pdf-cleaner.bench.mjs` — mitata bench (raw pdf-lib floor / clean no-strip / clean default)
- `bench/baseline.md` — 1.0.0 numbers + regression budget

## Public API (1.0.0 contract)
- `clean(input: Uint8Array | ArrayBuffer, options?: CleanOptions): Promise<Uint8Array>` — strips links and metadata by default. Node `Buffer` is accepted via structural compatibility with `Uint8Array`.
- `CleanOptions` — `{ keepLinks?: boolean; keepMetadata?: boolean; signal?: AbortSignal }`. Both booleans default `false`. The signal is checked before pdf-lib `load`, after `load`, and after the strip phase.
- `CleanError` extends `Error` with `code: 'INVALID_INPUT' | 'PARSE_FAILED' | 'ENCRYPTED' | 'ABORTED'` and supports `Error.cause`.
- CLI `pdf-cleaner <input> [options]`:
  - `<input>` may be a `.pdf` file or a directory of `.pdf` files (top-level only, non-recursive)
  - `--out <dir>` — output directory (default: alongside input)
  - `--in-place` — overwrite input(s). TTY → confirm prompt. Non-TTY → error unless `--yes`
  - `--keep-links`, `--keep-metadata` — granular opt-out
  - `--help` / `-h`, `--version` / `-v`
  - Exit codes: `0` success, `1` user error, `2` per-file cleaning error, `3` unexpected

## Rules
- **NEVER** break the public API above. The signatures and the `_clean.pdf` output suffix are the 1.0.0 contract.
- **NEVER** remove a field from `CleanOptions`, a code from `CleanErrorCode`, or a CLI flag. New fields, codes, and flags are additive only.
- **NEVER** add a second runtime dependency without explicit approval. `pdf-lib` is the single allowed runtime dep.
- **NEVER** widen the scope. Text redaction, watermark removal, compression, OCR, recursive directory walks, password-protected PDFs, and streaming are all out of scope.
- **NEVER** upload bytes anywhere. The package processes everything in-process; no network calls, no telemetry.
- Run `pnpm lint && pnpm typecheck && pnpm test` before every commit.
- Run `pnpm bench` against `bench/baseline.md` when touching `src/clean.ts` — no regression > 10 % on any bucket at fixed feature set.
- Scoped package — `publishConfig.access = "public"` is mandatory, do not remove.
- **Publish auth** — `1.0.0` bootstrapped via the org `NPM_PACKAGE_REGISTRY_TOKEN` (npm exposes no pre-publish Trusted Publisher form for a not-yet-existing scoped package). From `1.0.1`, OIDC Trusted Publisher + `npm provenance`. Never re-add the token after the OIDC switch.
- **Publish** — `npm publish` is CI-only. Manual publish is forbidden because it bypasses OIDC provenance attestation and the tag-vs-`main`-HEAD guard.
- **Git** — `main`-only; branch → PR → squash-merge → tag the merge commit. The tag is the only manual step; release automation (version bump, `CHANGELOG.md`, npm publish, GitHub release) is owned by [`coroboros/ci`](https://github.com/coroboros/ci). Never hand-edit `package.json` version or `CHANGELOG.md`. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before tagging.
