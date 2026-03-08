"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { extractFormFields, type FormField } from "@/lib/pdf-renderer";
import type { ToolType } from "@/hooks/usePDFEditor";

interface FormFieldLayerProps {
  pdf: PDFDocumentProxy;
  pageNum: number;
  scale: number;
  width: number;
  height: number;
  tool: ToolType;
  formFieldEdits: Map<string, { value: string; isChecked: boolean }>;
  onFieldChange: (fieldName: string, value: string, isChecked: boolean) => void;
}

export default function FormFieldLayer({
  pdf,
  pageNum,
  scale,
  width,
  height,
  tool,
  formFieldEdits,
  onFieldChange,
}: FormFieldLayerProps) {
  const [fields, setFields] = useState<FormField[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await extractFormFields(pdf, pageNum, scale);
        if (!cancelled) setFields(result);
      } catch (err) {
        console.error("[FormFieldLayer] Failed to extract form fields:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageNum, scale]);

  const getFieldValue = useCallback(
    (field: FormField) => {
      const edit = formFieldEdits.get(field.fieldName);
      if (edit) return edit;
      return { value: field.value, isChecked: field.isChecked };
    },
    [formFieldEdits]
  );

  if (fields.length === 0) return null;

  // Only interactive when select tool is active (or no drawing tool)
  const interactive = tool === "select" || tool === "editText";

  return (
    <div
      className="absolute inset-0"
      style={{
        width,
        height,
        pointerEvents: interactive ? "auto" : "none",
        zIndex: 15,
      }}
    >
      {fields.map((field) => {
        const current = getFieldValue(field);

        if (field.fieldType === "checkbox") {
          return (
            <div
              key={field.id}
              className="absolute"
              style={{
                left: field.canvasX,
                top: field.canvasY,
                width: field.canvasWidth,
                height: field.canvasHeight,
              }}
            >
              <input
                type="checkbox"
                checked={current.isChecked}
                disabled={field.readOnly}
                onChange={(e) =>
                  onFieldChange(field.fieldName, "", e.target.checked)
                }
                className="w-full h-full cursor-pointer accent-black"
                style={{
                  margin: 0,
                  opacity: 0.01,
                }}
                title={field.fieldName}
              />
              {/* Visual checkmark overlay */}
              {current.isChecked && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{ fontSize: Math.min(field.canvasWidth, field.canvasHeight) * 0.8 }}
                >
                  &#10003;
                </div>
              )}
            </div>
          );
        }

        // Text input field
        return (
          <div
            key={field.id}
            className="absolute"
            style={{
              left: field.canvasX,
              top: field.canvasY,
              width: field.canvasWidth,
              height: field.canvasHeight,
            }}
          >
            {field.multiline ? (
              <textarea
                value={current.value}
                readOnly={field.readOnly}
                maxLength={field.maxLen || undefined}
                onChange={(e) =>
                  onFieldChange(field.fieldName, e.target.value, false)
                }
                className="w-full h-full bg-transparent outline-none resize-none"
                style={{
                  fontSize: Math.max(field.canvasHeight * 0.6, 8),
                  lineHeight: 1.2,
                  padding: "1px 2px",
                  border: "none",
                  color: "#000",
                  fontFamily: "'Courier New', Courier, monospace",
                }}
                title={field.fieldName}
              />
            ) : (
              <input
                type="text"
                value={current.value}
                readOnly={field.readOnly}
                maxLength={field.maxLen || undefined}
                onChange={(e) =>
                  onFieldChange(field.fieldName, e.target.value, false)
                }
                className="w-full h-full bg-transparent outline-none"
                style={{
                  fontSize: Math.max(field.canvasHeight * 0.6, 8),
                  lineHeight: 1,
                  padding: "1px 2px",
                  border: "none",
                  color: "#000",
                  fontFamily: "'Courier New', Courier, monospace",
                }}
                title={field.fieldName}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
