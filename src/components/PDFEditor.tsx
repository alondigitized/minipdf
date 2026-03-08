"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPDF, renderPage } from "@/lib/pdf-renderer";
import { exportPDF } from "@/lib/pdf-export";
import { usePDFEditor } from "@/hooks/usePDFEditor";
import Toolbar from "./Toolbar";
import PageThumbnails from "./PageThumbnails";
import AnnotationCanvas from "./AnnotationCanvas";

interface PDFEditorProps {
  pdfData: ArrayBuffer;
  fileName: string;
  onReset: () => void;
}

export default function PDFEditor({ pdfData, fileName, onReset }: PDFEditorProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = usePDFEditor();

  // Load PDF
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const doc = await loadPDF(pdfData);
        if (!cancelled) {
          setPdf(doc);
          editor.setTotalPages(doc.numPages);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load PDF:", err);
        alert("Failed to load PDF. The file may be corrupted or encrypted.");
        onReset();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfData]);

  // Render current page
  useEffect(() => {
    if (!pdf || !pdfCanvasRef.current) return;
    let cancelled = false;
    (async () => {
      const size = await renderPage(
        pdf,
        editor.currentPage,
        pdfCanvasRef.current!,
        editor.scale
      );
      if (!cancelled) {
        setPageSize(size);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, editor.currentPage, editor.scale]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        editor.undo();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (
          editor.selectedId &&
          document.activeElement?.tagName !== "TEXTAREA" &&
          document.activeElement?.tagName !== "INPUT"
        ) {
          editor.deleteAnnotation(editor.currentPage, editor.selectedId);
        }
      }
      if (e.key === "Escape") {
        editor.setSelectedId(null);
        editor.setTool("select");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor]);

  const handleExport = useCallback(async () => {
    if (!pdf) return;
    setExporting(true);
    try {
      const bytes = await exportPDF(pdfData, editor.annotations, editor.scale);
      const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName.replace(/\.pdf$/i, "") + "_edited.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [pdf, pdfData, editor.annotations, editor.scale, fileName]);

  const handleImageUpload = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleImageFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        alert("Please select an image file.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert("Image must be under 5 MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const img = new Image();
        img.onload = () => {
          // Scale image to fit within 300px
          const maxDim = 300;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w *= ratio;
            h *= ratio;
          }
          editor.addAnnotation(editor.currentPage, {
            type: "image",
            x: 50,
            y: 50,
            width: w,
            height: h,
            color: "#000000",
            imageData: dataUrl,
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [editor]
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-white/50 flex items-center gap-3">
          <svg
            className="animate-spin h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Loading PDF...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen">
      <Toolbar
        tool={editor.tool}
        setTool={editor.setTool}
        color={editor.color}
        setColor={editor.setColor}
        fontSize={editor.fontSize}
        setFontSize={editor.setFontSize}
        strokeWidth={editor.strokeWidth}
        setStrokeWidth={editor.setStrokeWidth}
        scale={editor.scale}
        setScale={editor.setScale}
        currentPage={editor.currentPage}
        totalPages={editor.totalPages}
        setCurrentPage={editor.setCurrentPage}
        onUndo={editor.undo}
        onExport={handleExport}
        onReset={onReset}
        onImageUpload={handleImageUpload}
      />

      <div className="flex-1 flex overflow-hidden">
        <PageThumbnails
          pdf={pdf}
          totalPages={editor.totalPages}
          currentPage={editor.currentPage}
          onPageSelect={editor.setCurrentPage}
        />

        <div className="flex-1 overflow-auto bg-[#1a1a1a] flex items-start justify-center p-8">
          <div className="pdf-page-container" style={{ width: pageSize.width, height: pageSize.height }}>
            <canvas ref={pdfCanvasRef} style={{ width: pageSize.width, height: pageSize.height }} />
            {pageSize.width > 0 && (
              <AnnotationCanvas
                width={pageSize.width}
                height={pageSize.height}
                tool={editor.tool}
                color={editor.color}
                fontSize={editor.fontSize}
                strokeWidth={editor.strokeWidth}
                annotations={editor.getPageAnnotations(editor.currentPage)}
                selectedId={editor.selectedId}
                onAddAnnotation={(ann) =>
                  editor.addAnnotation(editor.currentPage, ann)
                }
                onUpdateAnnotation={(id, updates) =>
                  editor.updateAnnotation(editor.currentPage, id, updates)
                }
                onDeleteAnnotation={(id) =>
                  editor.deleteAnnotation(editor.currentPage, id)
                }
                onSelect={editor.setSelectedId}
              />
            )}
          </div>
        </div>
      </div>

      {/* Hidden image input */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleImageFile}
      />

      {/* Exporting overlay */}
      {exporting && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#222] rounded-xl p-6 text-center">
            <svg
              className="animate-spin h-8 w-8 mx-auto mb-3 text-blue-400"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <p className="text-white/70">Generating PDF...</p>
          </div>
        </div>
      )}

      {/* Security badge */}
      <div className="absolute bottom-4 right-4 text-[10px] text-white/20 flex items-center gap-1">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
        </svg>
        All processing happens locally in your browser
      </div>
    </div>
  );
}
