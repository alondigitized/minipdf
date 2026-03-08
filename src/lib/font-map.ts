import { StandardFonts } from "pdf-lib";

/**
 * Maps CSS font family names (from PDF.js) to pdf-lib StandardFonts.
 * Covers the 14 standard PDF fonts plus common aliases used in IRS forms.
 */

interface FontMatch {
  font: StandardFonts;
  isBold: boolean;
  isItalic: boolean;
}

// Normalized name -> StandardFonts mapping
const FONT_MAP: Record<string, StandardFonts> = {
  // Helvetica family (also matches Arial)
  helvetica: StandardFonts.Helvetica,
  "helvetica-bold": StandardFonts.HelveticaBold,
  "helvetica-oblique": StandardFonts.HelveticaOblique,
  "helvetica-boldoblique": StandardFonts.HelveticaBoldOblique,
  arial: StandardFonts.Helvetica,
  "arial-bold": StandardFonts.HelveticaBold,
  "arial-italic": StandardFonts.HelveticaOblique,
  "arial-bolditalic": StandardFonts.HelveticaBoldOblique,

  // Times family
  "times-roman": StandardFonts.TimesRoman,
  timesroman: StandardFonts.TimesRoman,
  "times-bold": StandardFonts.TimesRomanBold,
  "times-italic": StandardFonts.TimesRomanItalic,
  "times-bolditalic": StandardFonts.TimesRomanBoldItalic,
  "timesnewroman": StandardFonts.TimesRoman,
  "times new roman": StandardFonts.TimesRoman,

  // Courier family
  courier: StandardFonts.Courier,
  "courier-bold": StandardFonts.CourierBold,
  "courier-oblique": StandardFonts.CourierOblique,
  "courier-boldoblique": StandardFonts.CourierBoldOblique,
  "couriernew": StandardFonts.Courier,
  "courier new": StandardFonts.Courier,

  // Symbol and ZapfDingbats
  symbol: StandardFonts.Symbol,
  zapfdingbats: StandardFonts.ZapfDingbats,
};

// Keywords that indicate bold/italic in font names
const BOLD_PATTERNS = /bold|heavy|black|demi|semibold/i;
const ITALIC_PATTERNS = /italic|oblique|slant/i;

/**
 * Resolves a PDF font family name to the closest pdf-lib StandardFont.
 * Handles IRS form fonts: Helvetica, Arial, Times, Courier and their variants.
 */
export function resolveFont(fontFamily: string): FontMatch {
  const name = fontFamily.trim();
  const lower = name.toLowerCase().replace(/[,\s]+/g, "");

  // Direct lookup
  const direct = FONT_MAP[lower];
  if (direct) {
    return {
      font: direct,
      isBold: BOLD_PATTERNS.test(name),
      isItalic: ITALIC_PATTERNS.test(name),
    };
  }

  // Try with style suffixes stripped for base match, then re-apply
  const isBold = BOLD_PATTERNS.test(name);
  const isItalic = ITALIC_PATTERNS.test(name);

  // Extract base family name
  const base = lower
    .replace(/bold|heavy|black|demi|semibold/gi, "")
    .replace(/italic|oblique|slant/gi, "")
    .replace(/[^a-z]/g, "")
    .trim();

  // Match base to font family
  if (base.includes("helvetica") || base.includes("arial") || base.includes("swiss")) {
    if (isBold && isItalic) return { font: StandardFonts.HelveticaBoldOblique, isBold, isItalic };
    if (isBold) return { font: StandardFonts.HelveticaBold, isBold, isItalic };
    if (isItalic) return { font: StandardFonts.HelveticaOblique, isBold, isItalic };
    return { font: StandardFonts.Helvetica, isBold, isItalic };
  }

  if (base.includes("times") || base.includes("roman") || base.includes("serif")) {
    if (isBold && isItalic) return { font: StandardFonts.TimesRomanBoldItalic, isBold, isItalic };
    if (isBold) return { font: StandardFonts.TimesRomanBold, isBold, isItalic };
    if (isItalic) return { font: StandardFonts.TimesRomanItalic, isBold, isItalic };
    return { font: StandardFonts.TimesRoman, isBold, isItalic };
  }

  if (base.includes("courier") || base.includes("mono") || base.includes("ocr")) {
    if (isBold && isItalic) return { font: StandardFonts.CourierBoldOblique, isBold, isItalic };
    if (isBold) return { font: StandardFonts.CourierBold, isBold, isItalic };
    if (isItalic) return { font: StandardFonts.CourierOblique, isBold, isItalic };
    return { font: StandardFonts.Courier, isBold, isItalic };
  }

  // Default: Helvetica (most common in IRS forms)
  if (isBold && isItalic) return { font: StandardFonts.HelveticaBoldOblique, isBold, isItalic };
  if (isBold) return { font: StandardFonts.HelveticaBold, isBold, isItalic };
  if (isItalic) return { font: StandardFonts.HelveticaOblique, isBold, isItalic };
  return { font: StandardFonts.Helvetica, isBold: false, isItalic: false };
}

/**
 * Returns a human-readable font label for the UI.
 */
export function fontLabel(fontFamily: string): string {
  const match = resolveFont(fontFamily);
  const name = match.font
    .replace("Times-", "Times ")
    .replace("Helvetica-", "Helvetica ")
    .replace("Courier-", "Courier ");
  return name;
}
