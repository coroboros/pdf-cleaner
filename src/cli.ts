#!/usr/bin/env node
import process from 'node:process';
import { runCli } from './cli-runner.js';

runCli().then(
  (code) => {
    process.exit(code);
  },
  (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`pdf-cleaner: unexpected error: ${message}`);
    process.exit(3);
  },
);
