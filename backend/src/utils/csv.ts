function escapeCsv(value: string | null | undefined) {
  if (value === null || value === undefined) return "";
  const stringified = `${value}`;
  // CSV formula injection prevention (OWASP): strip leading characters that
  // trigger formula execution in Excel and Google Sheets when the cell is
  // not explicitly typed as text. Prefixing with a tab character (\t) forces
  // the spreadsheet to treat the value as a plain string, not a formula.
  // Attack vector: a lead name like "=HYPERLINK(...)" exfiltrates admin data.
  const formulaTriggers = ["=", "+", "-", "@", "\t", "\r"];
  const sanitized = formulaTriggers.some((char) => stringified.startsWith(char))
    ? `\t${stringified}`
    : stringified;
  const normalized = sanitized.replace(/"/g, '""');
  return `"${normalized}"`;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsv(row[header] as string)).join(","));
  }
  return lines.join("\n");
}
