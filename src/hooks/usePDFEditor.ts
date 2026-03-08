"use client";

import { useState, useCallback, useRef } from "react";

export type ToolType =
  | "select"
  | "editText"
  | "text"
  | "draw"
  | "highlight"
  | "rectangle"
  | "image"
  | "erase";

export interface TextEdit {
  itemId: string;
  pageNum: number;
  originalText: string;
  newText: string;
  // PDF coordinates (unscaled, bottom-left origin)
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  fontSize: number;
  fontFamily: string;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export type AnnotationFont = "helvetica" | "courier" | "times";

export interface Annotation {
  id: string;
  type: "text" | "draw" | "highlight" | "rectangle" | "image";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: AnnotationFont;
  color: string;
  strokeWidth?: number;
  points?: Point[];
  imageData?: string;
}

let idCounter = 0;
function genId() {
  return `ann_${Date.now()}_${++idCounter}`;
}

export function usePDFEditor() {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [tool, setTool] = useState<ToolType>("select");
  const [color, setColor] = useState("#000000");
  const [fontSize, setFontSize] = useState(16);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontFamily, setFontFamily] = useState<AnnotationFont>("courier");
  const [annotations, setAnnotations] = useState<Map<number, Annotation[]>>(
    new Map()
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Map<number, Annotation[]>[]>([]);
  const [textEdits, setTextEdits] = useState<Map<string, TextEdit>>(new Map());

  const getPageAnnotations = useCallback(
    (page: number): Annotation[] => {
      return annotations.get(page) || [];
    },
    [annotations]
  );

  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-30), new Map(annotations)]);
  }, [annotations]);

  const addAnnotation = useCallback(
    (page: number, ann: Omit<Annotation, "id">) => {
      pushUndo();
      setAnnotations((prev) => {
        const next = new Map(prev);
        const pageAnns = [...(next.get(page) || [])];
        const newAnn = { ...ann, id: genId() };
        pageAnns.push(newAnn);
        next.set(page, pageAnns);
        return next;
      });
    },
    [pushUndo]
  );

  const updateAnnotation = useCallback(
    (page: number, id: string, updates: Partial<Annotation>) => {
      setAnnotations((prev) => {
        const next = new Map(prev);
        const pageAnns = (next.get(page) || []).map((a) =>
          a.id === id ? { ...a, ...updates } : a
        );
        next.set(page, pageAnns);
        return next;
      });
    },
    []
  );

  const deleteAnnotation = useCallback(
    (page: number, id: string) => {
      pushUndo();
      setAnnotations((prev) => {
        const next = new Map(prev);
        const pageAnns = (next.get(page) || []).filter((a) => a.id !== id);
        next.set(page, pageAnns);
        return next;
      });
      setSelectedId(null);
    },
    [pushUndo]
  );

  const setTextEdit = useCallback(
    (edit: TextEdit) => {
      setTextEdits((prev) => {
        const next = new Map(prev);
        // If text was reverted to original, remove the edit
        if (edit.newText === edit.originalText) {
          next.delete(edit.itemId);
        } else {
          next.set(edit.itemId, edit);
        }
        return next;
      });
    },
    []
  );

  const getTextEdit = useCallback(
    (itemId: string): TextEdit | undefined => {
      return textEdits.get(itemId);
    },
    [textEdits]
  );

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setAnnotations(last);
      return prev.slice(0, -1);
    });
  }, []);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    setTotalPages,
    scale,
    setScale,
    tool,
    setTool,
    color,
    setColor,
    fontSize,
    setFontSize,
    strokeWidth,
    setStrokeWidth,
    fontFamily,
    setFontFamily,
    annotations,
    getPageAnnotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    selectedId,
    setSelectedId,
    undo,
    textEdits,
    setTextEdit,
    getTextEdit,
  };
}
