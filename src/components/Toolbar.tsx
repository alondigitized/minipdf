"use client";

import { type ToolType } from "@/hooks/usePDFEditor";

interface ToolbarProps {
  tool: ToolType;
  setTool: (t: ToolType) => void;
  color: string;
  setColor: (c: string) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  strokeWidth: number;
  setStrokeWidth: (w: number) => void;
  scale: number;
  setScale: (s: number) => void;
  currentPage: number;
  totalPages: number;
  setCurrentPage: (p: number) => void;
  onUndo: () => void;
  onExport: () => void;
  onReset: () => void;
  onImageUpload: () => void;
}

const tools: { id: ToolType; label: string; icon: string }[] = [
  { id: "select", label: "Select", icon: "↖" },
  { id: "editText", label: "Edit Text", icon: "I\u0332" },
  { id: "text", label: "Add Text", icon: "T" },
  { id: "draw", label: "Draw", icon: "✎" },
  { id: "highlight", label: "Highlight", icon: "█" },
  { id: "rectangle", label: "Rectangle", icon: "▭" },
  { id: "image", label: "Image", icon: "🖼" },
  { id: "erase", label: "Erase", icon: "✕" },
];

const COLORS = [
  "#000000",
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#eab308",
  "#a855f7",
  "#f97316",
  "#ffffff",
];

export default function Toolbar({
  tool,
  setTool,
  color,
  setColor,
  fontSize,
  setFontSize,
  strokeWidth,
  setStrokeWidth,
  scale,
  setScale,
  currentPage,
  totalPages,
  setCurrentPage,
  onUndo,
  onExport,
  onReset,
  onImageUpload,
}: ToolbarProps) {
  return (
    <div className="bg-[#111] border-b border-white/10 px-4 py-2 flex items-center gap-2 flex-wrap">
      {/* File actions */}
      <button
        onClick={onReset}
        className="text-xs text-white/50 hover:text-white/80 px-2 py-1 rounded hover:bg-white/5"
        title="Open new file"
      >
        New
      </button>
      <div className="w-px h-6 bg-white/10" />

      {/* Tools */}
      {tools.map((t) => (
        <button
          key={t.id}
          className={`tool-btn text-sm ${tool === t.id ? "active" : "text-white/60"}`}
          onClick={() => {
            if (t.id === "image") {
              onImageUpload();
            } else {
              setTool(t.id);
            }
          }}
          title={t.label}
        >
          {t.icon}
        </button>
      ))}

      <div className="w-px h-6 bg-white/10" />

      {/* Colors */}
      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            className={`w-6 h-6 rounded-full border-2 transition-all ${
              color === c ? "border-blue-400 scale-110" : "border-white/20"
            }`}
            style={{ backgroundColor: c }}
            onClick={() => setColor(c)}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-white/10" />

      {/* Size controls */}
      {(tool === "text") && (
        <div className="flex items-center gap-1">
          <label className="text-xs text-white/40">Size</label>
          <input
            type="range"
            min="8"
            max="72"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-16 accent-blue-500"
          />
          <span className="text-xs text-white/60 w-6">{fontSize}</span>
        </div>
      )}
      {(tool === "draw" || tool === "rectangle") && (
        <div className="flex items-center gap-1">
          <label className="text-xs text-white/40">Width</label>
          <input
            type="range"
            min="1"
            max="20"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            className="w-16 accent-blue-500"
          />
          <span className="text-xs text-white/60 w-6">{strokeWidth}</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Undo */}
      <button
        onClick={onUndo}
        className="text-xs text-white/50 hover:text-white/80 px-2 py-1 rounded hover:bg-white/5"
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>

      <div className="w-px h-6 bg-white/10" />

      {/* Page navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="text-white/60 hover:text-white disabled:opacity-30 text-sm px-1"
        >
          ‹
        </button>
        <span className="text-xs text-white/60 min-w-[60px] text-center">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="text-white/60 hover:text-white disabled:opacity-30 text-sm px-1"
        >
          ›
        </button>
      </div>

      <div className="w-px h-6 bg-white/10" />

      {/* Zoom */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setScale(Math.max(0.5, scale - 0.25))}
          className="text-white/60 hover:text-white text-sm px-1"
        >
          −
        </button>
        <span className="text-xs text-white/60 min-w-[40px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(Math.min(3, scale + 0.25))}
          className="text-white/60 hover:text-white text-sm px-1"
        >
          +
        </button>
      </div>

      <div className="w-px h-6 bg-white/10" />

      {/* Export */}
      <button
        onClick={onExport}
        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Download PDF
      </button>
    </div>
  );
}
