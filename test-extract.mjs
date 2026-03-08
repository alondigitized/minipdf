import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import fs from 'fs';

const data = fs.readFileSync('/tmp/test.pdf');
const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
const page = await doc.getPage(1);
const viewport = page.getViewport({ scale: 1 });
const textContent = await page.getTextContent();

console.log('Page height:', viewport.height);
console.log('Num items:', textContent.items.length);
console.log('Styles:', JSON.stringify(textContent.styles, null, 2));

for (const item of textContent.items) {
  if (!('str' in item) || !item.str.trim()) continue;
  console.log('---');
  console.log('Text:', item.str);
  console.log('FontName:', item.fontName);
  console.log('Transform:', item.transform);
  console.log('Width:', item.width);

  const scale = 1.5;
  const tx = item.transform;
  const fontSize = Math.abs(tx[3]);
  const canvasX = tx[4] * scale;
  const canvasY = (viewport.height - tx[5]) * scale;
  const canvasWidth = item.width * scale;
  const canvasHeight = fontSize * scale;
  console.log('Canvas pos:', { canvasX, canvasY, canvasWidth, canvasHeight, fontSize });
}
