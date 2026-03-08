"use client";

import { useState, useCallback } from "react";
import UploadZone from "@/components/UploadZone";
import PDFEditor from "@/components/PDFEditor";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const PDF_MAGIC_BYTES = [0x25, 0x50, 0x44, 0x46]; // %PDF

function isPdfMagicBytes(buffer: ArrayBuffer): boolean {
  const view = new Uint8Array(buffer, 0, 4);
  return PDF_MAGIC_BYTES.every((b, i) => view[i] === b);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\- ]/g, "_").slice(0, 200);
}

export default function Home() {
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState("");

  const handleFile = useCallback((file: File) => {
    if (file.type !== "application/pdf") {
      alert("Please upload a valid PDF file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      alert("File size must be under 50 MB.");
      return;
    }
    setFileName(sanitizeFilename(file.name));
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        if (!isPdfMagicBytes(e.target.result)) {
          alert("Invalid PDF file. The file content does not match PDF format.");
          return;
        }
        // Copy the buffer so pdfjs worker transfer can't detach it
        setPdfData(e.target.result.slice(0));
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleReset = useCallback(() => {
    setPdfData(null);
    setFileName("");
  }, []);

  return (
    <main className="h-screen flex flex-col">
      {!pdfData ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <UploadZone onFile={handleFile} />
        </div>
      ) : (
        <PDFEditor
          pdfData={pdfData}
          fileName={fileName}
          onReset={handleReset}
        />
      )}
    </main>
  );
}
