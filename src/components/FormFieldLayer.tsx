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
          const boxSize = Math.min(field.canvasWidth, field.canvasHeight);
          return (
            <div
              key={field.id}
              className="absolute cursor-pointer"
              style={{
                left: field.canvasX,
                top: field.canvasY,
                width: field.canvasWidth,
                height: field.canvasHeight,
              }}
              onClick={() => {
                if (!field.readOnly) {
                  onFieldChange(field.fieldName, "", !current.isChecked);
                }
              }}
              title={field.fieldName}
            >
              {current.isChecked && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{
                    fontSize: boxSize * 0.9,
                    fontWeight: 900,
                    color: "#000",
                    lineHeight: 1,
                  }}
                >
                  X
                </div>
              )}
            </div>
          );
        }

        // Text input: font fills ~80% of field height, vertically centered
        const fieldFontSize = Math.max(field.canvasHeight * 0.75, 9);

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
                  fontSize: fieldFontSize,
                  lineHeight: 1.2,
                  padding: `${(field.canvasHeight - fieldFontSize) / 2}px 2px`,
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
                  fontSize: fieldFontSize,
                  lineHeight: 1,
                  padding: 0,
                  border: "none",
                  color: "#000",
                  fontFamily: "'Courier New', Courier, monospace",
                  verticalAlign: "middle",
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
