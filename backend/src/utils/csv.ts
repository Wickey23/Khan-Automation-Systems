function escapeCsv(value: string | null | undefined) {
  if (value === null || value === undefined) return "";
  const normalized = `${value}`.replace(/"/g, "\"\"");
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
