import { existsSync } from 'node:fs';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { type ParseArgsConfig, parseArgs } from 'node:util';

import pkg from '../package.json' with { type: 'json' };
import { type CleanOptions, clean } from './clean.js';
import { CleanError } from './error.js';

const VERSION = (pkg as { version: string }).version;

export const HELP = `Usage: pdf-cleaner <input> [options]

Strip metadata and links from PDFs locally. No upload, no tracking.

Arguments:
  <input>             Path to a .pdf file, or a directory of .pdf files
                      (top-level only, non-recursive)

Options:
  --out <dir>         Output directory (default: alongside input)
  --in-place          Overwrite input file(s) — confirms in TTY, requires --yes otherwise
  --keep-links        Preserve /Link annotations (default: strip)
  --keep-metadata     Preserve Info dict and XMP metadata (default: wipe)
  --yes, -y           Skip confirmation prompts
  --help, -h          Show this help
  --version, -v       Show version

Exit codes:
  0  success
  1  user error (bad path, unknown flag)
  2  per-file cleaning error
  3  unexpected

Examples:
  pdf-cleaner cv.pdf
  pdf-cleaner ./input --out ./output
  pdf-cleaner cv.pdf --in-place --yes
  pdf-cleaner ./pdfs --keep-links`;

const PARSE_CONFIG = {
  allowPositionals: true,
  strict: true,
  options: {
    out: { type: 'string' },
    'in-place': { type: 'boolean' },
    'keep-links': { type: 'boolean' },
    'keep-metadata': { type: 'boolean' },
    yes: { type: 'boolean', short: 'y' },
    help: { type: 'boolean', short: 'h' },
    version: { type: 'boolean', short: 'v' },
  },
} as const satisfies ParseArgsConfig;

const isPdfPath = (p: string): boolean => extname(p).toLowerCase() === '.pdf';

const buildOutputPath = (
  inputPath: string,
  outDir: string | undefined,
  inPlace: boolean,
): string => {
  if (inPlace) {
    return inputPath;
  }
  const base = basename(inputPath, extname(inputPath));
  const dir = outDir ?? dirname(inputPath);
  return join(dir, `${base}_clean.pdf`);
};

const cleanOne = async (
  inputPath: string,
  outputPath: string,
  options: CleanOptions,
): Promise<void> => {
  const bytes = await readFile(inputPath);
  const cleaned = await clean(bytes, options);
  await writeFile(outputPath, cleaned);
};

const confirm = async (question: string): Promise<boolean> => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
};

const formatError = (label: string, err: unknown): string => {
  if (err instanceof CleanError) {
    return `pdf-cleaner: ${err.code}: ${label}${err.message}`;
  }
  const message = err instanceof Error ? err.message : String(err);
  return `pdf-cleaner: UNEXPECTED: ${label}${message}`;
};

const exitCodeFor = (err: unknown): number => (err instanceof CleanError ? 2 : 3);

export const runCli = async (argv: string[] = process.argv.slice(2)): Promise<number> => {
  let parsed: ReturnType<typeof parseArgs<typeof PARSE_CONFIG>>;
  try {
    parsed = parseArgs({ ...PARSE_CONFIG, args: argv });
  } catch (err) {
    console.error(`pdf-cleaner: ${err instanceof Error ? err.message : String(err)}`);
    console.error(HELP);
    return 1;
  }

  const { values, positionals } = parsed;

  if (values.help === true) {
    console.log(HELP);
    return 0;
  }
  if (values.version === true) {
    console.log(VERSION);
    return 0;
  }
  if (positionals.length === 0) {
    console.error('pdf-cleaner: missing <input> argument');
    console.error(HELP);
    return 1;
  }
  if (positionals.length > 1) {
    console.error(`pdf-cleaner: too many positional arguments (got ${positionals.length})`);
    return 1;
  }

  const inputPathRaw = positionals[0] as string;
  const inputPath = resolve(inputPathRaw);

  if (!existsSync(inputPath)) {
    console.error(`pdf-cleaner: path not found: ${inputPathRaw}`);
    return 1;
  }

  const inputStat = await stat(inputPath);
  const outDir = typeof values.out === 'string' ? resolve(values.out) : undefined;
  const inPlace = values['in-place'] === true;
  const skipConfirm = values.yes === true;
  const options: CleanOptions = {
    keepLinks: values['keep-links'] === true,
    keepMetadata: values['keep-metadata'] === true,
  };

  if (inPlace) {
    const isTTY = process.stdin.isTTY === true;
    if (!isTTY && !skipConfirm) {
      console.error('pdf-cleaner: --in-place requires --yes when stdin is not a TTY');
      return 1;
    }
    if (isTTY && !skipConfirm) {
      const target = inputStat.isDirectory() ? `all .pdf files in ${inputPathRaw}` : inputPathRaw;
      const ok = await confirm(`Overwrite ${target}?`);
      if (!ok) {
        console.error('pdf-cleaner: aborted');
        return 1;
      }
    }
  }

  if (inputStat.isFile()) {
    if (!isPdfPath(inputPath)) {
      console.error(`pdf-cleaner: not a .pdf file: ${inputPathRaw}`);
      return 1;
    }
    const outputPath = buildOutputPath(inputPath, outDir, inPlace);
    try {
      await cleanOne(inputPath, outputPath, options);
      console.log(`cleaned: ${outputPath}`);
      return 0;
    } catch (err) {
      console.error(formatError('', err));
      return exitCodeFor(err);
    }
  }

  if (inputStat.isDirectory()) {
    const entries = await readdir(inputPath);
    const pdfs = entries.filter(isPdfPath).sort();
    if (pdfs.length === 0) {
      console.error(`pdf-cleaner: no .pdf files in ${inputPathRaw}`);
      return 0;
    }

    let failures = 0;
    for (const name of pdfs) {
      const filePath = join(inputPath, name);
      const outputPath = buildOutputPath(filePath, outDir, inPlace);
      try {
        await cleanOne(filePath, outputPath, options);
        console.log(`cleaned: ${outputPath}`);
      } catch (err) {
        failures += 1;
        console.error(formatError(`${name}: `, err));
      }
    }
    return failures === 0 ? 0 : 2;
  }

  console.error(`pdf-cleaner: not a file or directory: ${inputPathRaw}`);
  return 1;
};
