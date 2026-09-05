# @coroboros/pdf-cleaner

Remove PDF metadata and links locally through a Node.js 22+ library and CLI.

## Project constraints

- Preserve the API and CLI contract documented in `README.md` and exported by `src/index.ts`: options, error codes, flags, exit codes, cancellation and the `_clean.pdf` suffix. Additions remain backward compatible.
- Process bytes in-process, with no uploads, network calls or telemetry. `pdf-lib` is the sole runtime dependency; additions require explicit approval.
- Keep scope limited to metadata and link removal. Redaction, watermark removal, compression, OCR, recursive traversal, encrypted PDFs and streaming remain excluded.
- Keep overwrite confirmation in `src/cli-runner.ts`: interactive confirmation for `--in-place`, explicit `--yes` in non-interactive use.
- Preserve the public scoped package and dual ESM/CJS exports.

## Validation

Use the scripts in `package.json`. Source or dependency changes require `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`; documentation-only edits need Markdown and reference checks.

For changes to `src/clean.ts`, run `pnpm bench` against the bucket budgets in `bench/baseline.md`. Reuse passing results while the tested inputs remain unchanged.

## Release

Target `main` through a PR and squash-merge the reviewed head. After release approval, tag the merge commit with the next SemVer. `.github/workflows/ci.yml` delegates version updates, changelog, npm publication and GitHub release to the shared package pipeline; leave those generated artifacts to CI. Publishing uses OIDC with provenance; do not add an npm token or publish locally.
