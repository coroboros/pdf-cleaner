import { Buffer } from 'node:buffer';
import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { CleanError, type CleanOptions, clean } from '../src/index.js';
import { buildPdf } from './fixtures.js';

type Inspection = {
  title: string | undefined;
  author: string | undefined;
  subject: string | undefined;
  keywords: string | undefined;
  creator: string | undefined;
  producer: string | undefined;
  hasMetadataStream: boolean;
  pageCount: number;
  linkAnnotsPerPage: number[];
  otherAnnotsPerPage: number[];
};

const inspect = async (bytes: Uint8Array): Promise<Inspection> => {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages = doc.getPages();
  const linkAnnotsPerPage: number[] = [];
  const otherAnnotsPerPage: number[] = [];
  const LINK = PDFName.of('Link');
  const SUBTYPE = PDFName.of('Subtype');

  for (const page of pages) {
    const annotsRef = page.node.get(PDFName.Annots);
    if (annotsRef === undefined) {
      linkAnnotsPerPage.push(0);
      otherAnnotsPerPage.push(0);
      continue;
    }
    const annots = doc.context.lookupMaybe(annotsRef, PDFArray);
    if (annots === undefined) {
      linkAnnotsPerPage.push(0);
      otherAnnotsPerPage.push(0);
      continue;
    }
    let links = 0;
    let others = 0;
    for (let i = 0; i < annots.size(); i += 1) {
      const entry = annots.lookupMaybe(i, PDFDict);
      if (entry === undefined) continue;
      const subtype = entry.lookupMaybe(SUBTYPE, PDFName);
      if (subtype === LINK) links += 1;
      else others += 1;
    }
    linkAnnotsPerPage.push(links);
    otherAnnotsPerPage.push(others);
  }

  return {
    title: doc.getTitle(),
    author: doc.getAuthor(),
    subject: doc.getSubject(),
    keywords: doc.getKeywords(),
    creator: doc.getCreator(),
    producer: doc.getProducer(),
    hasMetadataStream: doc.catalog.get(PDFName.of('Metadata')) !== undefined,
    pageCount: pages.length,
    linkAnnotsPerPage,
    otherAnnotsPerPage,
  };
};

