"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { extractTextItems, type ExtractedTextItem } from "@/lib/pdf-renderer";
import type { TextEdit } from "@/hooks/usePDFEditor";

interface TextEditLayerProps {
  pdf: PDFDocumentProxy;
  pageNum: number;
  scale: number;
  width: number;
  height: number;
  active: boolean; // true when editText tool is selected
  textEdits: Map<string, TextEdit>;
  onTextEdit: (edit: TextEdit) => void;
}

export default function TextEditLayer({
  pdf,
  pageNum,
  scale,
  width,
  height,
  active,
  textEdits,
  onTextEdit,
}: TextEditLayerProps) {
  const [textItems, setTextItems] = useState<ExtractedTextItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pageHeight, setPageHeight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract text items when page or scale changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await extractTextItems(pdf, pageNum, scale);
        if (!cancelled) {
          setTextItems(result.items);
          setPageHeight(result.pageHeight);
        }
      } catch (err) {
        console.error("Failed to extract text:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNum, scale]);

  // Deselect when tool becomes inactive
  useEffect(() => {
    if (!active) setEditingId(null);
  }, [active]);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleItemClick = useCallback(
    (item: ExtractedTextItem) => {
      if (!active) return;
      setEditingId(item.id);
    },
    [active]
  );

  const handleCommit = useCallback(
    (item: ExtractedTextItem, newText: string) => {
      onTextEdit({
        itemId: item.id,
        pageNum,
        originalText: item.str,
        newText,
        pdfX: item.pdfX,
        pdfY: item.pdfY,
        pdfWidth: item.pdfWidth,
        pdfHeight: item.pdfHeight,
        fontSize: item.fontSize,
        fontFamily: item.fontFamily,
      });
      setEditingId(null);
    },
    [onTextEdit, pageNum]
  );

  const getCurrentText = (item: ExtractedTextItem): string => {
    const edit = textEdits.get(item.id);
    return edit ? edit.newText : item.str;
  };

  // Debug: log extraction results
  useEffect(() => {
    if (active) {
      console.log("[TextEditLayer] active, textItems count:", textItems.length);
      if (textItems.length > 0) {
        console.log("[TextEditLayer] first item:", JSON.stringify(textItems[0]));
      }
    }
  }, [active, textItems]);

  if (!active && textEdits.size === 0) return null;

  return (
    <div
      className="absolute inset-0"
      style={{
        width,
        height,
        pointerEvents: active ? "auto" : "none",
        zIndex: active ? 20 : 5,
      }}
    >
      {/* Debug border to confirm layer renders */}
      {active && textItems.length === 0 && (
        <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded z-50">
          No text items found on this page
        </div>
      )}
      {textItems.map((item) => {
        const isEditing = editingId === item.id;
        const hasEdit = textEdits.has(item.id);
        const displayText = getCurrentText(item);

        // Only show items when tool is active OR item has been edited
        if (!active && !hasEdit) return null;

        return (
          <div
            key={item.id}
            className="absolute"
            style={{
              left: item.canvasX,
              top: item.canvasY - item.canvasHeight,
              width: Math.max(item.canvasWidth, 20),
              height: item.canvasHeight + 2,
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                className="w-full h-full bg-white border border-blue-500 outline-none px-0"
                style={{
                  fontSize: item.fontSize * scale,
                  lineHeight: 1,
                  fontFamily: "Helvetica, Arial, sans-serif",
                  color: "#000",
                  minWidth: 40,
                }}
                defaultValue={displayText}
                onBlur={(e) => handleCommit(item, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCommit(item, (e.target as HTMLInputElement).value);
                  }
                  if (e.key === "Escape") {
                    setEditingId(null);
                  }
                }}
              />
            ) : (
              <div
                className={`w-full h-full cursor-text transition-colors ${
                  active
                    ? "hover:bg-blue-500/10 hover:outline hover:outline-1 hover:outline-blue-400/50"
                    : ""
                } ${hasEdit ? "bg-yellow-300/20 outline outline-1 outline-yellow-400/40" : ""}`}
                style={{
                  fontSize: item.fontSize * scale,
                  lineHeight: 1,
                  fontFamily: "Helvetica, Arial, sans-serif",
                }}
                onClick={() => handleItemClick(item)}
                title={active ? "Click to edit" : undefined}
              >
                {/* Show replacement text visually over the original */}
                {hasEdit && (
                  <span
                    className="absolute inset-0 flex items-center bg-white/90 text-black px-0"
                    style={{
                      fontSize: item.fontSize * scale,
                      lineHeight: 1,
                      fontFamily: "Helvetica, Arial, sans-serif",
                    }}
                  >
                    {displayText}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
