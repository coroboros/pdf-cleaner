import {
  PDFArray,
  type PDFDict,
  PDFDocument,
  PDFName,
  type PDFPage,
  PDFString,
  StandardFonts,
} from 'pdf-lib';

export type MetadataFields = {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
};

const DEFAULT_METADATA: Required<MetadataFields> = {
  title: 'Test Title',
  author: 'Test Author',
  subject: 'Test Subject',
  keywords: ['test', 'pdf', 'cleaner'],
  creator: 'Test Creator',
  producer: 'Test Producer',
};

const applyMetadata = (doc: PDFDocument, fields: MetadataFields): void => {
  const m = { ...DEFAULT_METADATA, ...fields };
  doc.setTitle(m.title);
  doc.setAuthor(m.author);
  doc.setSubject(m.subject);
  doc.setKeywords(m.keywords);
  doc.setCreator(m.creator);
  doc.setProducer(m.producer);
};

const appendAnnotation = (doc: PDFDocument, page: PDFPage, annotDict: PDFDict): void => {
  const ctx = doc.context;
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

const buildLinkAnnotation = (
  doc: PDFDocument,
  uri: string,
  rect: [number, number, number, number],
): PDFDict =>
  doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: rect,
    Border: [0, 0, 0],
    A: {
      Type: 'Action',
      S: 'URI',
      URI: PDFString.of(uri),
    },
  });

const buildTextAnnotation = (
  doc: PDFDocument,
  contents: string,
  rect: [number, number, number, number],
): PDFDict =>
  doc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: rect,
    Contents: PDFString.of(contents),
  });

export type FixtureOptions = {
  pages?: number;
  metadata?: MetadataFields | false;
  links?: Array<{ uri: string; page?: number }>;
  textAnnots?: Array<{ contents: string; page?: number }>;
  encrypted?: boolean;
};

export const buildPdf = async (options: FixtureOptions = {}): Promise<Uint8Array> => {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const font = doc.embedStandardFont(StandardFonts.Helvetica);

  const pageCount = options.pages ?? 1;
  const pages: PDFPage[] = [];
  for (let i = 0; i < pageCount; i += 1) {
    const page = doc.addPage([400, 600]);
    page.drawText(`Page ${i + 1}`, { x: 50, y: 550, size: 14, font });
    pages.push(page);
  }

  if (options.metadata !== false) {
    applyMetadata(doc, options.metadata ?? {});
  }

  for (const link of options.links ?? []) {
    const target = pages[link.page ?? 0];
    if (target !== undefined) {
      appendAnnotation(doc, target, buildLinkAnnotation(doc, link.uri, [50, 500, 200, 520]));
    }
  }

  for (const text of options.textAnnots ?? []) {
    const target = pages[text.page ?? 0];
    if (target !== undefined) {
      appendAnnotation(doc, target, buildTextAnnotation(doc, text.contents, [50, 450, 70, 470]));
    }
  }

  if (options.encrypted === true) {
    // Inject a stub /Encrypt entry into the trailer. pdf-lib detects encryption
    // by the presence of trailer /Encrypt — the contents do not need to be a
    // valid RC4/AES key, just a resolvable dictionary.
    doc.context.trailerInfo.Encrypt = doc.context.obj({
      Filter: 'Standard',
      V: 1,
      R: 2,
      Length: 40,
      P: -1852,
      O: 'stub-owner-key-32-bytes-padded____',
      U: 'stub-user-key-32-bytes-padded_____',
    });
    return doc.save({ useObjectStreams: false });
  }

  return doc.save();
};
