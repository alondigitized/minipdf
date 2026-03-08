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
        console.error("[TextEditLayer] Failed to extract text:", err);
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
        fontName: item.fontName,
        isBold: item.isBold,
        isItalic: item.isItalic,
      });
      setEditingId(null);
    },
    [onTextEdit, pageNum]
  );

  const getCurrentText = (item: ExtractedTextItem): string => {
    const edit = textEdits.get(item.id);
    return edit ? edit.newText : item.str;
  };

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
      {textItems.map((item) => {
        const isEditing = editingId === item.id;
        const hasEdit = textEdits.has(item.id);
        const displayText = getCurrentText(item);

        if (!active && !hasEdit) return null;

        const fontStyle: React.CSSProperties = {
          fontSize: item.fontSize * scale,
          lineHeight: 1,
          fontFamily: "Helvetica, Arial, sans-serif",
          fontWeight: item.isBold ? "bold" : "normal",
          fontStyle: item.isItalic ? "italic" : "normal",
        };

        // Padding to fully cover original text on the canvas
        const pad = 4;

        return (
          <div
            key={item.id}
            className="absolute"
            style={{
              left: item.canvasX - pad,
              top: item.canvasY - item.canvasHeight - pad,
              width: Math.max(item.canvasWidth + pad * 2, 30),
              height: item.canvasHeight + pad * 2,
            }}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                className="w-full h-full border border-blue-500 outline-none"
                style={{
                  ...fontStyle,
                  color: "#000",
                  background: "white",
                  padding: `${pad}px`,
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
            ) : hasEdit ? (
              // Edited text: solid white background to fully cover original
              <div
                className="w-full h-full flex items-center cursor-text"
                style={{
                  ...fontStyle,
                  color: "#000",
                  background: "white",
                  padding: `${pad}px`,
                }}
                onClick={() => handleItemClick(item)}
              >
                {displayText}
              </div>
            ) : (
              // Active tool: clickable hover target (transparent)
              <div
                className="w-full h-full cursor-text hover:bg-blue-500/10 hover:outline hover:outline-1 hover:outline-blue-400/50"
                style={fontStyle}
                onClick={() => handleItemClick(item)}
                title="Click to edit"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
