/* Small CSV / TSV parser and writer. Detects comma, semicolon or tab delimiters. */
window.InfographicCSV = (function () {
  function detect(text) {
    var first = text.split(/\r?\n/).slice(0, 5).join('\n');
    var counts = { ',': 0, ';': 0, '\t': 0 };
    var inQ = false;
    for (var i = 0; i < first.length; i++) {
      var ch = first[i];
      if (ch === '"') inQ = !inQ;
      else if (!inQ && ch in counts) counts[ch]++;
    }
    var best = ',';
    Object.keys(counts).forEach(function (k) { if (counts[k] > counts[best]) best = k; });
    return best;
  }

  function parse(text, delim) {
    text = String(text).replace(/^﻿/, '');
    delim = delim || detect(text);
    var rows = [], row = [], field = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
        } else field += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === delim) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); rows.push(row); row = []; field = '';
      } else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
    var width = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    return rows.map(function (r) { while (r.length < width) r.push(''); return r.map(function (c) { return String(c).trim(); }); });
  }

  function stringify(rows) {
    return rows.map(function (r) {
      return r.map(function (c) {
        c = c == null ? '' : String(c);
        return /[",\n\r]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c;
      }).join(',');
    }).join('\n');
  }

  return { parse: parse, stringify: stringify };
})();
