import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Annotation, TextEdit } from "@/hooks/usePDFEditor";

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

type FontVariant = "regular" | "bold" | "italic" | "bolditalic";

async function loadLiberationSans(): Promise<Record<FontVariant, ArrayBuffer>> {
  const variants: Record<FontVariant, string> = {
    regular: "/standard_fonts/LiberationSans-Regular.ttf",
    bold: "/standard_fonts/LiberationSans-Bold.ttf",
    italic: "/standard_fonts/LiberationSans-Italic.ttf",
    bolditalic: "/standard_fonts/LiberationSans-BoldItalic.ttf",
  };
  const result: Partial<Record<FontVariant, ArrayBuffer>> = {};
  for (const [key, url] of Object.entries(variants)) {
    const resp = await fetch(url);
    result[key as FontVariant] = await resp.arrayBuffer();
  }
  return result as Record<FontVariant, ArrayBuffer>;
}

function pickVariant(isBold: boolean, isItalic: boolean): FontVariant {
  if (isBold && isItalic) return "bolditalic";
  if (isBold) return "bold";
  if (isItalic) return "italic";
  return "regular";
}

export async function exportPDF(
  originalData: ArrayBuffer,
  annotations: Map<number, Annotation[]>,
  scale: number,
  textEdits?: Map<string, TextEdit>
): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.load(new Uint8Array(originalData), {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  pdfDoc.registerFontkit(fontkit);

  const pages = pdfDoc.getPages();

  // Embed Liberation Sans TTF fonts for text edits (metrically identical to Arial)
  const embeddedFonts: Record<FontVariant, PDFFont> = {} as any;
  let fontsLoaded = false;

  async function getEditFont(isBold: boolean, isItalic: boolean): Promise<PDFFont> {
    if (!fontsLoaded) {
      const fontData = await loadLiberationSans();
      embeddedFonts.regular = await pdfDoc.embedFont(fontData.regular);
      embeddedFonts.bold = await pdfDoc.embedFont(fontData.bold);
      embeddedFonts.italic = await pdfDoc.embedFont(fontData.italic);
      embeddedFonts.bolditalic = await pdfDoc.embedFont(fontData.bolditalic);
      fontsLoaded = true;
    }
    return embeddedFonts[pickVariant(isBold, isItalic)];
  }

  // For annotations (add text), use standard Helvetica
  const defaultFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Apply text edits with proper font matching
  if (textEdits && textEdits.size > 0) {
    for (const [, edit] of Array.from(textEdits.entries())) {
      const page = pages[edit.pageNum - 1];
      if (!page) continue;

      const font = await getEditFont(edit.isBold, edit.isItalic);

      const padding = 2;
      // White-out the original text area
      page.drawRectangle({
        x: edit.pdfX - padding,
        y: edit.pdfY - padding,
        width: edit.pdfWidth + padding * 2,
        height: edit.pdfHeight + padding * 2,
        color: rgb(1, 1, 1),
      });

      // Draw the replacement text with matched font variant
      page.drawText(edit.newText, {
        x: edit.pdfX,
        y: edit.pdfY,
        size: edit.fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
  }

  for (const [pageNum, pageAnnotations] of Array.from(annotations.entries())) {
    const page = pages[pageNum - 1];
    if (!page) continue;

    const { width: pageWidth, height: pageHeight } = page.getSize();

    for (const ann of pageAnnotations) {
      if (ann.type === "text") {
        const fontSize = (ann.fontSize || 16) / scale;
        const x = ann.x / scale;
        const y = pageHeight - ann.y / scale - fontSize;
        page.drawText(ann.text || "", {
          x,
          y,
          size: fontSize,
          font: defaultFont,
          color: hexToRgb(ann.color),
        });
      } else if (ann.type === "highlight") {
        const x = ann.x / scale;
        const y = pageHeight - ann.y / scale - ann.height! / scale;
        page.drawRectangle({
          x,
          y,
          width: ann.width! / scale,
          height: ann.height! / scale,
          color: hexToRgb(ann.color),
          opacity: 0.3,
        });
      } else if (ann.type === "rectangle") {
        const x = ann.x / scale;
        const y = pageHeight - ann.y / scale - ann.height! / scale;
        page.drawRectangle({
          x,
          y,
          width: ann.width! / scale,
          height: ann.height! / scale,
          borderColor: hexToRgb(ann.color),
          borderWidth: (ann.strokeWidth || 2) / scale,
        });
      } else if (ann.type === "draw" && ann.points && ann.points.length > 1) {
        for (let i = 1; i < ann.points.length; i++) {
          const p0 = ann.points[i - 1];
          const p1 = ann.points[i];
          page.drawLine({
            start: {
              x: p0.x / scale,
              y: pageHeight - p0.y / scale,
            },
            end: {
              x: p1.x / scale,
              y: pageHeight - p1.y / scale,
            },
            thickness: (ann.strokeWidth || 2) / scale,
            color: hexToRgb(ann.color),
          });
        }
      } else if (ann.type === "image" && ann.imageData) {
        try {
          const parts = ann.imageData.split(",");
          if (parts.length !== 2) continue;
          const header = parts[0];
          const base64 = parts[1];
          if (!base64 || !/^[A-Za-z0-9+/=]+$/.test(base64)) continue;

          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          const isPng = /^data:image\/png/i.test(header);
          const image = isPng
            ? await pdfDoc.embedPng(bytes)
            : await pdfDoc.embedJpg(bytes);

          const x = ann.x / scale;
          const w = ann.width! / scale;
          const h = ann.height! / scale;
          const y = pageHeight - ann.y / scale - h;
          page.drawImage(image, { x, y, width: w, height: h });
        } catch {
          // Skip invalid images
        }
      }
    }
  }

  const saved = await pdfDoc.save();
  return saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer;
}
