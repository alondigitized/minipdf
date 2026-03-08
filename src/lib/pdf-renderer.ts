import type * as PdfjsType from "pdfjs-dist";

let pdfjsLib: typeof PdfjsType | null = null;

async function ensureLib(): Promise<typeof PdfjsType> {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjsLib;
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
  fontName: string; // actual PDF font name e.g. "Helvetica-Bold"
  isBold: boolean;
  isItalic: boolean;
  // Position in canvas coordinates (top-left origin, scaled)
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
}

export async function extractTextItems(
  pdf: PdfjsType.PDFDocumentProxy,
  pageNum: number,
  scale: number
): Promise<{ items: ExtractedTextItem[]; pageHeight: number }> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const textContent = await page.getTextContent();

  // Build font metadata from page.commonObjs (has real font name, bold, italic)
  const fontMeta: Record<string, { name: string; bold: boolean; italic: boolean }> = {};
  // Trigger font loading via operatorList so commonObjs are populated
  try {
    await page.getOperatorList();
  } catch {
    // Non-critical
  }
  for (const item of textContent.items) {
    if (!("fontName" in item) || fontMeta[item.fontName]) continue;
    try {
      const obj = (page as any).commonObjs;
      // commonObjs may use _objs map or get() method depending on pdfjs version
      const fontObj = typeof obj.get === "function" ? obj.get(item.fontName) : null;
      if (fontObj && fontObj.name) {
        fontMeta[item.fontName] = {
          name: fontObj.name,
          bold: !!fontObj.bold,
          italic: !!fontObj.italic,
        };
      }
    } catch {
      // Font not available in commonObjs
    }
    // Fallback: detect bold/italic from the internal fontName string
    if (!fontMeta[item.fontName]) {
      const fn = item.fontName || "";
      fontMeta[fn] = {
        name: fn,
        bold: /bold|heavy|black/i.test(fn),
        italic: /italic|oblique/i.test(fn),
      };
    }
  }

  const styles = textContent.styles as Record<
    string,
    { fontFamily: string; ascent?: number; descent?: number }
  >;
  const items: ExtractedTextItem[] = [];

  let idx = 0;
  for (const item of textContent.items) {
    // Skip non-text items (marked content, etc.)
    if (!("str" in item) || !item.str.trim()) continue;

    const tx = item.transform;
    const fontSize = Math.abs(tx[3]);
    const pdfX = tx[4];
    const pdfY = tx[5];
    const pdfWidth = item.width;
    const pdfHeight = fontSize;

    const styleEntry = styles[item.fontName];
    const fontFamily = styleEntry?.fontFamily || "sans-serif";
    const meta = fontMeta[item.fontName];

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
      fontFamily,
      fontName: meta?.name || "Helvetica",
      isBold: meta?.bold || false,
      isItalic: meta?.italic || false,
      canvasX,
      canvasY,
      canvasWidth,
      canvasHeight,
    });
  }

  return { items, pageHeight: viewport.height };
}

export interface FormField {
  id: string;
  fieldName: string;
  fieldType: "text" | "checkbox";
  // Canvas coordinates (top-left origin, scaled)
  canvasX: number;
  canvasY: number;
  canvasWidth: number;
  canvasHeight: number;
  // Current value
  value: string;
  // For checkboxes
  isChecked: boolean;
  exportValue: string; // the "on" value for checkbox
  // Field properties
  readOnly: boolean;
  maxLen: number; // 0 = unlimited
  multiline: boolean;
  pageNum: number;
}

export async function extractFormFields(
  pdf: PdfjsType.PDFDocumentProxy,
  pageNum: number,
  scale: number
): Promise<FormField[]> {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const annotations = await page.getAnnotations({ intent: "display" as any });

  const fields: FormField[] = [];
  let idx = 0;

  for (const ann of annotations) {
    // Only process widget annotations (form fields)
    if (ann.subtype !== "Widget" || !ann.rect) continue;

    const rect = ann.rect; // [x1, y1, x2, y2] in PDF coords
    const canvasX = rect[0] * scale;
    const canvasY = (viewport.height - rect[3]) * scale;
    const canvasWidth = (rect[2] - rect[0]) * scale;
    const canvasHeight = (rect[3] - rect[1]) * scale;

    if (canvasWidth < 1 || canvasHeight < 1) continue;

    const fieldName = ann.fieldName || `field_${pageNum}_${idx}`;

    if (ann.fieldType === "Tx") {
      // Text input field
      fields.push({
        id: `form_${pageNum}_${idx++}`,
        fieldName,
        fieldType: "text",
        canvasX,
        canvasY,
        canvasWidth,
        canvasHeight,
        value: ann.fieldValue || "",
        isChecked: false,
        exportValue: "",
        readOnly: !!ann.readOnly,
        maxLen: ann.maxLen || 0,
        multiline: !!ann.multiLine,
        pageNum,
      });
    } else if (ann.fieldType === "Btn" && ann.checkBox) {
      // Checkbox
      const exportValue = ann.exportValue || "Yes";
      const isChecked = ann.fieldValue === exportValue ||
        ann.fieldValue === "Yes" ||
        ann.fieldValue === "On";
      fields.push({
        id: `form_${pageNum}_${idx++}`,
        fieldName,
        fieldType: "checkbox",
        canvasX,
        canvasY,
        canvasWidth,
        canvasHeight,
        value: ann.fieldValue || "",
        isChecked,
        exportValue,
        readOnly: !!ann.readOnly,
        maxLen: 0,
        multiline: false,
        pageNum,
      });
    }
  }

  return fields;
}

export async function loadPDF(data: ArrayBuffer) {
  const lib = await ensureLib();
  // Copy the data so the worker transfer doesn't detach the original buffer
  const copy = new Uint8Array(data).slice();
  const pdf = await lib.getDocument({
    data: copy,
    standardFontDataUrl: "/standard_fonts/",
  }).promise;
  return pdf;
}

export async function renderPage(
  pdf: PdfjsType.PDFDocumentProxy,
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
  pdf: PdfjsType.PDFDocumentProxy,
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
