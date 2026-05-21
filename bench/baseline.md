# Benchmark baseline

Apple Silicon (arm64), Node 22.22.2. Run `pnpm bench` to reproduce.

Each bucket decomposes where the time goes:

- **`pdf-lib (load+save)`** — raw round-trip floor with no `clean` wrapper. The lower bound on any operation that touches pdf-lib's parser and serializer.
- **`clean (no-strip)`** — `clean(bytes, { keepLinks: true, keepMetadata: true })`. Measures the wrapper overhead on top of the floor.
- **`clean (default)`** — full strip. The strip work removes `/Link` annotations and the Info dict, which produces a smaller output and shortens the save phase.

## Post-optim (1.0.0)

### `small-1page` — 1 page, no annotations, no metadata

| Implementation        | avg/iter |
| --------------------- | -------: |
| `pdf-lib (load+save)` | 188.9 µs |
| `clean (no-strip)`    | 187.6 µs |
| `clean (default)`     | 163.5 µs |

### `metadata-only` — 1 page, full Info dict

| Implementation        | avg/iter |
| --------------------- | -------: |
| `pdf-lib (load+save)` | 183.7 µs |
| `clean (no-strip)`    | 185.3 µs |
| `clean (default)`     | 198.9 µs |

### `links-50` — 1 page, 50 `/Link` annotations

| Implementation        | avg/iter |
| --------------------- | -------: |
| `pdf-lib (load+save)` | 624.2 µs |
| `clean (no-strip)`    | 612.4 µs |
| `clean (default)`     | 448.2 µs |

### `mixed-medium` — 10 pages, 5 links each, full Info dict

| Implementation        | avg/iter |
| --------------------- | -------: |
| `pdf-lib (load+save)` | 820.3 µs |
| `clean (no-strip)`    | 778.9 µs |
| `clean (default)`     | 645.0 µs |

### `large-100pages` — 100 pages, 10 links each, full Info dict

| Implementation        | avg/iter |
| --------------------- | -------: |
| `pdf-lib (load+save)` | 19.63 ms |
| `clean (no-strip)`    | 19.88 ms |
| `clean (default)`     | 17.73 ms |

## Bundle size

The library entry re-exports from a shared chunk that holds pdf-lib import + `clean` body. The CLI entry holds argv parsing + I/O on top of the same chunk. pdf-lib itself is a runtime dependency and is not bundled.

| Artifact                  | Raw    | Gzip   |
| ------------------------- | -----: | -----: |
| `dist/index.mjs`          |  98 B  |  92 B  |
| `dist/index.cjs`          | 212 B  | 164 B  |
| `dist/cli.mjs`            | 5.84 kB | 2.07 kB |
| `dist/cli.cjs`            | 7.28 kB | 2.54 kB |
| shared `clean-*.mjs`      | 2.34 kB | 0.87 kB |
| shared `clean-*.cjs`      | 2.58 kB | 0.93 kB |

Effective consumer sizes:

| Surface              | ESM raw + gzip      | CJS raw + gzip      |
| -------------------- | ------------------- | ------------------- |
| Library (`index` + shared) | 2.44 kB / 0.96 kB | 2.79 kB / 1.09 kB |
| CLI (`cli` + shared)       | 8.18 kB / 2.94 kB | 9.85 kB / 3.47 kB |

## Why `clean (default)` can be faster than `pdf-lib (load+save)`

Stripping `/Link` annotations and the Info dict produces a smaller PDF body. The save phase serializes fewer objects, so the saved bytes are smaller and the write step shorter. The `links-50` and `mixed-medium` buckets show this clearly — the strip work pays for itself by shrinking what `save()` has to emit. On inputs that have nothing to strip (`small-1page`) or a single Info dict (`metadata-only`), the cost difference is within noise.

## Going-forward regression budget

**No regression > 10 % on any bucket at fixed feature set.** pdf-lib's parser/serializer has more inline-cache volatility than tight per-element loops, and the dominant cost on every bucket lives in pdf-lib rather than in our strip code. The loose bar absorbs that without flapping CI. Feature additions that legitimately cost time (new annotation subtypes, larger metadata scope) reset the bar for the buckets they affect.
