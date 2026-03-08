"use client";

import { useEffect, useRef, useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPageThumbnail } from "@/lib/pdf-renderer";

interface PageThumbnailsProps {
  pdf: PDFDocumentProxy | null;
  totalPages: number;
  currentPage: number;
  onPageSelect: (page: number) => void;
}

export default function PageThumbnails({
  pdf,
  totalPages,
  currentPage,
  onPageSelect,
}: PageThumbnailsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderedRef = useRef<Set<number>>(new Set());

  const renderThumbnail = useCallback(
    async (pageNum: number) => {
      if (!pdf || renderedRef.current.has(pageNum)) return;
      const canvas = canvasRefs.current.get(pageNum);
      if (!canvas) return;
      renderedRef.current.add(pageNum);
      try {
        await renderPageThumbnail(pdf, pageNum, canvas, 100);
      } catch {
        renderedRef.current.delete(pageNum);
      }
    },
    [pdf]
  );

  useEffect(() => {
    if (!pdf) return;
    // Render visible thumbnails
    for (let i = 1; i <= totalPages; i++) {
      renderThumbnail(i);
    }
  }, [pdf, totalPages, renderThumbnail]);

  // Scroll active thumbnail into view
  useEffect(() => {
    const activeEl = containerRef.current?.querySelector(".active");
    activeEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentPage]);

  return (
    <div
      ref={containerRef}
      className="w-[120px] bg-[#0d0d0d] border-r border-white/10 overflow-y-auto hide-scrollbar p-2 flex flex-col gap-2"
    >
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
        <button
          key={pageNum}
          className={`thumbnail ${currentPage === pageNum ? "active" : ""}`}
          onClick={() => onPageSelect(pageNum)}
        >
          <canvas
            ref={(el) => {
              if (el) canvasRefs.current.set(pageNum, el);
            }}
            className="w-full rounded"
          />
          <p className="text-[10px] text-white/40 text-center mt-1">
            {pageNum}
          </p>
        </button>
      ))}
    </div>
  );
}
