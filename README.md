<!-- omit in toc -->
# @coroboros/pdf-cleaner

**Strip metadata and links from PDFs locally. No upload, no tracking.**

Removes `/Link` annotations and wipes the Info dictionary plus any XMP metadata stream. Ships as both a programmatic library and an `npx` CLI. Runs entirely in process.

[![npm](https://img.shields.io/npm/v/@coroboros/pdf-cleaner?style=flat-square&color=000000)](https://www.npmjs.com/package/@coroboros/pdf-cleaner)
[![ci](https://img.shields.io/github/actions/workflow/status/coroboros/pdf-cleaner/ci.yml?branch=main&style=flat-square&label=ci&color=000000)](https://github.com/coroboros/pdf-cleaner/actions/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-MIT-000000?style=flat-square)](https://opensource.org/licenses/MIT)
[![stars](https://img.shields.io/github/stars/coroboros/pdf-cleaner?style=flat-square&label=stars&color=000000)](https://github.com/coroboros/pdf-cleaner)
[![coroboros.com](https://img.shields.io/badge/coroboros.com-000000?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48cGF0aCBkPSJNMiAxMmgyME0xMiAyYTE1LjMgMTUuMyAwIDAgMSA0IDEwIDE1LjMgMTUuMyAwIDAgMS00IDEwIDE1LjMgMTUuMyAwIDAgMS00LTEwIDE1LjMgMTUuMyAwIDAgMSA0LTEweiIvPjwvc3ZnPg==)](https://coroboros.com)

<!-- omit in toc -->
## Contents

- [Requirements](#requirements)
- [Install](#install)
- [CLI](#cli)
- [Programmatic](#programmatic)
- [API](#api)
- [Privacy](#privacy)
- [Limitations](#limitations)
- [Contributing](#contributing)
- [License](#license)

## Requirements

- Node.js `>=22` LTS. Use [fnm](https://github.com/Schniz/fnm) for version management — Rust-based, faster than nvm.
- Any of the following package managers: `pnpm`, `npm`, `yarn`, `bun`.

## Install

Run without installing:

```bash
npx @coroboros/pdf-cleaner cv.pdf
```

Install globally for repeated CLI use:

```bash
npm install -g @coroboros/pdf-cleaner
pdf-cleaner --help
```

Add as a dependency for programmatic use:

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

## CLI

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

**Exit codes** — `0` success, `1` user error (bad path, unknown flag), `2` per-file cleaning error, `3` unexpected.

## Programmatic

```ts
// ESM (recommended)
import { clean } from '@coroboros/pdf-cleaner';
```

```js
// CommonJS
const { clean } = require('@coroboros/pdf-cleaner');
```

```ts
import { readFile, writeFile } from 'node:fs/promises';
import { clean, CleanError } from '@coroboros/pdf-cleaner';

const bytes = await readFile('cv.pdf');

try {
  const cleaned = await clean(bytes, { keepLinks: false, keepMetadata: false });
  await writeFile('cv_clean.pdf', cleaned);
} catch (err) {
  if (err instanceof CleanError) {
    console.error(err.code, err.message);
  }
}
```

## API

### Types

<details>
<summary><code>CleanInput</code></summary>

<br>

Accepted byte shapes for [`clean`](#api).

```ts
type CleanInput = Uint8Array | ArrayBuffer;
```

Node `Buffer` is accepted via structural compatibility — `Buffer` extends `Uint8Array`.

</details>

<details>
<summary><code>CleanOptions</code></summary>

<br>

Options for [`clean`](#api). Every field is optional. The two boolean flags default to `false` — the defaults strip aggressively.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `keepLinks` | `boolean` | `false` | Preserve `/Link` annotations on every page. Other annotation subtypes (text notes, highlights, form widgets) are preserved regardless. |
| `keepMetadata` | `boolean` | `false` | Preserve the Info dictionary (`/Title`, `/Author`, `/Subject`, `/Keywords`, `/Creator`, `/Producer`, `/CreationDate`, `/ModDate`) and any XMP metadata stream attached to the catalog. |
| `signal` | `AbortSignal` | *(none)* | Cancel the operation cooperatively. Checked before pdf-lib `load`, after `load`, and after the strip phase. Aborting throws `CleanError` with `code: 'ABORTED'` and `cause = signal.reason`. The cancellation is non-cooperative inside pdf-lib itself — once `load` or `save` is entered, it runs to completion before the next check fires. |

</details>

<details>
<summary><code>CleanError</code></summary>

<br>

Thrown by [`clean`](#api). Inherits from `Error`. See [Errors](#errors) for the code list.

```ts
class CleanError extends Error {
  readonly name: 'CleanError';
  readonly code: CleanErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}
```

</details>

<details>
<summary><code>CleanErrorCode</code></summary>

<br>

```ts
type CleanErrorCode = 'INVALID_INPUT' | 'PARSE_FAILED' | 'ENCRYPTED' | 'ABORTED';
```

</details>

<details>
<summary><code>clean(input, options?)</code></summary>

<br>

Strip metadata and links from a PDF and return the cleaned bytes.

**Parameters**

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `input` | [`CleanInput`](#types) | *(required)* | The PDF bytes. Must be non-empty. |
| `options?` | [`CleanOptions`](#types) | `{}` | Granular opt-out flags. |

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
| `INVALID_INPUT` | `input` is missing, `null`, not a `Uint8Array` / `Buffer` / `ArrayBuffer`, or empty. |
| `PARSE_FAILED` | The bytes do not parse as a valid PDF. The original parser error is available via `Error.cause`. |
| `ENCRYPTED` | The PDF carries an `/Encrypt` trailer entry. Decrypt before cleaning. |
| `ABORTED` | `options.signal` fired during the operation. `signal.reason` is preserved on `Error.cause`. |

## Privacy

Cleaning happens in-process. The library opens no network connections and writes no telemetry. CLI output goes to disk only — to `<basename>_clean.pdf` alongside the input, to the directory passed via `--out`, or back over the original with `--in-place`.

## Limitations

- Stripping is limited to `/Link` annotations and the standard metadata surfaces (Info dictionary plus any XMP metadata stream). Other annotation subtypes are preserved.
- Encrypted PDFs are rejected with `ENCRYPTED`. Decrypt them first.
- Directory mode walks the top level only — subdirectories are not traversed.
- Text content, embedded images, page geometry, fonts, bookmarks, and form fields are preserved untouched.
- Out of scope: text redaction, watermark removal, compression, OCR, JavaScript action stripping, attachment removal.

## Contributing

Bug reports and PRs welcome.

- Open an issue before submitting non-trivial PRs.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- Run `pnpm lint && pnpm typecheck && pnpm test` before pushing.
- Target the `main` branch.

## License

[MIT](LICENSE.md)
