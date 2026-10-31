/** CSV cells remain strings until the user accepts an interpretation. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const counts = [',', ';', '\t'].map(delimiter => {
    let quoted = false;
    let count = 0;
    for (let i = 0; i < text.length; i++) {
      if (!quoted && (text[i] === '\n' || text[i] === '\r')) break;
      if (text[i] === '"' && quoted && text[i + 1] === '"') i++;
      else if (text[i] === '"') quoted = !quoted;
      else if (!quoted && text[i] === delimiter) count++;
    }
    return { delimiter, count };
  });
  const delimiter = counts.sort((a, b) => b.count - a.count)[0].delimiter;
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === delimiter) {
      row.push(cell); cell = ''; closed = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = ''; closed = false;
    } else if (char === '"') {
      if (cell || closed) throw new Error('Unexpected quote in CSV. Quote the entire cell and escape quotes with "".');
      quoted = true;
    } else {
      if (closed && char.trim()) throw new Error('Unexpected text after a quoted CSV cell.');
      if (!closed) cell += char;
    }
  }
  if (quoted) throw new Error('A quoted CSV cell is not closed. Check the file and try again.');
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  return rows;
}
