import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { CleanError } from './error.js';

export type CleanInput = Uint8Array | ArrayBuffer;

export type CleanOptions = {
  keepLinks?: boolean;
  keepMetadata?: boolean;
  signal?: AbortSignal;
};

const LINK = PDFName.of('Link');
const SUBTYPE = PDFName.of('Subtype');
const METADATA = PDFName.of('Metadata');

const toUint8Array = (input: unknown): Uint8Array => {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  throw new CleanError('INVALID_INPUT', 'input must be a Uint8Array, Buffer, or ArrayBuffer');
};

const stripLinkAnnotations = (doc: PDFDocument): void => {
  for (const page of doc.getPages()) {
    const annotsRef = page.node.get(PDFName.Annots);
    if (annotsRef === undefined) {
      continue;
    }
    const annots = doc.context.lookupMaybe(annotsRef, PDFArray);
    if (annots === undefined) {
      continue;
    }

    for (let i = annots.size() - 1; i >= 0; i -= 1) {
      const entry = annots.lookupMaybe(i, PDFDict);
      if (entry === undefined) {
        continue;
      }
      const subtype = entry.lookupMaybe(SUBTYPE, PDFName);
      if (subtype === LINK) {
        annots.remove(i);
      }
    }

    if (annots.size() === 0) {
      page.node.delete(PDFName.Annots);
    }
  }
};

const stripMetadata = (doc: PDFDocument): void => {
  doc.context.trailerInfo.Info = undefined;
  doc.catalog.delete(METADATA);
};

const throwIfAborted = (signal: AbortSignal | undefined): void => {
  if (signal?.aborted === true) {
    throw new CleanError('ABORTED', 'operation aborted', { cause: signal.reason });
  }
};

export const clean = async (input: CleanInput, options?: CleanOptions): Promise<Uint8Array> => {
  const bytes = toUint8Array(input);
  if (bytes.byteLength === 0) {
    throw new CleanError('INVALID_INPUT', 'input is empty');
  }

  const signal = options?.signal;
  throwIfAborted(signal);

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, {
      updateMetadata: false,
      ignoreEncryption: true,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'failed to parse PDF';
    throw new CleanError('PARSE_FAILED', message, { cause });
  }

  throwIfAborted(signal);

  if (doc.isEncrypted) {
    throw new CleanError(
      'ENCRYPTED',
      'PDF is encrypted; decrypt before cleaning',
    );
  }

  if (options?.keepLinks !== true) {
    stripLinkAnnotations(doc);
  }
  if (options?.keepMetadata !== true) {
    stripMetadata(doc);
  }

  throwIfAborted(signal);

  return doc.save({ useObjectStreams: true });
};
