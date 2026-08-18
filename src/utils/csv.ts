/**
 * Minimal RFC4180-style CSV helpers — quotes fields that contain a comma,
 * quote, or newline, and doubles embedded quotes. Good enough for the
 * simple, flat tables this app exports/imports (no nested structures).
 */

export function csvField(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvField).join(",");
}

export function buildCsv(header: string[], rows: unknown[][]): string {
  return [csvRow(header), ...rows.map(csvRow)].join("\r\n") + "\r\n";
}

/** Parses CSV text into rows of raw string cells (header row included). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const char = s[i];
    if (inQuotes) {
      if (char === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully blank trailing lines.
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

/** Parses CSV text into an array of objects keyed by the header row. */
export function parseCsvObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const [header, ...body] = rows;
  return body.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((key, i) => {
      obj[key.trim()] = r[i] ?? "";
    });
    return obj;
  });
}
