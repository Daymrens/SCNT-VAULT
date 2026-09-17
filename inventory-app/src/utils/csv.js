const needsQuote = (v) => v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r');

export function toCsv(rows) {
  return rows.map(row =>
    row.map((cell) => {
      let s = String(cell ?? '');
      const first = s.charAt(0);
      if (first === '=' || first === '+' || first === '-' || first === '@') s = `'${s}`;
      if (needsQuote(s)) s = `"${s.replace(/"/g, '""')}"`;
      return s;
    }).join(',')
  ).join('\n');
}
