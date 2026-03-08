"use client";

import { useCallback, useState, useRef } from "react";

interface UploadZoneProps {
  onFile: (file: File) => void;
}

export default function UploadZone({ onFile }: UploadZoneProps) {
  const [dragover, setDragover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragover(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div className="w-full max-w-xl">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-2">MiniPDF</h1>
        <p className="text-white/50 text-sm">
          Secure, browser-based PDF editor. Your files never leave your device.
        </p>
      </div>

      <div
        className={`upload-zone border-2 border-dashed border-white/20 rounded-2xl p-12 text-center cursor-pointer ${
          dragover ? "dragover" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragover(true);
        }}
        onDragLeave={() => setDragover(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <svg
          className="mx-auto mb-4 text-white/30"
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="12" y2="12" />
          <line x1="15" y1="15" x2="12" y2="12" />
        </svg>
        <p className="text-white/60 mb-1">
          Drop a PDF here or{" "}
          <span className="text-blue-400 underline">browse</span>
        </p>
        <p className="text-white/30 text-xs">Max 50 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleChange}
        />
      </div>
    </div>
  );
}
