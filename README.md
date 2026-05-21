<div align="center">

<img src="assets/logo.png" width="288" height="288" alt="@coroboros/pdf-cleaner"/>

<!-- omit in toc -->
# @coroboros/pdf-cleaner

**Strip metadata and links from PDFs locally — no upload, no tracking.**

Removes `/Link` annotations and wipes the Info dictionary plus any XMP metadata stream attached to the catalog. Ships as both a programmatic library and an `npx` CLI. One runtime dependency: `pdf-lib`.

[![npm](https://img.shields.io/npm/v/@coroboros/pdf-cleaner?style=flat-square&color=000000)](https://www.npmjs.com/package/@coroboros/pdf-cleaner)
[![ci](https://img.shields.io/github/actions/workflow/status/coroboros/pdf-cleaner/ci.yml?branch=main&style=flat-square&label=ci&color=000000)](https://github.com/coroboros/pdf-cleaner/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-000000?style=flat-square)](https://opensource.org/licenses/MIT)
[![stars](https://img.shields.io/github/stars/coroboros/pdf-cleaner?style=flat-square&label=stars&color=000000)](https://github.com/coroboros/pdf-cleaner)
[![coroboros.com](https://img.shields.io/badge/coroboros.com-000000?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48cGF0aCBkPSJNMiAxMmgyME0xMiAyYTE1LjMgMTUuMyAwIDAgMSA0IDEwIDE1LjMgMTUuMyAwIDAgMS00IDEwIDE1LjMgMTUuMyAwIDAgMS00LTEwIDE1LjMgMTUuMyAwIDAgMSA0LTEweiIvPjwvc3ZnPg==)](https://coroboros.com)

</div>

<!-- omit in toc -->
## Contents

- [Requirements](#requirements)
- [Install](#install)
- [Usage](#usage)
- [Why this exists](#why-this-exists)
- [CLI](#cli)
- [API](#api)
- [Limitations](#limitations)
- [Compared to alternatives](#compared-to-alternatives)
- [Contributing](#contributing)
- [License](#license)

## Requirements

- Node.js `>= 22 LTS`. Use [fnm](https://github.com/Schniz/fnm) for fast Rust-based version switching.
- Any modern package manager: pnpm, npm, yarn, bun.

## Install

**As a library**

```bash
pnpm add @coroboros/pdf-cleaner
```

```bash
npm install @coroboros/pdf-cleaner
```

```bash
yarn add @coroboros/pdf-cleaner
```

```bash
bun add @coroboros/pdf-cleaner
```

**As a CLI**

```bash
# Run without installing
npx @coroboros/pdf-cleaner cv.pdf
```

```bash
# Install globally for repeated use
pnpm add -g @coroboros/pdf-cleaner
pdf-cleaner --help
```

## Usage

**Programmatic**

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { clean } from '@coroboros/pdf-cleaner';

const cleaned = await clean(await readFile('cv.pdf'));
await writeFile('cv_clean.pdf', cleaned);
```

**CLI**

```bash
npx @coroboros/pdf-cleaner cv.pdf
```

## Why this exists

PDFs carry hidden authorship. The Info dictionary embeds `/Title`, `/Author`, `/Producer`, creation and modification dates, and any XMP metadata stream attached to the catalog. Hyperlinks travel via `/Link` annotations on each page. Hosted cleaners strip both, then upload the bytes. `@coroboros/pdf-cleaner` runs the same strips in-process on a single dependency ([`pdf-lib`](https://github.com/Hopding/pdf-lib)). No network calls, no telemetry. See [`bench/baseline.md`](bench/baseline.md) for the round-trip numbers and the regression budget.

## CLI

<details>
<summary><code>pdf-cleaner &lt;input&gt; [options]</code></summary>

<br>

Strip metadata and links from a PDF or a directory of PDFs. Writes the cleaned bytes alongside the input with a `_clean.pdf` suffix unless `--out` or `--in-place` is set.

**Arguments**

| Arg | Type | Description |
| --- | --- | --- |
| `<input>` | `string` *(required)* | A `.pdf` file, or a directory of `.pdf` files. Directory mode is top-level only — subdirectories are not traversed. |

**Options**

| Flag | Type | Default | Description |
| --- | --- | --- | --- |
| `--out <dir>` | `string` | alongside input | Output directory for cleaned files. Created if missing. |
| `--in-place` | `boolean` | `false` | Overwrite the input(s) in place. TTY prompts for confirmation; non-TTY contexts require `--yes`. |
| `--yes`, `-y` | `boolean` | `false` | Skip the `--in-place` confirmation prompt. Required to run `--in-place` in CI, scripts, or any non-TTY context. |
| `--keep-links` | `boolean` | `false` | Preserve `/Link` annotations. Other annotation subtypes are preserved regardless. |
| `--keep-metadata` | `boolean` | `false` | Preserve the Info dictionary (`/Title`, `/Author`, `/Subject`, `/Keywords`, `/Creator`, `/Producer`, `/CreationDate`, `/ModDate`) and any XMP metadata stream. |
| `--help`, `-h` | `boolean` | — | Print the usage block and exit `0`. |
| `--version`, `-v` | `boolean` | — | Print the package version and exit `0`. |

**Exit codes**

| Code | Meaning |
| --- | --- |
| `0` | Success. Every input file produced a cleaned output. |
| `1` | User error. Bad input path, unknown flag, or `--in-place` in a non-TTY context without `--yes`. |
| `2` | Per-file cleaning error. At least one file failed. Other files in directory mode still complete. |
| `3` | Unexpected error not classified above. |

**Examples**

```bash
# Single file → cv_clean.pdf alongside the input
pdf-cleaner cv.pdf

# Single file → custom output directory
pdf-cleaner cv.pdf --out ./out

# Directory of PDFs (top-level only, non-recursive)
pdf-cleaner ./input --out ./output

# Overwrite the originals — prompts in a TTY, requires --yes otherwise
pdf-cleaner cv.pdf --in-place
pdf-cleaner cv.pdf --in-place --yes

# Granular opt-out
pdf-cleaner cv.pdf --keep-links
pdf-cleaner cv.pdf --keep-metadata
```

</details>

## API

### Types

<details>
<summary><code>CleanInput</code></summary>

<br>

The bytes that [`clean`](#cleaning) accepts.

```ts
type CleanInput = Uint8Array | ArrayBuffer;
```

Node `Buffer` is accepted via structural compatibility — `Buffer` extends `Uint8Array`.

</details>

<details>
<summary><code>CleanOptions</code></summary>

<br>

Per-call overrides for [`clean`](#cleaning). Every field is optional; the two boolean flags default to `false` so the defaults strip aggressively.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `keepLinks` | `boolean` | `false` | Preserve `/Link` annotations on every page. Other annotation subtypes (text notes, highlights, form widgets) are preserved regardless. |
| `keepMetadata` | `boolean` | `false` | Preserve the Info dictionary (`/Title`, `/Author`, `/Subject`, `/Keywords`, `/Creator`, `/Producer`, `/CreationDate`, `/ModDate`) and any XMP metadata stream attached to the catalog. |
| `signal` | `AbortSignal` | *(none)* | Cancel the operation cooperatively. Checked before pdf-lib `load`, after `load`, and after the strip phase. Aborting throws `CleanError` with `code: 'ABORTED'` and `cause = signal.reason`. The cancellation is non-cooperative inside pdf-lib itself — once `load` or `save` is entered, it runs to completion before the next check fires. |

</details>

<details>
<summary><code>CleanError</code></summary>

<br>

Thrown by [`clean`](#cleaning) for inputs it cannot process. Inherits from `Error`, supports `Error.cause` for wrapping.

```ts
class CleanError extends Error {
  readonly name: 'CleanError';
  readonly code: CleanErrorCode;
  constructor(code: CleanErrorCode, message: string, options?: { cause?: unknown });
}
```

The `code` field is a stable string discriminant safe for runtime branching. See [Errors](#errors) for the code list.

</details>

<details>
<summary><code>CleanErrorCode</code></summary>

<br>

```ts
type CleanErrorCode = 'INVALID_INPUT' | 'PARSE_FAILED' | 'ENCRYPTED' | 'ABORTED';
```

</details>

### Cleaning

<details>
<summary><code>clean(input, options?)</code></summary>

<br>

Strip metadata and links from a PDF and return the cleaned bytes.

**Parameters**

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `input` | [`CleanInput`](#types) | *(required)* | The PDF bytes. Must be non-empty. |
| `options?` | [`CleanOptions`](#types) | `{}` | Per-call overrides. See the type for each field. |

**Returns** — `Promise<Uint8Array>`. The cleaned PDF bytes. `clean()` is idempotent on the observable surface — calling it on its own output is a no-op.

**Throws** — [`CleanError`](#types). `INVALID_INPUT` when the input is not bytes, is null, or is empty. `PARSE_FAILED` when the bytes do not parse as a valid PDF; the underlying parser error is preserved on `Error.cause`. `ENCRYPTED` when the PDF carries an `/Encrypt` entry — decrypt before cleaning. `ABORTED` when `options.signal` fires; `signal.reason` is preserved on `Error.cause`.

**Notes** — see [`bench/baseline.md`](bench/baseline.md) for the round-trip numbers and the regression budget.

**Examples**

```ts
// Default — strip both links and metadata
const cleaned = await clean(bytes);
```

```ts
// Wipe metadata, keep working hyperlinks
const cleaned = await clean(bytes, { keepLinks: true });
```

```ts
// Pre-publish CV — strip metadata, keep links so the LinkedIn URL still clicks
import { readFile, writeFile } from 'node:fs/promises';
const original = await readFile('cv.pdf');
const cleaned = await clean(original, { keepLinks: true });
await writeFile('cv_public.pdf', cleaned);
```

```ts
// Server-side use — bound the work with an AbortSignal
const cleaned = await clean(bytes, { signal: AbortSignal.timeout(5000) });
```

</details>

### Errors

| Code | Description |
| --- | --- |
| `INVALID_INPUT` | `input` is missing, `null`, not a [`CleanInput`](#types), or empty. |
| `PARSE_FAILED` | The bytes do not parse as a valid PDF. The original parser error is available via `Error.cause`. |
| `ENCRYPTED` | The PDF carries an `/Encrypt` trailer entry. Decrypt before cleaning. |
| `ABORTED` | `options.signal` fired during the operation. `signal.reason` is preserved on `Error.cause`. |

## Limitations

- Stripping is limited to `/Link` annotations and the standard metadata surfaces (Info dictionary plus any XMP metadata stream). Other annotation subtypes are preserved.
- Encrypted PDFs are rejected with `ENCRYPTED`. Decrypt them first.
- Directory mode walks the top level only — subdirectories are not traversed.
- Text content, embedded images, page geometry, fonts, bookmarks, and form fields are preserved untouched.
- Out of scope: text redaction, watermark removal, compression, OCR, JavaScript action stripping, attachment removal.

## Compared to alternatives

| Feature                              |   `pdf-lib` (raw)    | `qpdf` / `node-qpdf2` | `exiftool-vendored` |    `muhammara`     | **`@coroboros/pdf-cleaner`** |
| ------------------------------------ | :------------------: | :-------------------: | :-----------------: | :----------------: | :--------------------------: |
| Strip Info dictionary                | DIY                  | DIY (binary flags)    | yes (`-all=`)       | DIY                | yes                          |
| Strip XMP metadata stream            | DIY                  | DIY (binary flags)    | yes (`-all=`)       | DIY                | yes                          |
| Strip `/Link` annotations            | DIY                  | DIY                   | no                  | DIY                | yes                          |
| Pure JS — no native binary           | yes                  | no (qpdf binary)      | no (Perl binary)    | no (C++ bindings)  | yes                          |
| In-process — no network upload       | yes                  | yes                   | yes                 | yes                | yes                          |
| CLI included                         | no                   | no (lib only)         | no (lib only)       | no                 | yes                          |
| `AbortSignal` cancellation           | no                   | no                    | no                  | no                 | yes                          |
| Coded `ENCRYPTED` rejection          | throws (no code)     | no                    | n/a                 | unknown            | yes                          |

The market gap is in-process strip plus a bundled CLI. `pdf-lib` ships the engine but no strip helper; every byte you remove, you write the code for. `qpdf` and `muhammara` carry native binaries, and the npm wrappers focus on encryption rather than metadata. `exiftool` clears the Info dict and XMP cleanly but never touches the annotation array, so `/Link` rectangles stay clickable in the output. Hosted cleaners cover everything except the one rule that mattered first: the file leaves your machine. `@coroboros/pdf-cleaner` runs the three strips in-process on `pdf-lib`. The same install ships a coded `CleanError`, `AbortSignal` cancellation at every phase, an `npx` CLI, and an `ENCRYPTED` rejection code for password-protected PDFs.

## Contributing

Bug reports and PRs welcome.

- Open an issue before submitting non-trivial PRs.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- Run `pnpm lint && pnpm typecheck && pnpm test` before pushing.
- Run `pnpm bench` against `bench/baseline.md` when touching `src/clean.ts` — no regression > 10 % at fixed feature set.
- Target the `main` branch.

## License

[MIT](LICENSE.md)