describe('clean()', () => {
  describe('default behavior', () => {
    it('strips all /Link annotations across pages', async () => {
      const source = await buildPdf({
        pages: 2,
        links: [
          { uri: 'https://example.com/a', page: 0 },
          { uri: 'https://example.com/b', page: 0 },
          { uri: 'https://example.com/c', page: 1 },
        ],
      });
      const before = await inspect(source);
      expect(before.linkAnnotsPerPage).toEqual([2, 1]);

      const cleaned = await clean(source);
      const after = await inspect(cleaned);
      expect(after.linkAnnotsPerPage).toEqual([0, 0]);
    });

    it('wipes Info dict fields', async () => {
      const source = await buildPdf({
        metadata: {
          title: 'My Document',
          author: 'Alice',
          subject: 'Subject',
          keywords: ['k1', 'k2'],
          creator: 'Pages',
          producer: 'MacOS',
        },
      });
      const before = await inspect(source);
      expect(before.title).toBe('My Document');
      expect(before.author).toBe('Alice');

      const cleaned = await clean(source);
      const after = await inspect(cleaned);
      expect(after.title).toBeUndefined();
      expect(after.author).toBeUndefined();
      expect(after.subject).toBeUndefined();
      expect(after.keywords).toBeUndefined();
      expect(after.creator).toBeUndefined();
      expect(after.producer).toBeUndefined();
    });

    it('preserves non-link annotations', async () => {
      const source = await buildPdf({
        links: [{ uri: 'https://example.com' }],
        textAnnots: [{ contents: 'Sticky note' }],
      });
      const before = await inspect(source);
      expect(before.linkAnnotsPerPage[0]).toBe(1);
      expect(before.otherAnnotsPerPage[0]).toBe(1);

      const cleaned = await clean(source);
      const after = await inspect(cleaned);
      expect(after.linkAnnotsPerPage[0]).toBe(0);
      expect(after.otherAnnotsPerPage[0]).toBe(1);
    });

    it('preserves page count', async () => {
      const source = await buildPdf({ pages: 3 });
      const cleaned = await clean(source);
      const after = await inspect(cleaned);
      expect(after.pageCount).toBe(3);
    });

    it('returns a Uint8Array', async () => {
      const source = await buildPdf();
      const result = await clean(source);
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBeGreaterThan(0);
    });

    it('produces a re-loadable PDF', async () => {
      const source = await buildPdf({ pages: 2, metadata: { title: 'T' } });
      const cleaned = await clean(source);
      await expect(PDFDocument.load(cleaned)).resolves.toBeDefined();
    });
  });

  describe('keepLinks option', () => {
    it('preserves links when true', async () => {
      const source = await buildPdf({
        links: [{ uri: 'https://example.com/a' }, { uri: 'https://example.com/b' }],
      });
      const cleaned = await clean(source, { keepLinks: true });
      const after = await inspect(cleaned);
      expect(after.linkAnnotsPerPage[0]).toBe(2);
    });

    it('still wipes metadata', async () => {
      const source = await buildPdf({
        metadata: { title: 'Keep links not meta' },
        links: [{ uri: 'https://example.com' }],
      });
      const cleaned = await clean(source, { keepLinks: true });
      const after = await inspect(cleaned);
      expect(after.title).toBeUndefined();
      expect(after.linkAnnotsPerPage[0]).toBe(1);
    });
  });

  describe('keepMetadata option', () => {
    it('preserves metadata when true', async () => {
      const source = await buildPdf({
        metadata: { title: 'Kept', author: 'Bob' },
      });
      const cleaned = await clean(source, { keepMetadata: true });
      const after = await inspect(cleaned);
      expect(after.title).toBe('Kept');
      expect(after.author).toBe('Bob');
    });

    it('still strips links', async () => {
      const source = await buildPdf({
        metadata: { title: 'Kept' },
        links: [{ uri: 'https://example.com' }],
      });
      const cleaned = await clean(source, { keepMetadata: true });
      const after = await inspect(cleaned);
      expect(after.title).toBe('Kept');
      expect(after.linkAnnotsPerPage[0]).toBe(0);
    });
  });

  describe('both options', () => {
    it('preserves both when both true', async () => {
      const source = await buildPdf({
        metadata: { title: 'All kept' },
        links: [{ uri: 'https://example.com' }],
      });
      const cleaned = await clean(source, { keepLinks: true, keepMetadata: true });
      const after = await inspect(cleaned);
      expect(after.title).toBe('All kept');
      expect(after.linkAnnotsPerPage[0]).toBe(1);
    });
  });

  describe('input shapes', () => {
    it('accepts Uint8Array', async () => {
      const source = await buildPdf();
      const result = await clean(new Uint8Array(source));
      expect(result.byteLength).toBeGreaterThan(0);
    });

    it('accepts ArrayBuffer', async () => {
      const source = await buildPdf();
      const ab = new ArrayBuffer(source.byteLength);
      new Uint8Array(ab).set(source);
      const result = await clean(ab);
      expect(result.byteLength).toBeGreaterThan(0);
    });

    it('accepts Node Buffer', async () => {
      const source = await buildPdf();
      const buf = Buffer.from(source);
      const result = await clean(buf as unknown as Uint8Array);
      expect(result.byteLength).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('throws CleanError INVALID_INPUT for non-bytes input', async () => {
      await expect(clean('not bytes' as unknown as Uint8Array)).rejects.toMatchObject({
        name: 'CleanError',
        code: 'INVALID_INPUT',
      });
    });

    it('throws CleanError INVALID_INPUT for null input', async () => {
      await expect(clean(null as unknown as Uint8Array)).rejects.toBeInstanceOf(CleanError);
    });

    it('throws CleanError INVALID_INPUT for empty bytes', async () => {
      await expect(clean(new Uint8Array(0))).rejects.toMatchObject({
        name: 'CleanError',
        code: 'INVALID_INPUT',
      });
    });

    it('throws CleanError PARSE_FAILED for non-PDF bytes', async () => {
      const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      await expect(clean(garbage)).rejects.toMatchObject({
        name: 'CleanError',
        code: 'PARSE_FAILED',
      });
    });

    it('exposes the underlying error via cause on PARSE_FAILED', async () => {
      const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      try {
        await clean(garbage);
        expect.fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(CleanError);
        expect((err as CleanError).code).toBe('PARSE_FAILED');
        expect((err as CleanError).cause).toBeDefined();
      }
    });

    it('throws CleanError ENCRYPTED for encrypted PDFs', async () => {
      const encrypted = await buildPdf({ encrypted: true });
      await expect(clean(encrypted)).rejects.toMatchObject({
        name: 'CleanError',
        code: 'ENCRYPTED',
      });
    });

    it('throws CleanError ABORTED when the signal is already aborted', async () => {
      const source = await buildPdf();
      const controller = new AbortController();
      controller.abort();
      await expect(clean(source, { signal: controller.signal })).rejects.toMatchObject({
        name: 'CleanError',
        code: 'ABORTED',
      });
    });

    it('preserves signal.reason on the ABORTED cause', async () => {
      const source = await buildPdf();
      const controller = new AbortController();
      const reason = new Error('caller cancelled');
      controller.abort(reason);
      try {
        await clean(source, { signal: controller.signal });
        expect.fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(CleanError);
        expect((err as CleanError).code).toBe('ABORTED');
        expect((err as CleanError).cause).toBe(reason);
      }
    });

    it('throws CleanError ABORTED when the signal fires after load', async () => {
      const source = await buildPdf();
      const controller = new AbortController();
      const reason = new Error('after-load cancel');
      queueMicrotask(() => controller.abort(reason));
      try {
        await clean(source, { signal: controller.signal });
        expect.fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(CleanError);
        expect((err as CleanError).code).toBe('ABORTED');
        expect((err as CleanError).cause).toBe(reason);
      }
    });

    it('throws CleanError ABORTED when the signal fires after the strip phase', async () => {
      const source = await buildPdf({
        metadata: { title: 'T' },
        links: [{ uri: 'https://example.com' }],
      });
      const controller = new AbortController();
      const reason = new Error('after-strip cancel');
      queueMicrotask(() => queueMicrotask(() => controller.abort(reason)));
      try {
        await clean(source, { signal: controller.signal });
        expect.fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(CleanError);
        expect((err as CleanError).code).toBe('ABORTED');
        expect((err as CleanError).cause).toBe(reason);
      }
    });
  });

  describe('idempotency', () => {
    it('cleaning a cleaned PDF is a no-op for the surface checked', async () => {
      const source = await buildPdf({
        links: [{ uri: 'https://example.com' }],
        metadata: { title: 'T' },
      });
      const once = await clean(source);
      const twice = await clean(once);
      const inspectionOnce = await inspect(once);
      const inspectionTwice = await inspect(twice);
      expect(inspectionTwice.title).toBe(inspectionOnce.title);
      expect(inspectionTwice.linkAnnotsPerPage).toEqual(inspectionOnce.linkAnnotsPerPage);
      expect(inspectionTwice.pageCount).toBe(inspectionOnce.pageCount);
    });
  });

  describe('options shape', () => {
    it('accepts an empty options object', async () => {
      const source = await buildPdf({ metadata: { title: 'T' } });
      const cleaned = await clean(source, {} satisfies CleanOptions);
      const after = await inspect(cleaned);
      expect(after.title).toBeUndefined();
    });
  });
});
