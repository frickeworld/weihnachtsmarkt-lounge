/**
 * CSV für Excel (deutsch): Semikolon als Trenner, UTF-8 mit BOM, CRLF.
 * Werte, die mit =, +, - oder @ beginnen, werden entschärft (CSV-Injection).
 */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** Betrag in Cent als Excel-Zahl mit Komma („178,50“). */
export function csvEuro(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function downloadFile(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
