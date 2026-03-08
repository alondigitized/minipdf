"use client";

import { useState, useCallback } from "react";
import UploadZone from "@/components/UploadZone";
import PDFEditor from "@/components/PDFEditor";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

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
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        setPdfData(e.target.result);
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
