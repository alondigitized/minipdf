"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { ToolType, Annotation, Point, AnnotationFont } from "@/hooks/usePDFEditor";

const FONT_CSS: Record<AnnotationFont, string> = {
  helvetica: "Helvetica, Arial, sans-serif",
  courier: "'Courier New', Courier, monospace",
  times: "'Times New Roman', Times, serif",
};

function getFontCSS(font?: AnnotationFont): string {
  return FONT_CSS[font || "helvetica"];
}

interface AnnotationCanvasProps {
  width: number;
  height: number;
  tool: ToolType;
  color: string;
  fontSize: number;
  fontFamily: AnnotationFont;
  strokeWidth: number;
  annotations: Annotation[];
  selectedId: string | null;
  onAddAnnotation: (ann: Omit<Annotation, "id">) => void;
  onUpdateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onSelect: (id: string | null) => void;
}

export default function AnnotationCanvas({
  width,
  height,
  tool,
  color,
  fontSize,
  fontFamily,
  strokeWidth,
  annotations,
  selectedId,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onSelect,
}: AnnotationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<Point | null>(null);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState<Point | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Render annotations on canvas
  const renderAnnotations = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);

    for (const ann of annotations) {
      if (ann.type === "text" && ann.id !== editingTextId) {
        ctx.font = `${ann.fontSize || 16}px ${getFontCSS(ann.fontFamily)}`;
        ctx.fillStyle = ann.color;
        ctx.fillText(ann.text || "", ann.x, ann.y + (ann.fontSize || 16));
      } else if (ann.type === "highlight") {
        ctx.fillStyle = ann.color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(ann.x, ann.y, ann.width || 0, ann.height || 0);
        ctx.globalAlpha = 1;
      } else if (ann.type === "rectangle") {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.strokeWidth || 2;
        ctx.strokeRect(ann.x, ann.y, ann.width || 0, ann.height || 0);
      } else if (ann.type === "draw" && ann.points && ann.points.length > 1) {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.strokeWidth || 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x, ann.points[0].y);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x, ann.points[i].y);
        }
        ctx.stroke();
      } else if (ann.type === "image" && ann.imageData) {
        const img = new Image();
        img.src = ann.imageData;
        img.onload = () => {
          ctx.drawImage(img, ann.x, ann.y, ann.width || 100, ann.height || 100);
        };
      }

      // Selection indicator
      if (ann.id === selectedId) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        if (ann.type === "text") {
          const textWidth = ctx.measureText(ann.text || "").width;
          ctx.strokeRect(
            ann.x - 4,
            ann.y - 2,
            textWidth + 8,
            (ann.fontSize || 16) + 8
          );
        } else if (ann.width && ann.height) {
          ctx.strokeRect(ann.x - 4, ann.y - 4, ann.width + 8, ann.height + 8);
        } else if (ann.points && ann.points.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of ann.points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          }
          ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
        }
        ctx.setLineDash([]);
      }
    }

    // Draw current drawing preview
    if (isDrawing && currentPoints.length > 1 && tool === "draw") {
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(currentPoints[0].x, currentPoints[0].y);
      for (let i = 1; i < currentPoints.length; i++) {
        ctx.lineTo(currentPoints[i].x, currentPoints[i].y);
      }
      ctx.stroke();
    }

    // Draw current shape preview
    if (isDrawing && drawStart && (tool === "highlight" || tool === "rectangle")) {
      const last = currentPoints[currentPoints.length - 1];
      if (last) {
        const x = Math.min(drawStart.x, last.x);
        const y = Math.min(drawStart.y, last.y);
        const w = Math.abs(last.x - drawStart.x);
        const h = Math.abs(last.y - drawStart.y);
        if (tool === "highlight") {
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.3;
          ctx.fillRect(x, y, w, h);
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = color;
          ctx.lineWidth = strokeWidth;
          ctx.strokeRect(x, y, w, h);
        }
      }
    }
  }, [annotations, selectedId, isDrawing, currentPoints, drawStart, tool, color, strokeWidth, editingTextId, width, height, fontSize]);

  useEffect(() => {
    renderAnnotations();
  }, [renderAnnotations]);

  const getCanvasPos = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const findAnnotationAt = (pos: Point): Annotation | null => {
    // Reverse order so topmost annotation is found first
    for (let i = annotations.length - 1; i >= 0; i--) {
      const ann = annotations[i];
      if (ann.type === "text") {
        const fs = ann.fontSize || 16;
        if (
          pos.x >= ann.x &&
          pos.x <= ann.x + 200 &&
          pos.y >= ann.y &&
          pos.y <= ann.y + fs + 4
        ) {
          return ann;
        }
      } else if (ann.width && ann.height) {
        if (
          pos.x >= ann.x &&
          pos.x <= ann.x + ann.width &&
          pos.y >= ann.y &&
          pos.y <= ann.y + ann.height
        ) {
          return ann;
        }
      } else if (ann.points && ann.points.length > 0) {
        for (const p of ann.points) {
          if (Math.abs(pos.x - p.x) < 10 && Math.abs(pos.y - p.y) < 10) {
            return ann;
          }
        }
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);

    if (tool === "select") {
      const ann = findAnnotationAt(pos);
      onSelect(ann?.id || null);
      return;
    }

    if (tool === "erase") {
      const ann = findAnnotationAt(pos);
      if (ann) onDeleteAnnotation(ann.id);
      return;
    }

    if (tool === "text") {
      // Place text input at cursor
      setTextPos(pos);
      setTextInput("");
      setEditingTextId(null);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }

    if (tool === "draw" || tool === "highlight" || tool === "rectangle") {
      setIsDrawing(true);
      setDrawStart(pos);
      setCurrentPoints([pos]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const pos = getCanvasPos(e);
    setCurrentPoints((prev) => [...prev, pos]);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !drawStart) return;
    setIsDrawing(false);

    if (tool === "draw" && currentPoints.length > 1) {
      onAddAnnotation({
        type: "draw",
        x: currentPoints[0].x,
        y: currentPoints[0].y,
        color,
        strokeWidth,
        points: [...currentPoints],
      });
    } else if (tool === "highlight" || tool === "rectangle") {
      const last = currentPoints[currentPoints.length - 1];
      if (last) {
        const x = Math.min(drawStart.x, last.x);
        const y = Math.min(drawStart.y, last.y);
        const w = Math.abs(last.x - drawStart.x);
        const h = Math.abs(last.y - drawStart.y);
        if (w > 2 && h > 2) {
          onAddAnnotation({
            type: tool === "highlight" ? "highlight" : "rectangle",
            x,
            y,
            width: w,
            height: h,
            color,
            strokeWidth,
          });
        }
      }
    }

    setCurrentPoints([]);
    setDrawStart(null);
  };

  const commitText = () => {
    if (textInput.trim() && textPos) {
      onAddAnnotation({
        type: "text",
        x: textPos.x,
        y: textPos.y,
        text: textInput,
        fontSize,
        fontFamily,
        color,
      });
    }
    setTextPos(null);
    setTextInput("");
  };

  return (
    <div
      className="absolute inset-0"
      style={{
        width,
        height,
        pointerEvents: tool === "editText" ? "none" : "auto",
        zIndex: tool === "editText" ? 1 : 10,
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="absolute inset-0 cursor-crosshair"
        style={{
          width: width,
          height: height,
          cursor:
            tool === "select"
              ? "default"
              : tool === "erase"
                ? "pointer"
                : tool === "editText"
                  ? "text"
                  : "crosshair",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {textPos && (
        <textarea
          ref={inputRef}
          className="absolute bg-transparent border border-blue-400 rounded px-1 outline-none resize-none"
          style={{
            left: textPos.x,
            top: textPos.y,
            fontSize: fontSize,
            color: color,
            fontFamily: getFontCSS(fontFamily),
            lineHeight: 1.2,
            minWidth: 100,
            minHeight: fontSize + 8,
          }}
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitText();
            }
            if (e.key === "Escape") {
              setTextPos(null);
              setTextInput("");
            }
          }}
        />
      )}
    </div>
  );
}
