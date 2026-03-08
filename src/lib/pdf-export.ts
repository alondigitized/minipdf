import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Annotation, TextEdit } from "@/hooks/usePDFEditor";

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
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
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  // Apply text edits: white-out original text area, draw new text
  if (textEdits && textEdits.size > 0) {
    for (const [, edit] of Array.from(textEdits.entries())) {
      const page = pages[edit.pageNum - 1];
      if (!page) continue;

      const padding = 2;
      // White-out the original text area
      page.drawRectangle({
        x: edit.pdfX - padding,
        y: edit.pdfY - padding,
        width: edit.pdfWidth + padding * 2,
        height: edit.pdfHeight + padding * 2,
        color: rgb(1, 1, 1),
      });

      // Draw the replacement text
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
      // Convert canvas coords to PDF coords (PDF origin is bottom-left)
      const sx = pageWidth / (pageWidth * scale);
      const sy = pageHeight / (pageHeight * scale);

      if (ann.type === "text") {
        const fontSize = (ann.fontSize || 16) / scale;
        const x = ann.x / scale;
        const y = pageHeight - ann.y / scale - fontSize;
        page.drawText(ann.text || "", {
          x,
          y,
          size: fontSize,
          font,
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
        // Draw freehand paths as series of small lines
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
          const header = parts[0]; // e.g. "data:image/png;base64"
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
