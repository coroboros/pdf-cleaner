/**
 * Micro-benchmark for pdf-cleaner over 5 fixture buckets.
 *
 * Usage (from the package root):
 *   pnpm build && node bench/pdf-cleaner.bench.mjs
 *
 * Each bucket runs three cases that decompose where the time goes:
 *   - `pdf-lib (load+save)` — raw round-trip floor (no clean wrapper)
 *   - `clean (no-strip)`    — clean() with keepLinks + keepMetadata true
 *                              shows clean's overhead with no strip work
 *   - `clean (default)`     — full strip (links + metadata)
 *
 * (clean default) − (clean no-strip) is the cost of the strip work.
 * (clean no-strip) − (pdf-lib load+save) is the wrapper overhead.
 */

import { bench, group, run } from 'mitata';
import { PDFArray, PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib';
import { clean } from '../dist/index.mjs';

const DEFAULT_METADATA = {
  title: 'Bench Title',
  author: 'Bench Author',
  subject: 'Bench Subject',
  keywords: ['k1', 'k2', 'k3'],
  creator: 'Bench Creator',
  producer: 'Bench Producer',
};

const appendAnnotation = (page, annotDict) => {
  const ctx = page.doc.context;
  const annotsRef = page.node.get(PDFName.Annots);
  if (annotsRef === undefined) {
    page.node.set(PDFName.Annots, ctx.obj([annotDict]));
    return;
  }
  const annots = ctx.lookupMaybe(annotsRef, PDFArray);
  if (annots === undefined) {
    page.node.set(PDFName.Annots, ctx.obj([annotDict]));
    return;
  }
  annots.push(annotDict);
};

const linkAnnot = (doc, uri) =>
  doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [50, 500, 200, 520],
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(uri) },
  });

const buildPdf = async ({ pages, linksPerPage = 0, metadata = false }) => {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const font = doc.embedStandardFont(StandardFonts.Helvetica);
  const pageObjs = [];
  for (let i = 0; i < pages; i += 1) {
    const p = doc.addPage([400, 600]);
    p.drawText(`Page ${i + 1}`, { x: 50, y: 550, size: 14, font });
    pageObjs.push(p);
  }
  if (metadata) {
    doc.setTitle(DEFAULT_METADATA.title);
    doc.setAuthor(DEFAULT_METADATA.author);
    doc.setSubject(DEFAULT_METADATA.subject);
    doc.setKeywords(DEFAULT_METADATA.keywords);
    doc.setCreator(DEFAULT_METADATA.creator);
    doc.setProducer(DEFAULT_METADATA.producer);
  }
  for (const page of pageObjs) {
    for (let i = 0; i < linksPerPage; i += 1) {
      appendAnnotation(page, linkAnnot(doc, `https://example.test/${i}`));
    }
  }
  return doc.save();
};

const FIXTURES = {
  'small-1page': await buildPdf({ pages: 1 }),
  'metadata-only': await buildPdf({ pages: 1, metadata: true }),
  'links-50': await buildPdf({ pages: 1, linksPerPage: 50 }),
  'mixed-medium': await buildPdf({ pages: 10, linksPerPage: 5, metadata: true }),
  'large-100pages': await buildPdf({ pages: 100, linksPerPage: 10, metadata: true }),
};

const KEEP_BOTH = { keepLinks: true, keepMetadata: true };

const rawRoundTrip = async (bytes) => {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  return doc.save();
};

for (const [label, bytes] of Object.entries(FIXTURES)) {
  group(label, () => {
    bench('pdf-lib (load+save)', () => rawRoundTrip(bytes));
    bench('clean (no-strip)', () => clean(bytes, KEEP_BOTH));
    bench('clean (default)', () => clean(bytes));
  });
}

await run({ colors: true });
