function pdfObj(id: number, content: string): string {
  return `${id} 0 obj\n${content}\nendobj\n`;
}

function pdfStream(id: number, payload: string): string {
  return `${id} 0 obj\n<</Length ${payload.length}>>\nstream\n${payload}\nendstream\nendobj\n`;
}

export function makeMinimalPdf(pageTexts: string[]): Buffer {
  const n = pageTexts.length;
  const fontId = 3 + 2 * n;
  const pageIds = Array.from({ length: n }, (_, i) => 3 + i);
  const contentIds = Array.from({ length: n }, (_, i) => 3 + n + i);

  const objs: string[] = [];
  objs.push(pdfObj(1, "<</Type/Catalog/Pages 2 0 R>>"));
  objs.push(
    pdfObj(
      2,
      `<</Type/Pages/Kids[${pageIds.map((id) => `${id} 0 R`).join(" ")}]/Count ${n}/MediaBox[0 0 612 792]>>`,
    ),
  );
  for (let i = 0; i < n; i++) {
    objs.push(
      pdfObj(
        pageIds[i],
        `<</Type/Page/Parent 2 0 R/Resources<</Font<</F1 ${fontId} 0 R>>>>/Contents ${contentIds[i]} 0 R>>`,
      ),
    );
  }
  for (let i = 0; i < n; i++) {
    const escaped = pageTexts[i].replace(/\\/g, "\\\\").replace(/[()]/g, "\\$&");
    objs.push(pdfStream(contentIds[i], `BT /F1 12 Tf 50 700 Td (${escaped}) Tj ET`));
  }
  objs.push(pdfObj(fontId, "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>"));

  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [];
  let body = "";
  for (const obj of objs) {
    offsets.push(header.length + body.length);
    body += obj;
  }

  const xrefOffset = header.length + body.length;
  const totalObjs = objs.length + 1;
  let xref = `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<</Size ${totalObjs}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(header + body + xref, "latin1");
}
