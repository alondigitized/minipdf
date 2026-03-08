"use client";

import { useState, useCallback, useRef } from "react";

export type ToolType =
  | "select"
  | "text"
  | "draw"
  | "highlight"
  | "rectangle"
  | "image"
  | "erase";

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  type: "text" | "draw" | "highlight" | "rectangle" | "image";
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  fontSize?: number;
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
  const [annotations, setAnnotations] = useState<Map<number, Annotation[]>>(
    new Map()
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<Map<number, Annotation[]>[]>([]);

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
    annotations,
    getPageAnnotations,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    selectedId,
    setSelectedId,
    undo,
  };
}
