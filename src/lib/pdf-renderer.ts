import * as pdfjsLib from "pdfjs-dist";

let workerInitialized = false;

function ensureWorker() {
  if (!workerInitialized) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerInitialized = true;
  }
}

export interface ExtractedTextItem {
  id: string;
  str: string;
  // Position in PDF coordinates (bottom-left origin, unscaled)
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  fontSize: number;
  fontFamily: string;
  // Position in canvas coordinates (top-left origin, scaled)
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
}

export async function extractTextItems(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  scale: number
): Promise<{ items: ExtractedTextItem[]; pageHeight: number }> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();
  const items: ExtractedTextItem[] = [];

  let idx = 0;
  for (const item of textContent.items) {
    // Skip non-text items (marked content, etc.)
    if (!("str" in item) || !item.str.trim()) continue;

    const tx = item.transform;
    // transform = [scaleX, skewX, skewY, scaleY, translateX, translateY]
    const fontSize = Math.abs(tx[3]); // scaleY ≈ font size
    const pdfX = tx[4];
    const pdfY = tx[5];
    const pdfWidth = item.width;
    const pdfHeight = fontSize;

    // Convert to canvas coords (top-left origin, apply scale)
    const canvasX = pdfX * scale;
    const canvasY = (viewport.height - pdfY) * scale;
    const canvasWidth = pdfWidth * scale;
    const canvasHeight = fontSize * scale;

    items.push({
      id: `txt_${pageNum}_${idx++}`,
      str: item.str,
      pdfX,
      pdfY,
      pdfWidth,
      pdfHeight,
      fontSize,
      fontFamily: item.fontName || "Helvetica",
      canvasX,
      canvasY,
      canvasWidth,
      canvasHeight,
    });
  }

  return { items, pageHeight: viewport.height };
}

export async function loadPDF(data: ArrayBuffer) {
  ensureWorker();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(data) })
    .promise;
  return pdf;
}

export async function renderPage(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale: number
) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  return { width: viewport.width, height: viewport.height };
}

export async function renderPageThumbnail(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
  maxWidth: number = 120
) {
  const page = await pdf.getPage(pageNum);
  const unscaledViewport = page.getViewport({ scale: 1 });
  const scale = maxWidth / unscaledViewport.width;
  const viewport = page.getViewport({ scale });

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
}
