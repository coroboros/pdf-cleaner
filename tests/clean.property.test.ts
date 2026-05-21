import fc from 'fast-check';
import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { clean } from '../src/index.js';
import { buildPdf, type MetadataFields } from './fixtures.js';

const SUBTYPE = PDFName.of('Subtype');

type Surface = {
  pageCount: number;
  linksPerPage: number[];
  title: string | undefined;
  author: string | undefined;
};

const surface = async (bytes: Uint8Array): Promise<Surface> => {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages = doc.getPages();
  const linksPerPage: number[] = [];
  for (const page of pages) {
    const annotsRef = page.node.get(PDFName.Annots);
    if (annotsRef === undefined) {
      linksPerPage.push(0);
      continue;
    }
    const annots = doc.context.lookupMaybe(annotsRef, PDFArray);
    if (annots === undefined) {
      linksPerPage.push(0);
      continue;
    }
    let links = 0;
    for (let i = 0; i < annots.size(); i += 1) {
      const entry = annots.lookupMaybe(i, PDFDict);
      if (entry === undefined) continue;
      const subtype = entry.lookupMaybe(SUBTYPE, PDFName);
      if (subtype?.toString() === '/Link') links += 1;
    }
    linksPerPage.push(links);
  }
  return {
    pageCount: pages.length,
    linksPerPage,
    title: doc.getTitle(),
    author: doc.getAuthor(),
  };
};

const metadataArb: fc.Arbitrary<MetadataFields> = fc.record({
  title: fc.string({ minLength: 1, maxLength: 30, unit: 'grapheme' }),
  author: fc.string({ minLength: 1, maxLength: 30, unit: 'grapheme' }),
});

const pdfArb = fc
  .record({
    pages: fc.integer({ min: 1, max: 3 }),
    linksPerPage: fc.array(fc.integer({ min: 0, max: 10 }), { minLength: 1, maxLength: 3 }),
    metadata: metadataArb,
  })
  .map(({ pages, linksPerPage, metadata }) => ({
    pages,
    metadata,
    links: linksPerPage.slice(0, pages).flatMap((count, pageIdx) =>
      Array.from({ length: count }, (_, i) => ({
        uri: `https://example.test/${pageIdx}/${i}`,
        page: pageIdx,
      })),
    ),
  }));

const RUNS = 30;

describe('clean() — property tests', () => {
  it('output is always a parseable PDF', async () => {
    await fc.assert(
      fc.asyncProperty(pdfArb, async (spec) => {
        const source = await buildPdf(spec);
        const cleaned = await clean(source);
        await expect(PDFDocument.load(cleaned)).resolves.toBeDefined();
      }),
      { numRuns: RUNS },
    );
  });

  it('default clean leaves zero /Link annotations on every page', async () => {
    await fc.assert(
      fc.asyncProperty(pdfArb, async (spec) => {
        const source = await buildPdf(spec);
        const cleaned = await clean(source);
        const after = await surface(cleaned);
        expect(after.linksPerPage.every((n) => n === 0)).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });

  it('default clean wipes Info dict metadata', async () => {
    await fc.assert(
      fc.asyncProperty(pdfArb, async (spec) => {
        const source = await buildPdf(spec);
        const cleaned = await clean(source);
        const after = await surface(cleaned);
        expect(after.title).toBeUndefined();
        expect(after.author).toBeUndefined();
      }),
      { numRuns: RUNS },
    );
  });

  it('keepLinks + keepMetadata preserves both surfaces', async () => {
    await fc.assert(
      fc.asyncProperty(pdfArb, async (spec) => {
        const source = await buildPdf(spec);
        const before = await surface(source);
        const cleaned = await clean(source, { keepLinks: true, keepMetadata: true });
        const after = await surface(cleaned);
        expect(after.pageCount).toBe(before.pageCount);
        expect(after.linksPerPage).toEqual(before.linksPerPage);
        expect(after.title).toBe(before.title);
        expect(after.author).toBe(before.author);
      }),
      { numRuns: RUNS },
    );
  });

  it('cleaning is idempotent on the inspectable surface', async () => {
    await fc.assert(
      fc.asyncProperty(pdfArb, async (spec) => {
        const source = await buildPdf(spec);
        const once = await clean(source);
        const twice = await clean(once);
        const a = await surface(once);
        const b = await surface(twice);
        expect(b.pageCount).toBe(a.pageCount);
        expect(b.linksPerPage).toEqual(a.linksPerPage);
        expect(b.title).toBe(a.title);
        expect(b.author).toBe(a.author);
      }),
      { numRuns: RUNS },
    );
  });

  it('cleaned output is smaller than source for fixtures with metadata and links', async () => {
    await fc.assert(
      fc.asyncProperty(pdfArb, async (spec) => {
        fc.pre(spec.links.length > 0);
        const source = await buildPdf(spec);
        const cleaned = await clean(source);
        expect(cleaned.byteLength).toBeLessThan(source.byteLength);
      }),
      { numRuns: RUNS },
    );
  });
});
