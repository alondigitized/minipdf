import * as pdfjsLib from "pdfjs-dist";

let workerInitialized = false;

function ensureWorker() {
  if (!workerInitialized) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerInitialized = true;
  }
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
