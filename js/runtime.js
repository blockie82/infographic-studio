/*
 * Infographic runtime — the chart engine.
 *
 * Everything the charts need lives inside this one function so that the
 * editor can embed its source code (InfographicRuntime.toString()) into exported
 * standalone HTML files. Do not reference anything outside this function.
 *
 * Rendering is deterministic: draw(ctx, w, h, project, t) paints the frame
 * at time t (seconds). The same call powers the live preview, the HTML
 * export and the frame-by-frame MP4 export.
 */
function InfographicRuntime() {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constants                                                          */
  /* ------------------------------------------------------------------ */

  var PALETTES = {
    vivid:   ['#2E6BFF', '#FF6B4A', '#16B88A', '#FFB020', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#64748B', '#0EA5E9', '#E11D48'],
    ocean:   ['#03045E', '#0077B6', '#00B4D8', '#48CAE4', '#90E0EF', '#023E8A', '#0096C7', '#ADE8F4', '#1D3557', '#457B9D'],
    sunset:  ['#F94144', '#F3722C', '#F8961E', '#F9844A', '#F9C74F', '#90BE6D', '#43AA8B', '#4D908E', '#577590', '#277DA1'],
    pastel:  ['#A0C4FF', '#FFADAD', '#CAFFBF', '#FFD6A5', '#BDB2FF', '#FFC6FF', '#9BF6FF', '#FDFFB6', '#D0D1FF', '#E2ECE9'],
    earth:   ['#606C38', '#283618', '#DDA15E', '#BC6C25', '#8D6A9F', '#5F7470', '#A3B18A', '#B5838D', '#6D597A', '#E07A5F'],
    mono:    ['#111827', '#374151', '#4B5563', '#6B7280', '#9CA3AF', '#1F2937', '#525252', '#737373', '#A3A3A3', '#D4D4D4'],
    neon:    ['#00F5D4', '#F15BB5', '#FEE440', '#00BBF9', '#9B5DE5', '#FF006E', '#3A86FF', '#8AC926', '#FB5607', '#FFBE0B']
  };

  var FONTS = {
    system: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    humanist: '"Gill Sans", "Gill Sans MT", Calibri, "Trebuchet MS", sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    mono: '"SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    condensed: '"Arial Narrow", "Roboto Condensed", "Helvetica Neue", Arial, sans-serif'
  };

  /* Settings every template shares. type: text | textarea | number | range | color | select | checkbox */
  var COMMON_SETTINGS = [
    { group: 'Header', key: 'title', label: 'Title', type: 'text', def: '' },
    { group: 'Header', key: 'subtitle', label: 'Subtitle', type: 'textarea', def: '' },
    { group: 'Header', key: 'source', label: 'Footer / source note', type: 'text', def: '' },
    { group: 'Style', key: 'palette', label: 'Colour palette', type: 'select', def: 'vivid', options: Object.keys(PALETTES) },
    { group: 'Style', key: 'customColors', label: 'Custom colours (one per line: Name: #hex)', type: 'textarea', def: '' },
    { group: 'Style', key: 'background', label: 'Background', type: 'color', def: '#ffffff' },
    { group: 'Style', key: 'textColor', label: 'Text colour', type: 'color', def: '#1f2430' },
    { group: 'Style', key: 'font', label: 'Font', type: 'select', def: 'system', options: Object.keys(FONTS) },
    { group: 'Style', key: 'textScale', label: 'Text size', type: 'range', def: 1, min: 0.6, max: 1.6, step: 0.05 },
    { group: 'Numbers', key: 'prefix', label: 'Prefix', type: 'text', def: '' },
    { group: 'Numbers', key: 'suffix', label: 'Suffix', type: 'text', def: '' },
    { group: 'Numbers', key: 'decimals', label: 'Decimal places', type: 'number', def: 0, min: 0, max: 6, step: 1 },
    { group: 'Numbers', key: 'compact', label: 'Compact numbers (1.2k, 3.4M)', type: 'checkbox', def: true },
    { group: 'Images', key: 'logo', label: 'Logo', type: 'image', def: '' },
    { group: 'Images', key: 'logoPosition', label: 'Logo position', type: 'select', def: 'top right', options: ['top right', 'top left', 'bottom right', 'bottom left'] },
    { group: 'Images', key: 'logoSize', label: 'Logo size', type: 'range', def: 1, min: 0.4, max: 3, step: 0.05 },
    { group: 'Images', key: 'bgImage', label: 'Background image', type: 'image', def: '' },
    { group: 'Images', key: 'bgImageOpacity', label: 'Background image strength', type: 'range', def: 0.18, min: 0, max: 1, step: 0.01 },
    { group: 'Images', key: 'bgImageFit', label: 'Background image fit', type: 'select', def: 'cover', options: ['cover', 'contain'] },
    { group: 'Images', key: 'imageShape', label: 'Shape of images used as icons', type: 'select', def: 'circle', options: ['circle', 'rounded', 'square', 'original'] },
    { group: 'Animation', key: 'duration', label: 'Animation length (s)', type: 'number', def: 8, min: 0.5, max: 600, step: 0.5 },
    { group: 'Animation', key: 'hold', label: 'Hold at end (s)', type: 'number', def: 2, min: 0, max: 60, step: 0.5 },
    { group: 'Animation', key: 'easing', label: 'Easing', type: 'select', def: 'smooth', options: ['smooth', 'linear', 'snappy'] }
  ];

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  var EASINGS = {
    linear: function (t) { return t; },
    smooth: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    snappy: function (t) { return 1 - Math.pow(1 - t, 4); }
  };

  function num(v) {
    if (typeof v === 'number') return v;
    if (v == null) return NaN;
    var s = String(v).replace(/[,\s£$€¥%]/g, '');
    if (s === '' || s === '-') return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  function niceTicks(min, max, count) {
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    if (max === min) { max = min + 1; }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log10(span / count)));
    var err = span / count / step;
    if (err >= 7.5) step *= 10; else if (err >= 3.5) step *= 5; else if (err >= 1.5) step *= 2;
    var lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
    var ticks = [];
    for (var v = lo; v <= hi + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
    return { ticks: ticks, lo: lo, hi: hi, step: step };
  }

  function fmt(v, S, decimalsOverride) {
    if (!isFinite(v)) return '';
    var d = decimalsOverride != null ? decimalsOverride : (S.decimals | 0);
    var unit = '';
    if (S.compact) {
      var a = Math.abs(v), units = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'k']];
      for (var i = 0; i < units.length; i++) {
        if (a >= units[i][0]) { v = v / units[i][0]; unit = units[i][1]; if (decimalsOverride == null) d = Math.max(d, 1); break; }
      }
    }
    var neg = v < 0;
    var s = Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (neg ? '−' : '') + (S.prefix || '') + s + unit + (S.suffix || '');
  }

  /* Format an axis tick: only as many decimals as the tick step needs */
  function fmtTick(v, S, step) {
    if (S.compact && Math.abs(v) >= 1000) {
      var k = Math.abs(v) >= 1e12 ? 1e12 : Math.abs(v) >= 1e9 ? 1e9 : Math.abs(v) >= 1e6 ? 1e6 : 1e3;
      return fmt(v, S, Math.max(0, Math.min(3, -Math.floor(Math.log10(step / k) + 1e-9))));
    }
    var d = step > 0 ? Math.max(0, Math.min(6, -Math.floor(Math.log10(step) + 1e-9))) : 0;
    return fmt(v, { prefix: S.prefix, suffix: S.suffix, compact: false, decimals: d });
  }

  function setFont(ctx, S, size, weight) {
    ctx.font = (weight || 400) + ' ' + Math.max(1, size).toFixed(2) + 'px ' + (FONTS[S.font] || S.font || FONTS.system);
  }

  function wrap(ctx, text, maxW) {
    var out = [];
    String(text).split('\n').forEach(function (para) {
      var words = para.split(/\s+/), line = '';
      words.forEach(function (w) {
        var test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
      });
      out.push(line);
    });
    return out;
  }

  function ellipsis(ctx, text, maxW) {
    text = String(text);
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function withAlpha(hex, a) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function parseCustomColors(str) {
    var map = {};
    String(str || '').split('\n').forEach(function (line) {
      var m = line.match(/^\s*(.+?)\s*[:=]\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\s*$/);
      if (m) map[m[1].toLowerCase()] = m[2];
    });
    return map;
  }

  /* Returns a colour picker function: color(name, index) */
  function colorer(S) {
    var pal = PALETTES[S.palette] || PALETTES.vivid;
    var custom = parseCustomColors(S.customColors);
    return function (name, i) {
      var c = custom[String(name).toLowerCase()];
      return c || pal[i % pal.length];
    };
  }

  /* Data helpers: data is a 2D array of strings, row 0 = header */
  function cleanRows(T) {
    return (T || []).slice(1).filter(function (r) { return r && r[0] != null && String(r[0]).trim() !== ''; });
  }

  /* Horizontal legend that wraps. Returns height used. */
  function legend(C, items, x, y, maxW, alpha) {
    var ctx = C.ctx, u = C.u, S = C.S;
    var size = 22 * u, sw = 16 * u, gap = 26 * u, lh = 34 * u;
    setFont(ctx, S, size, 500);
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    var cx = x, cy = y;
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
    items.forEach(function (it) {
      var tw = sw + 8 * u + ctx.measureText(it.label).width;
      if (cx > x && cx + tw > x + maxW) { cx = x; cy += lh; }
      ctx.fillStyle = it.color; rrect(ctx, cx, cy + lh / 2 - sw / 2, sw, sw, 4 * u); ctx.fill();
      ctx.fillStyle = S.textColor; ctx.fillText(it.label, cx + sw + 8 * u, cy + lh / 2);
      cx += tw + gap;
    });
    ctx.restore();
    return cy - y + lh + 10 * u;
  }

  function measureLegend(C, items, maxW) {
    var ctx = C.ctx, u = C.u;
    setFont(ctx, C.S, 22 * u, 500);
    var cx = 0, rows = 1, sw = 16 * u, gap = 26 * u;
    items.forEach(function (it) {
      var tw = sw + 8 * u + ctx.measureText(it.label).width;
      if (cx > 0 && cx + tw > maxW) { cx = 0; rows++; }
      cx += tw + gap;
    });
    return rows * 34 * u + 10 * u;
  }

  function gridLine(ctx, x1, y1, x2, y2, color, width) {
    ctx.strokeStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }

  /* ------------------------------------------------------------------ */
  /* Templates                                                          */
  /* ------------------------------------------------------------------ */

  /* ------------------------------------------------------------------ */
  /* Icons (24×24 vector paths, filled with the even-odd rule)          */
  /* Any emoji can also be used as an icon.                             */
  /* ------------------------------------------------------------------ */

  var ICONS = {
    person: 'M12 2a4.5 4.5 0 1 1 0 9a4.5 4.5 0 0 1 0-9zM3.5 22v-2.5C3.5 15.4 7.3 13 12 13s8.5 2.4 8.5 6.5V22z',
    heart: 'M12 21.3s-7.6-4.7-9.8-9.4C.6 8.5 2.6 3.8 6.8 3.8c2.3 0 3.7 1.2 5.2 3.1c1.5-1.9 2.9-3.1 5.2-3.1c4.2 0 6.2 4.7 4.6 8.1C19.6 16.6 12 21.3 12 21.3z',
    star: 'M12 1.8l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.9l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z',
    house: 'M12 2.5l10 8.7h-2.8V21.5h-5.4v-6.3h-3.6v6.3H4.8V11.2H2z',
    drop: 'M12 1.8S4.8 10 4.8 15.2a7.2 7.2 0 0 0 14.4 0C19.2 10 12 1.8 12 1.8z',
    leaf: 'M21 2.5C10.5 2.5 4 7.5 4 15.2c0 1.6.4 3 1 4.2L2.6 21.8 4 23.2l2.4-2.4c1.3.7 2.8 1.1 4.4 1.1C18 21.9 21.6 14.4 21 2.5zM7.5 17.8C10 13 13.6 9.6 17.5 7.6C14.2 10.4 11.2 13.8 9 18.4z',
    bolt: 'M13.5 1.5L3.8 13.8h6.6l-1.4 8.7 9.7-12.4h-6.6z',
    car: 'M6.2 5.5h11.6l2.4 5.6c1.3.2 2.3 1.3 2.3 2.7V18h-2.1a2.6 2.6 0 0 1-5.2 0H8.8a2.6 2.6 0 0 1-5.2 0H1.5v-4.2c0-1.4 1-2.5 2.3-2.7zM7.6 7.6l-1.5 3.5h11.8l-1.5-3.5z',
    tree: 'M12 1.5l6.5 8.2h-3.2l5.2 7.3h-7.2v5.5h-2.6V17H3.5l5.2-7.3H5.5z',
    trophy: 'M5.5 2.5h13v2h3v2.8a4.6 4.6 0 0 1-4 4.6a6.5 6.5 0 0 1-4.2 3.6v3h3.7v3.5H7v-3.5h3.7v-3a6.5 6.5 0 0 1-4.2-3.6a4.6 4.6 0 0 1-4-4.6V4.5h3zM4.5 6.5v.8c0 1 .5 1.9 1.3 2.3c-.2-.9-.3-1.9-.3-3.1zM19.5 6.5h-1c0 1.2-.1 2.2-.3 3.1c.8-.4 1.3-1.3 1.3-2.3z',
    laptop: 'M4.5 4h15a1.2 1.2 0 0 1 1.2 1.2V15H3.3V5.2A1.2 1.2 0 0 1 4.5 4zM5.6 6.2v6.6h12.8V6.2zM1 16.5h22v1.2c0 1.1-.9 2.1-2 2.1H3c-1.1 0-2-1-2-2.1z',
    phone: 'M7.5 1.5h9a1.8 1.8 0 0 1 1.8 1.8v17.4a1.8 1.8 0 0 1-1.8 1.8h-9a1.8 1.8 0 0 1-1.8-1.8V3.3a1.8 1.8 0 0 1 1.8-1.8zM8 4.5v13.5h8V4.5zM10.5 19.2h3v1.4h-3z',
    sun: 'M12 6.5a5.5 5.5 0 1 1 0 11a5.5 5.5 0 0 1 0-11zM11 0h2v4.2h-2zM11 19.8h2V24h-2zM0 11h4.2v2H0zM19.8 11H24v2h-4.2zM3.5 2.1l3 3-1.4 1.4-3-3zM18.9 17.5l3 3-1.4 1.4-3-3zM2.1 20.5l3-3 1.4 1.4-3 3zM17.5 5.1l3-3 1.4 1.4-3 3z',
    pound: 'M12 1.5a10.5 10.5 0 1 1 0 21a10.5 10.5 0 0 1 0-21zM13.2 6c-2.4 0-4 1.6-4 3.9v1.4H8v1.8h1.2v.4c0 1.4-.5 2.4-1.4 3.1v1.3h8.4v-1.9h-5.3c.4-.7.6-1.5.6-2.5v-.4h2.6v-1.8h-2.6V9.9c0-1.2.7-2 1.8-2c.8 0 1.4.3 1.9.8l1-1.6C15.5 6.4 14.5 6 13.2 6z',
    globe: 'M12 1.5a10.5 10.5 0 1 1 0 21a10.5 10.5 0 0 1 0-21zM12 3.6c-1.1 1.3-2 3.6-2.3 6.6h4.6C14 7.2 13.1 4.9 12 3.6zM8 3.9a8.6 8.6 0 0 0-4.4 6.3h4.3C8.1 7.8 8.6 5.6 8 3.9zM16 3.9c.6 1.7.9 3.9.9 6.3h2.9h1.4A8.6 8.6 0 0 0 16 3.9zM3.6 12.2a8.6 8.6 0 0 0 4.4 6.3c-.5-1.7-.9-3.9-1-6.3zM9.7 12.2c.2 3 1.2 5.3 2.3 6.6c1.1-1.3 2.1-3.6 2.3-6.6zM17 12.2c-.1 2.4-.5 4.6-1 6.3a8.6 8.6 0 0 0 4.4-6.3z',
    book: 'M3 3.5c3.4-.6 6.3 0 9 1.8c2.7-1.8 5.6-2.4 9-1.8v16c-3.4-.6-6.3 0-9 1.8c-2.7-1.8-5.6-2.4-9-1.8zM5.2 5.5v11.8c2-.1 3.8.3 5.6 1.2V6.7C9 5.8 7.2 5.4 5.2 5.5zM13.2 6.7v11.8c1.8-.9 3.6-1.3 5.6-1.2V5.5c-2-.1-3.8.3-5.6 1.2z',
    chat: 'M4 3h16a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2H10l-5.5 4.5v-4.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
    check: 'M12 1.5a10.5 10.5 0 1 1 0 21a10.5 10.5 0 0 1 0-21zM10.4 13.6l-3-3-1.7 1.7 4.7 4.7 8-8-1.7-1.7z',
    circle: 'M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20z',
    square: 'M3 3h18v18H3z'
  };
  var ICON_ALIASES = {
    people: 'person', user: 'person', man: 'person', woman: 'person', human: 'person', staff: 'person',
    home: 'house', building: 'house', water: 'drop', rain: 'drop', energy: 'bolt', electricity: 'bolt', power: 'bolt',
    love: 'heart', health: 'heart', computer: 'laptop', mobile: 'phone', award: 'trophy', prize: 'trophy', winner: 'trophy',
    plant: 'leaf', nature: 'leaf', forest: 'tree', money: 'pound', cost: 'pound', world: 'globe', earth: 'globe',
    education: 'book', learning: 'book', message: 'chat', comment: 'chat', yes: 'check', done: 'check', dot: 'circle', block: 'square'
  };
  var ICON_NAMES = Object.keys(ICONS);
  var iconCache = {};

  /* ---------------- Uploaded images ----------------
   * project.images = { 'file name.jpg': 'data:image/...' }. Any cell or
   * setting that accepts an icon also accepts an uploaded image's file name
   * (with or without the extension). */
  var IMG = { raw: null, list: {}, shape: 'circle', cache: {}, listeners: [] };
  function setImageLibrary(images, shape) {
    IMG.shape = shape || 'circle';
    if (images === IMG.raw) return;
    IMG.raw = images; IMG.list = {};
    if (images) Object.keys(images).forEach(function (k) { IMG.list[k.trim().toLowerCase()] = images[k]; });
  }
  function imgElement(src) {
    var img = IMG.cache[src];
    if (!img) {
      img = new Image();
      img.onload = function () { IMG.listeners.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); };
      img.src = src; IMG.cache[src] = img;
    }
    return img;
  }
  function findImage(name) {
    var k = String(name == null ? '' : name).trim().toLowerCase();
    if (!k) return null;
    var src = IMG.list[k];
    if (!src) for (var key in IMG.list) { if (key.replace(/\.[a-z0-9]+$/, '') === k) { src = IMG.list[key]; break; } }
    return src ? imgElement(src) : null;
  }
  function imgReady(img) { return img && img.complete && img.naturalWidth > 0; }
  function preloadImages(project) {
    var srcs = project && project.images ? Object.keys(project.images).map(function (k) { return project.images[k]; }) : [];
    return Promise.all(srcs.map(function (src) {
      return new Promise(function (res) {
        var img = imgElement(src);
        if (img.complete) res(); else { img.addEventListener('load', res); img.addEventListener('error', res); }
      });
    }));
  }
  function onImageLoad(cb) { IMG.listeners.push(cb); }
  /* Draws an image into a box: 'cover' crops to fill, 'contain' fits inside. */
  function drawCover(ctx, img, x, y, w, h, fit) {
    var iw = img.naturalWidth, ih = img.naturalHeight; if (!iw || !ih || w <= 0 || h <= 0) return;
    if (fit === 'contain') { var s0 = Math.min(w / iw, h / ih); ctx.drawImage(img, x + (w - iw * s0) / 2, y + (h - ih * s0) / 2, iw * s0, ih * s0); return; }
    var s = Math.max(w / iw, h / ih), sw = w / s, sh = h / s;
    ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
  }
  function shapeClip(ctx, x, y, size, shape) {
    ctx.beginPath();
    if (shape === 'circle') ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    else if (shape === 'rounded') { var r = size * 0.2; ctx.moveTo(x + r, y); ctx.arcTo(x + size, y, x + size, y + size, r); ctx.arcTo(x + size, y + size, x, y + size, r); ctx.arcTo(x, y + size, x, y, r); ctx.arcTo(x, y, x + size, y, r); ctx.closePath(); }
    else ctx.rect(x, y, size, size);
    ctx.clip();
  }
  function alphaOf(col) { var m = String(col).match(/rgba\([^)]*,\s*([\d.]+)\)/); return m ? +m[1] : 1; }
  /* A round badge: a photo filling the circle, or a coloured circle with an icon. */
  function avatar(ctx, name, cx, cy, d, bg, fg) {
    var im = findImage(name);
    if (im) {
      if (!imgReady(im)) return;
      ctx.save(); shapeClip(ctx, cx - d / 2, cy - d / 2, d, IMG.shape === 'original' ? 'circle' : IMG.shape);
      drawCover(ctx, im, cx - d / 2, cy - d / 2, d, d); ctx.restore(); return;
    }
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(cx, cy, d / 2, 0, Math.PI * 2); ctx.fill();
    drawIcon(ctx, name, cx - d * 0.3, cy - d * 0.3, d * 0.6, fg, 'circle');
  }

  function resolveIcon(name) {
    if (findImage(name)) return { image: findImage(name) };
    var n = String(name == null ? '' : name).trim();
    var key = n.toLowerCase();
    if (ICONS[key]) return { path: key };
    if (ICON_ALIASES[key]) return { path: ICON_ALIASES[key] };
    if (n && /[^\x00-\x7F]/.test(n)) return { emoji: n };
    return null;
  }

  /* Draws an icon with its top-left corner at (x, y). */
  function drawIcon(ctx, name, x, y, size, color, fallback) {
    var ic = resolveIcon(name) || resolveIcon(fallback) || { path: 'circle' };
    if (ic.image) {
      if (!imgReady(ic.image)) return;
      ctx.save();
      if (alphaOf(color) < 0.5) ctx.globalAlpha *= 0.18;
      if (IMG.shape === 'original') drawCover(ctx, ic.image, x, y, size, size, 'contain');
      else { shapeClip(ctx, x, y, size, IMG.shape); drawCover(ctx, ic.image, x, y, size, size); }
      ctx.restore();
      return;
    }
    if (ic.emoji) {
      ctx.save();
      ctx.font = (size * 0.86).toFixed(2) + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(ic.emoji, x + size / 2, y + size * 0.54);
      ctx.restore();
      return;
    }
    if (!iconCache[ic.path]) iconCache[ic.path] = new Path2D(ICONS[ic.path]);
    ctx.save();
    ctx.translate(x, y); ctx.scale(size / 24, size / 24);
    ctx.fillStyle = color;
    ctx.fill(iconCache[ic.path], 'evenodd');
    ctx.restore();
  }

  function hash(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* Picks black or white text for a given background colour */
  function contrastText(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    if (!isFinite(n)) return '#ffffff';
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? '#1f2430' : '#ffffff';
  }

  function decimalsOf(raw) {
    var m = String(raw == null ? '' : raw).replace(/,/g, '').match(/\.(\d+)/);
    return m ? m[1].length : 0;
  }

  var TEMPLATES = {};

  /* ---------------- Bar chart race ---------------- */
  TEMPLATES.barRace = {
    name: 'Bar chart race',
    description: 'Ranked bars that overtake each other over time',
    dataHint: 'First column: names. Each further column is one time period (the header is the period label, e.g. a year). Cells are the values. To show a picture on a bar, upload an image with the same name (e.g. Cobalt.png).',
    settings: [
      { group: 'Bars', key: 'topN', label: 'Bars shown', type: 'number', def: 10, min: 2, max: 40, step: 1 },
      { group: 'Bars', key: 'barGap', label: 'Gap between bars', type: 'range', def: 0.22, min: 0, max: 0.7, step: 0.01 },
      { group: 'Bars', key: 'barRadius', label: 'Corner radius', type: 'range', def: 6, min: 0, max: 30, step: 1 },
      { group: 'Bars', key: 'labelsInside', label: 'Names inside bars', type: 'checkbox', def: false },
      { group: 'Bars', key: 'showPeriod', label: 'Show big period label', type: 'checkbox', def: true },
      { group: 'Bars', key: 'showGrid', label: 'Show gridlines', type: 'checkbox', def: true },
      { group: 'Bars', key: 'showTotal', label: 'Show total under period', type: 'checkbox', def: false },
      { group: 'Bars', key: 'showImages', label: 'Show images on bars (uploaded images named like the bars)', type: 'checkbox', def: true }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u, T = C.T;
      var header = T[0] || [];
      var periods = header.slice(1);
      var rows = cleanRows(T);
      var n = periods.length;
      if (!n || !rows.length) return noData(C, R);
      var color = colorer(S);
      var items = rows.map(function (r, i) {
        var vals = [];
        for (var k = 0; k < n; k++) { var v = num(r[k + 1]); vals.push(v); }
        // carry values forward/backward over blanks so bars do not vanish
        for (var k2 = 1; k2 < n; k2++) if (!isFinite(vals[k2])) vals[k2] = vals[k2 - 1];
        for (var k3 = n - 2; k3 >= 0; k3--) if (!isFinite(vals[k3])) vals[k3] = vals[k3 + 1];
        return { label: String(r[0]), vals: vals, color: color(r[0], i) };
      });
      function ranksAt(k) {
        var order = items.map(function (it, i) { return i; });
        order.sort(function (a, b) {
          var va = isFinite(items[a].vals[k]) ? items[a].vals[k] : -Infinity;
          var vb = isFinite(items[b].vals[k]) ? items[b].vals[k] : -Infinity;
          return vb - va || a - b;
        });
        var r = new Array(items.length);
        order.forEach(function (idx, pos) { r[idx] = pos; });
        return r;
      }
      var f = C.pLinear * (n - 1);
      var i0 = Math.floor(f), i1 = Math.min(i0 + 1, n - 1), fr = f - i0;
      var e = C.ease(fr);
      var r0 = ranksAt(i0), r1 = ranksAt(i1);
      var topN = Math.max(1, S.topN | 0);

      var maxAt = function (k) { var m = 0; items.forEach(function (it) { if (isFinite(it.vals[k])) m = Math.max(m, it.vals[k]); }); return m; };
      var maxV = lerp(maxAt(i0), maxAt(i1), fr) || 1;

      // Layout
      var tickH = S.showGrid ? 34 * u : 6 * u;
      var plot = { x: R.x, y: R.y + tickH, w: R.w, h: R.h - tickH };
      var rowH = plot.h / topN;
      var barH = rowH * (1 - S.barGap);
      var labelSize = clamp(barH * 0.42, 12 * u, 30 * u);
      setFont(ctx, S, labelSize, 600);
      var labelW = 0;
      if (!S.labelsInside) {
        items.forEach(function (it) { labelW = Math.max(labelW, ctx.measureText(it.label).width); });
        labelW = Math.min(labelW, R.w * 0.28) + 14 * u;
      }
      setFont(ctx, S, labelSize, 500);
      var valueW = ctx.measureText(fmt(maxV * 1.1, S)).width + 18 * u;
      var x0 = plot.x + labelW;
      var barMaxW = Math.max(10, plot.w - labelW - valueW);

      // Gridlines
      if (S.showGrid) {
        var nt = niceTicks(0, maxV, Math.max(3, Math.round(barMaxW / (260 * u))));
        setFont(ctx, S, 18 * u, 500);
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        nt.ticks.forEach(function (tv) {
          if (tv > maxV * 1.0001) return;
          var gx = x0 + tv / maxV * barMaxW;
          gridLine(ctx, gx, plot.y, gx, plot.y + plot.h, withAlpha(S.textColor, 0.1), 1.5 * u);
          ctx.fillStyle = withAlpha(S.textColor, 0.55);
          ctx.fillText(fmtTick(tv, S, nt.step), gx, plot.y - 8 * u);
        });
      }

      // Big period label
      var periodIdx = Math.round(f);
      if (S.showPeriod) {
        var ps = clamp(Math.min(R.w, R.h) * 0.16, 30 * u, 170 * u);
        setFont(ctx, S, ps, 800);
        ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = withAlpha(S.textColor, 0.22);
        var py = plot.y + plot.h - 6 * u;
        if (S.showTotal) py -= 44 * u;
        ctx.fillText(String(periods[periodIdx] || ''), plot.x + plot.w - 6 * u, py);
        if (S.showTotal) {
          var tot = 0; items.forEach(function (it) { var v = lerp(it.vals[i0], it.vals[i1], fr); if (isFinite(v)) tot += v; });
          setFont(ctx, S, 32 * u, 600);
          ctx.fillStyle = withAlpha(S.textColor, 0.45);
          ctx.fillText('Total: ' + fmt(tot, S), plot.x + plot.w - 6 * u, plot.y + plot.h - 6 * u);
        }
      }

      // Bars — draw lowest ranks first so leaders sit on top during swaps
      var drawList = items.map(function (it, i) {
        var v = lerp(it.vals[i0], it.vals[i1], fr);
        var rk = lerp(r0[i], r1[i], e);
        return { it: it, v: v, rk: rk };
      }).filter(function (d) { return d.rk < topN + 0.999 && isFinite(d.v); })
        .sort(function (a, b) { return b.rk - a.rk; });

      ctx.save();
      ctx.beginPath(); ctx.rect(R.x - 2, plot.y, R.w + 4, plot.h + 2); ctx.clip();
      drawList.forEach(function (d) {
        var alpha = clamp(topN - d.rk, 0, 1);
        var y = plot.y + d.rk * rowH + (rowH - barH) / 2;
        var bw = Math.max(0, d.v / maxV * barMaxW);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = d.it.color;
        rrect(ctx, x0, y, Math.max(bw, 2 * u), barH, S.barRadius * u);
        ctx.fill();
        ctx.textBaseline = 'middle';
        setFont(ctx, S, labelSize, 600);
        if (S.labelsInside) {
          var lw = ctx.measureText(d.it.label).width;
          if (lw + 24 * u < bw) {
            ctx.textAlign = 'right'; ctx.fillStyle = '#ffffff';
            ctx.fillText(d.it.label, x0 + bw - 12 * u, y + barH / 2);
          } else {
            ctx.textAlign = 'left'; ctx.fillStyle = S.textColor;
            ctx.fillText(d.it.label, x0 + bw + 10 * u, y + barH / 2 - labelSize * 0.55);
          }
        } else {
          ctx.textAlign = 'right'; ctx.fillStyle = S.textColor;
          ctx.fillText(ellipsis(ctx, d.it.label, labelW - 14 * u), x0 - 12 * u, y + barH / 2);
        }
        var barImg = S.showImages ? findImage(d.it.label) : null, imgShift = 0;
        if (imgReady(barImg)) {
          var idm = barH * 0.86, inside = bw > idm * 1.6;
          var ix = inside ? x0 + bw - idm - barH * 0.07 : x0 + bw + 8 * u, iy = y + (barH - idm) / 2;
          ctx.save(); shapeClip(ctx, ix, iy, idm, IMG.shape === 'original' ? 'rounded' : IMG.shape); drawCover(ctx, barImg, ix, iy, idm, idm); ctx.restore();
          if (!inside) imgShift = idm + 8 * u;
        }
        setFont(ctx, S, labelSize, 500);
        ctx.textAlign = 'left'; ctx.fillStyle = withAlpha(S.textColor, 0.85);
        var vy = (S.labelsInside && ctx.measureText(d.it.label).width + 24 * u >= bw) ? y + barH / 2 + labelSize * 0.55 : y + barH / 2;
        ctx.fillText(fmt(d.v, S), x0 + bw + 10 * u + imgShift, vy);
      });
      ctx.restore();
    }
  };

  /* ---------------- Line chart ---------------- */
  TEMPLATES.line = {
    name: 'Line chart',
    description: 'Lines that draw themselves; rank mode makes a line race',
    dataHint: 'First column: x values (dates, years or labels). Each further column is one line; the header is its name.',
    settings: [
      { group: 'Lines', key: 'lineWidth', label: 'Line width', type: 'range', def: 5, min: 1, max: 14, step: 0.5 },
      { group: 'Lines', key: 'curve', label: 'Smooth curves', type: 'checkbox', def: true },
      { group: 'Lines', key: 'area', label: 'Shade under lines', type: 'checkbox', def: false },
      { group: 'Lines', key: 'endLabels', label: 'Labels at line ends', type: 'checkbox', def: true },
      { group: 'Lines', key: 'showLegend', label: 'Show legend', type: 'checkbox', def: false },
      { group: 'Lines', key: 'zeroBase', label: 'Y axis starts at zero', type: 'checkbox', def: true },
      { group: 'Lines', key: 'rescaleY', label: 'Y axis follows the data', type: 'checkbox', def: false },
      { group: 'Lines', key: 'yTitle', label: 'Y axis title', type: 'text', def: '' },
      { group: 'Lines', key: 'rankMode', label: 'Show rank instead of value (line race / bump chart)', type: 'checkbox', def: false }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u, T = C.T;
      var header = T[0] || [];
      var rows = cleanRows(T);
      var names = header.slice(1);
      if (rows.length < 2 || !names.length) return noData(C, R);
      var color = colorer(S);
      var series = names.map(function (nm, j) {
        return { name: String(nm), color: color(nm, j), vals: rows.map(function (r) { return num(r[j + 1]); }) };
      });
      if (S.rankMode) {
        rows.forEach(function (_, i) {
          var order = series.map(function (s, j) { return j; }).filter(function (j) { return isFinite(series[j].vals[i]); })
            .sort(function (a, b) { return series[b].vals[i] - series[a].vals[i]; });
          var rk = {}; order.forEach(function (j, pos) { rk[j] = pos + 1; });
          series.forEach(function (s, j) { s.vals[i] = rk[j] ? -rk[j] : NaN; });
        });
      }
      var xs = rows.map(function (r) { return r[0]; });
      var numericX = xs.every(function (x) { return isFinite(num(x)); });
      var xv = numericX ? xs.map(num) : xs.map(function (_, i) { return i; });
      var xMin = Math.min.apply(null, xv), xMax = Math.max.apply(null, xv);
      if (xMax === xMin) xMax = xMin + 1;
      var n = rows.length;

      var head = C.pEased * (n - 1);
      var hi0 = Math.floor(head), hfr = head - hi0;

      function rangeUpTo(k) {
        var lo = Infinity, hi = -Infinity;
        series.forEach(function (s) {
          for (var i = 0; i <= Math.min(k, n - 1); i++) { var v = s.vals[i]; if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
        });
        return [lo, hi];
      }
      var rg;
      if (S.rescaleY && !S.rankMode) {
        var a = rangeUpTo(hi0), b = rangeUpTo(Math.min(hi0 + 1, n - 1));
        rg = [lerp(a[0], b[0], hfr), lerp(a[1], b[1], hfr)];
      } else rg = rangeUpTo(n - 1);
      if (!isFinite(rg[0])) rg = [0, 1];
      if (S.zeroBase && !S.rankMode) { rg[0] = Math.min(0, rg[0]); rg[1] = Math.max(0, rg[1]); }
      var nt = niceTicks(rg[0], rg[1], 5);
      if (S.rankMode) { nt = { ticks: [], lo: -series.length - 0.4, hi: -0.6, step: 1 }; for (var q = 1; q <= series.length; q++) nt.ticks.push(-q); }
      var yf = S.rankMode ? function (v) { return '#' + (-Math.round(v)); } : function (v) { return fmtTick(v, S, nt.step); };
      var rescale = S.rescaleY && !S.rankMode;
      var yLo = rescale ? Math.min(rg[0], nt.lo) : nt.lo, yHi = rescale ? Math.max(rg[1], rg[1] + (rg[1] - rg[0]) * 0.05) : nt.hi;

      // Legend
      var top = R.y;
      var legItems = series.map(function (s) { return { label: s.name, color: s.color }; });
      if (S.showLegend || !S.endLabels) top += legend(C, legItems, R.x, R.y, R.w);

      // Axes layout
      setFont(ctx, S, 20 * u, 500);
      var yLabW = 0;
      nt.ticks.forEach(function (tv) { yLabW = Math.max(yLabW, ctx.measureText(yf(tv)).width); });
      var leftPad = yLabW + 16 * u + (S.yTitle ? 34 * u : 0);
      var rightPad = 20 * u;
      if (S.endLabels) {
        setFont(ctx, S, 22 * u, 700);
        var ew = 0; series.forEach(function (s) { ew = Math.max(ew, ctx.measureText(s.name).width); });
        rightPad = Math.min(R.w * 0.3, ew + 36 * u);
      }
      var P = { x: R.x + leftPad, y: top + 10 * u, w: R.w - leftPad - rightPad, h: R.y + R.h - top - 10 * u - 40 * u };
      var X = function (v) { return P.x + (v - xMin) / (xMax - xMin) * P.w; };
      var Y = function (v) { return P.y + P.h - (v - yLo) / (yHi - yLo) * P.h; };

      // Y grid
      setFont(ctx, S, 20 * u, 500);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      nt.ticks.forEach(function (tv) {
        if (tv < yLo - 1e-9 || tv > yHi + 1e-9) return;
        var gy = Y(tv);
        gridLine(ctx, P.x, gy, P.x + P.w, gy, withAlpha(S.textColor, tv === 0 ? 0.35 : 0.1), (tv === 0 ? 2 : 1.5) * u);
        ctx.fillStyle = withAlpha(S.textColor, 0.55);
        ctx.fillText(yf(tv), P.x - 12 * u, gy);
      });
      if (S.yTitle) {
        ctx.save(); ctx.translate(R.x + 12 * u, P.y + P.h / 2); ctx.rotate(-Math.PI / 2);
        setFont(ctx, S, 20 * u, 600); ctx.textAlign = 'center'; ctx.fillStyle = withAlpha(S.textColor, 0.7);
        ctx.fillText(S.yTitle, 0, 0); ctx.restore();
      }
      // X labels
      setFont(ctx, S, 20 * u, 500);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = withAlpha(S.textColor, 0.6);
      var maxLabW = 0; xs.forEach(function (x) { maxLabW = Math.max(maxLabW, ctx.measureText(String(x)).width); });
      var every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(P.w / (maxLabW + 30 * u)))));
      for (var i = 0; i < n; i += every) ctx.fillText(String(xs[i]), X(xv[i]), P.y + P.h + 12 * u);

      // Lines
      var heads = [];
      series.forEach(function (s) {
        var pts = [];
        for (var i = 0; i <= Math.min(hi0, n - 1); i++) if (isFinite(s.vals[i])) pts.push([X(xv[i]), Y(s.vals[i]), s.vals[i]]);
        if (hi0 + 1 < n && isFinite(s.vals[hi0]) && isFinite(s.vals[hi0 + 1])) {
          var hv = lerp(s.vals[hi0], s.vals[hi0 + 1], hfr);
          pts.push([lerp(X(xv[hi0]), X(xv[hi0 + 1]), hfr), Y(hv), hv]);
        }
        if (!pts.length) return;
        ctx.save();
        ctx.beginPath(); ctx.rect(P.x - 20 * u, P.y - 40 * u, P.w + 40 * u, P.h + 40 * u); ctx.clip();
        function path() {
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (var k = 1; k < pts.length; k++) {
            if (S.curve) {
              var p0 = pts[k - 2] || pts[k - 1], p1 = pts[k - 1], p2 = pts[k], p3 = pts[k + 1] || p2;
              var t = 0.18;
              ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t,
                p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
            } else ctx.lineTo(pts[k][0], pts[k][1]);
          }
        }
        if (S.area && pts.length > 1) {
          ctx.beginPath(); path();
          ctx.lineTo(pts[pts.length - 1][0], Y(Math.max(yLo, 0))); ctx.lineTo(pts[0][0], Y(Math.max(yLo, 0))); ctx.closePath();
          ctx.fillStyle = withAlpha(s.color, 0.14); ctx.fill();
        }
        ctx.beginPath(); path();
        ctx.strokeStyle = s.color; ctx.lineWidth = S.lineWidth * u; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.stroke();
        var last = pts[pts.length - 1];
        ctx.beginPath(); ctx.arc(last[0], last[1], S.lineWidth * u * 1.4 + 3 * u, 0, Math.PI * 2);
        ctx.fillStyle = s.color; ctx.fill();
        ctx.restore();
        heads.push({ x: last[0], y: last[1], v: last[2], s: s });
      });

      // End labels with simple collision avoidance
      if (S.endLabels && heads.length) {
        var lh = 48 * u;
        heads.sort(function (a, b) { return a.y - b.y; });
        heads.forEach(function (h) { h.ly = h.y; });
        for (var it = 0; it < 30; it++) {
          for (var k = 1; k < heads.length; k++) {
            var d = heads[k].ly - heads[k - 1].ly;
            if (d < lh) { var push = (lh - d) / 2; heads[k].ly += push; heads[k - 1].ly -= push; }
          }
        }
        heads.forEach(function (h) {
          var lx = h.x + 16 * u;
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          setFont(ctx, S, 22 * u, 700); ctx.fillStyle = h.s.color;
          ctx.fillText(ellipsis(ctx, h.s.name, rightPad - 10 * u + (P.x + P.w - h.x)), lx, h.ly - 12 * u);
          setFont(ctx, S, 20 * u, 500); ctx.fillStyle = withAlpha(S.textColor, 0.75);
          ctx.fillText(S.rankMode ? '#' + (-Math.round(h.v)) : fmt(h.v, S), lx, h.ly + 13 * u);
        });
      }
    }
  };

  /* ---------------- Column / bar chart ---------------- */
  TEMPLATES.columns = {
    name: 'Column chart',
    description: 'Grouped columns or bars that grow in',
    dataHint: 'First column: category names. Each further column is a series (its header appears in the legend).',
    settings: [
      { group: 'Columns', key: 'horizontal', label: 'Horizontal bars', type: 'checkbox', def: false },
      { group: 'Columns', key: 'stacked', label: 'Stacked', type: 'checkbox', def: false },
      { group: 'Columns', key: 'sort', label: 'Sort', type: 'select', def: 'none', options: ['none', 'descending', 'ascending'] },
      { group: 'Columns', key: 'showValues', label: 'Value labels', type: 'checkbox', def: true },
      { group: 'Columns', key: 'barRadius', label: 'Corner radius', type: 'range', def: 6, min: 0, max: 30, step: 1 },
      { group: 'Columns', key: 'groupGap', label: 'Gap between groups', type: 'range', def: 0.3, min: 0.05, max: 0.8, step: 0.01 },
      { group: 'Columns', key: 'stagger', label: 'Stagger animation', type: 'range', def: 0.5, min: 0, max: 0.9, step: 0.05 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u, T = C.T;
      var header = T[0] || [];
      var names = header.slice(1);
      var rows = cleanRows(T);
      if (!rows.length || !names.length) return noData(C, R);
      var color = colorer(S);
      var multi = names.length > 1;
      var cats = rows.map(function (r) { return { label: String(r[0]), vals: names.map(function (_, j) { return num(r[j + 1]); }) }; });
      var sumOf = function (c) { return c.vals.reduce(function (a, v) { return a + (isFinite(v) ? v : 0); }, 0); };
      if (S.sort === 'descending') cats.sort(function (a, b) { return sumOf(b) - sumOf(a); });
      if (S.sort === 'ascending') cats.sort(function (a, b) { return sumOf(a) - sumOf(b); });
      var nc = cats.length, ns = names.length;

      var lo = 0, hi = 0;
      cats.forEach(function (c) {
        if (S.stacked) {
          var pos = 0, neg = 0;
          c.vals.forEach(function (v) { if (isFinite(v)) { if (v >= 0) pos += v; else neg += v; } });
          hi = Math.max(hi, pos); lo = Math.min(lo, neg);
        } else c.vals.forEach(function (v) { if (isFinite(v)) { hi = Math.max(hi, v); lo = Math.min(lo, v); } });
      });
      var nt = niceTicks(lo, hi, 5);

      var top = R.y;
      if (multi) top += legend(C, names.map(function (nm, j) { return { label: String(nm), color: color(nm, j) }; }), R.x, R.y, R.w);
      var serColor = names.map(function (nm, j) { return multi ? color(nm, j) : null; });

      setFont(ctx, S, 20 * u, 500);
      var tickW = 0; nt.ticks.forEach(function (tv) { tickW = Math.max(tickW, ctx.measureText(fmtTick(tv, S, nt.step)).width); });
      var catW = 0; cats.forEach(function (c) { catW = Math.max(catW, ctx.measureText(c.label).width); });

      var stagger = S.stagger;
      var local = function (ci) {
        var start = nc > 1 ? (ci / (nc - 1)) * stagger : 0;
        return C.ease(clamp((C.pLinear - start) / (1 - stagger), 0, 1));
      };

      if (!S.horizontal) {
        var P = { x: R.x + tickW + 16 * u, y: top + 30 * u, w: R.w - tickW - 16 * u, h: R.y + R.h - top - 30 * u - 46 * u };
        var Y = function (v) { return P.y + P.h - (v - nt.lo) / (nt.hi - nt.lo) * P.h; };
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        nt.ticks.forEach(function (tv) {
          gridLine(ctx, P.x, Y(tv), P.x + P.w, Y(tv), withAlpha(S.textColor, tv === 0 ? 0.35 : 0.1), (tv === 0 ? 2 : 1.5) * u);
          ctx.fillStyle = withAlpha(S.textColor, 0.55); setFont(ctx, S, 20 * u, 500);
          ctx.fillText(fmtTick(tv, S, nt.step), P.x - 12 * u, Y(tv));
        });
        var gw = P.w / nc, inner = gw * (1 - S.groupGap);
        var bw = S.stacked ? inner : inner / ns;
        var labSize = clamp(Math.min(22 * u, gw * 0.22), 11 * u, 22 * u);
        cats.forEach(function (c, ci) {
          var k = local(ci);
          var gx = P.x + ci * gw + (gw - inner) / 2;
          var posAcc = 0, negAcc = 0;
          c.vals.forEach(function (v, j) {
            if (!isFinite(v)) return;
            var vv = v * k, x = S.stacked ? gx : gx + j * bw, y0, y1;
            if (S.stacked) { if (vv >= 0) { y0 = posAcc; posAcc += vv; y1 = posAcc; } else { y0 = negAcc; negAcc += vv; y1 = negAcc; } }
            else { y0 = 0; y1 = vv; }
            ctx.fillStyle = serColor[j] || color(c.label, ci);
            var pad = S.stacked ? 0 : Math.min(3 * u, bw * 0.08);
            rrect(ctx, x + pad, Y(Math.max(y0, y1)), bw - pad * 2, Math.max(0.5, Math.abs(Y(y1) - Y(y0))), S.stacked ? 0 : S.barRadius * u);
            ctx.fill();
            if (S.showValues && !S.stacked && bw > 26 * u && k > 0.02) {
              setFont(ctx, S, clamp(bw * 0.3, 11 * u, 22 * u), 600);
              ctx.textAlign = 'center'; ctx.textBaseline = vv >= 0 ? 'bottom' : 'top';
              ctx.fillStyle = withAlpha(S.textColor, 0.85 * k);
              ctx.fillText(fmt(vv, S), x + bw / 2, Y(vv) + (vv >= 0 ? -6 * u : 6 * u));
            }
          });
          if (S.showValues && S.stacked && k > 0.02) {
            setFont(ctx, S, labSize, 600); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillStyle = withAlpha(S.textColor, 0.85 * k);
            ctx.fillText(fmt(posAcc + negAcc, S), gx + inner / 2, Y(posAcc) - 6 * u);
          }
          setFont(ctx, S, labSize, 500);
          ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = withAlpha(S.textColor, 0.75);
          var ls = wrap(ctx, c.label, gw - 6 * u).slice(0, 2);
          ls.forEach(function (l, li) { ctx.fillText(ellipsis(ctx, l, gw - 4 * u), gx + inner / 2, P.y + P.h + 10 * u + li * labSize * 1.15); });
        });
      } else {
        var labW = Math.min(catW + 16 * u, R.w * 0.3);
        var P2 = { x: R.x + labW, y: top + 34 * u, w: R.w - labW - 90 * u, h: R.y + R.h - top - 34 * u };
        var X = function (v) { return P2.x + (v - nt.lo) / (nt.hi - nt.lo) * P2.w; };
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        nt.ticks.forEach(function (tv) {
          gridLine(ctx, X(tv), P2.y, X(tv), P2.y + P2.h, withAlpha(S.textColor, tv === 0 ? 0.35 : 0.1), (tv === 0 ? 2 : 1.5) * u);
          ctx.fillStyle = withAlpha(S.textColor, 0.55); setFont(ctx, S, 20 * u, 500);
          ctx.fillText(fmtTick(tv, S, nt.step), X(tv), P2.y - 8 * u);
        });
        var gh = P2.h / nc, innerH = gh * (1 - S.groupGap);
        var bh = S.stacked ? innerH : innerH / ns;
        var labSize2 = clamp(gh * 0.35, 11 * u, 24 * u);
        cats.forEach(function (c, ci) {
          var k = local(ci);
          var gy = P2.y + ci * gh + (gh - innerH) / 2;
          var posAcc = 0, negAcc = 0;
          c.vals.forEach(function (v, j) {
            if (!isFinite(v)) return;
            var vv = v * k, y = S.stacked ? gy : gy + j * bh, x0, x1;
            if (S.stacked) { if (vv >= 0) { x0 = posAcc; posAcc += vv; x1 = posAcc; } else { x0 = negAcc; negAcc += vv; x1 = negAcc; } }
            else { x0 = 0; x1 = vv; }
            ctx.fillStyle = serColor[j] || color(c.label, ci);
            var pad = S.stacked ? 0 : Math.min(3 * u, bh * 0.08);
            rrect(ctx, X(Math.min(x0, x1)), y + pad, Math.max(0.5, Math.abs(X(x1) - X(x0))), bh - pad * 2, S.stacked ? 0 : S.barRadius * u);
            ctx.fill();
            if (S.showValues && !S.stacked && bh > 18 * u && k > 0.02) {
              setFont(ctx, S, clamp(bh * 0.5, 11 * u, 22 * u), 600);
              ctx.textAlign = vv >= 0 ? 'left' : 'right'; ctx.textBaseline = 'middle';
              ctx.fillStyle = withAlpha(S.textColor, 0.85 * k);
              ctx.fillText(fmt(vv, S), X(vv) + (vv >= 0 ? 8 * u : -8 * u), y + bh / 2);
            }
          });
          if (S.showValues && S.stacked && k > 0.02) {
            setFont(ctx, S, labSize2, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
            ctx.fillStyle = withAlpha(S.textColor, 0.85 * k);
            ctx.fillText(fmt(posAcc + negAcc, S), X(posAcc) + 8 * u, gy + innerH / 2);
          }
          setFont(ctx, S, labSize2, 500);
          ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillStyle = withAlpha(S.textColor, 0.8);
          ctx.fillText(ellipsis(ctx, c.label, labW - 16 * u), P2.x - 12 * u, gy + innerH / 2);
        });
      }
    }
  };

  /* ---------------- Donut / pie ---------------- */
  TEMPLATES.donut = {
    name: 'Donut / pie',
    description: 'Slices that sweep into place',
    dataHint: 'First column: slice names. Second column: values.',
    settings: [
      { group: 'Donut', key: 'innerRadius', label: 'Hole size (0 = pie)', type: 'range', def: 0.58, min: 0, max: 0.9, step: 0.01 },
      { group: 'Donut', key: 'showCenter', label: 'Show total in centre', type: 'checkbox', def: true },
      { group: 'Donut', key: 'centerLabel', label: 'Centre caption', type: 'text', def: 'Total' },
      { group: 'Donut', key: 'showPercent', label: 'Show percentages in legend', type: 'checkbox', def: true },
      { group: 'Donut', key: 'sortSlices', label: 'Sort largest first', type: 'checkbox', def: true },
      { group: 'Donut', key: 'sliceGap', label: 'Gap between slices', type: 'range', def: 2, min: 0, max: 12, step: 0.5 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u, T = C.T;
      var rows = cleanRows(T);
      var color = colorer(S);
      var slices = rows.map(function (r, i) { return { label: String(r[0]), v: Math.max(0, num(r[1])), color: color(r[0], i) }; })
        .filter(function (s) { return isFinite(s.v) && s.v > 0; });
      if (!slices.length) return noData(C, R);
      if (S.sortSlices) slices.sort(function (a, b) { return b.v - a.v; });
      var total = slices.reduce(function (a, s) { return a + s.v; }, 0);

      var landscape = R.w > R.h * 1.15;
      var legW = landscape ? R.w * 0.42 : R.w;
      var rowH = 44 * u;
      var legH = landscape ? R.h : Math.min(R.h * 0.4, slices.length * rowH);
      var area = landscape ? { x: R.x, y: R.y, w: R.w - legW, h: R.h } : { x: R.x, y: R.y, w: R.w, h: R.h - legH - 20 * u };
      var cx = area.x + area.w / 2, cy = area.y + area.h / 2;
      var rad = Math.min(area.w, area.h) / 2 * 0.95;
      var inner = rad * S.innerRadius;
      var sweep = C.pEased * Math.PI * 2;
      var a = -Math.PI / 2;
      var gap = S.sliceGap * u;

      slices.forEach(function (s, i) {
        var span = s.v / total * Math.PI * 2;
        var start = a, end = Math.min(a + span, -Math.PI / 2 + sweep);
        a += span;
        if (end <= start) return;
        var gA = gap / rad / 2;
        var s0 = start + gA, e0 = Math.max(s0, end - gA);
        ctx.beginPath();
        ctx.arc(cx, cy, rad, s0, e0);
        if (inner > 0) { var gi = gap / Math.max(inner, 1) / 2; ctx.arc(cx, cy, inner, Math.max(start + gi, end - gi), start + gi, true); }
        else ctx.lineTo(cx, cy);
        ctx.closePath();
        ctx.fillStyle = s.color; ctx.fill();
      });

      if (S.showCenter && inner > 60 * u) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        var shown = total * C.pEased;
        var size = Math.min(inner * 0.42, 80 * u);
        setFont(ctx, S, size, 800); ctx.fillStyle = S.textColor;
        ctx.fillText(ellipsis(ctx, fmt(shown, S), inner * 1.7), cx, cy - (S.centerLabel ? size * 0.2 : 0));
        if (S.centerLabel) {
          setFont(ctx, S, size * 0.38, 500); ctx.fillStyle = withAlpha(S.textColor, 0.6);
          ctx.fillText(S.centerLabel, cx, cy + size * 0.55);
        }
      }

      // Legend list
      var lx = landscape ? R.x + R.w - legW + 30 * u : R.x;
      var ly = landscape ? R.y + Math.max(0, (R.h - slices.length * rowH) / 2) : area.y + area.h + 20 * u;
      var cols = landscape ? 1 : (slices.length > 5 ? 2 : 1);
      var colW = (landscape ? legW - 30 * u : R.w) / cols;
      var perCol = Math.ceil(slices.length / cols);
      var fit = landscape ? Math.floor(R.h / rowH) : Math.floor(legH / rowH);
      slices.forEach(function (s, i) {
        var col = Math.floor(i / perCol), row = i % perCol;
        if (row >= fit) return;
        var x = lx + col * colW, y = ly + row * rowH;
        var appear = clamp((C.pLinear * slices.length * 1.4 - i), 0, 1);
        ctx.save(); ctx.globalAlpha = appear;
        ctx.fillStyle = s.color; rrect(ctx, x, y + rowH / 2 - 10 * u, 20 * u, 20 * u, 5 * u); ctx.fill();
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        setFont(ctx, S, 24 * u, 600); ctx.fillStyle = S.textColor;
        var right = S.showPercent ? (s.v / total * 100).toFixed(S.decimals > 0 ? 1 : 0) + '%' : fmt(s.v, S);
        setFont(ctx, S, 24 * u, 500);
        var rw = ctx.measureText(right).width;
        setFont(ctx, S, 24 * u, 600);
        ctx.fillText(ellipsis(ctx, s.label, colW - rw - 70 * u), x + 32 * u, y + rowH / 2);
        setFont(ctx, S, 24 * u, 500); ctx.fillStyle = withAlpha(S.textColor, 0.65); ctx.textAlign = 'right';
        ctx.fillText(right, x + colW - 20 * u, y + rowH / 2);
        ctx.restore();
      });
    }
  };

  /* ---------------- Icon chart (pictogram) ---------------- */
  TEMPLATES.pictogram = {
    name: 'Icon chart',
    description: 'Pictograms made from repeated icons',
    dataHint: 'First column: category. Second column: value. Optional third column: an icon name (' + ICON_NAMES.join(', ') + '), any emoji, or the name of an uploaded image.',
    settings: [
      { group: 'Icons', key: 'layout', label: 'Layout', type: 'select', def: 'grid', options: ['grid', 'rows'] },
      { group: 'Icons', key: 'icon', label: 'Default icon', type: 'select', def: 'person', options: ICON_NAMES },
      { group: 'Icons', key: 'gridTotal', label: 'Icons in grid', type: 'number', def: 100, min: 4, max: 2000, step: 1 },
      { group: 'Icons', key: 'gridColumns', label: 'Grid columns (0 = auto)', type: 'number', def: 0, min: 0, max: 200, step: 1 },
      { group: 'Icons', key: 'unitValue', label: 'Value per icon, rows layout (0 = auto)', type: 'number', def: 0, min: 0, step: 1 },
      { group: 'Icons', key: 'showEmpty', label: 'Show empty icons', type: 'checkbox', def: true },
      { group: 'Icons', key: 'iconGap', label: 'Space between icons', type: 'range', def: 0.2, min: 0, max: 0.6, step: 0.01 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var color = colorer(S);
      var items = cleanRows(C.T).map(function (r, i) {
        return { label: String(r[0]), v: Math.max(0, num(r[1])), icon: r[2] || S.icon, color: color(r[0], i) };
      }).filter(function (it) { return isFinite(it.v); });
      if (!items.length) return noData(C, R);
      var empty = withAlpha(S.textColor, 0.1);

      if (S.layout !== 'rows') {
        var total = items.reduce(function (a, it) { return a + it.v; }, 0) || 1;
        var N = clamp(S.gridTotal | 0, 1, 2000);
        var exact = items.map(function (it) { return it.v / total * N; });
        var counts = exact.map(Math.floor);
        var left = N - counts.reduce(function (a, b) { return a + b; }, 0);
        exact.map(function (e, i) { return [e - Math.floor(e), i]; }).sort(function (a, b) { return b[0] - a[0]; })
          .slice(0, left).forEach(function (p) { counts[p[1]]++; });
        var legItems = items.map(function (it) {
          return { label: it.label + '  ' + (it.v / total * 100).toFixed(S.decimals > 0 ? 1 : 0) + '%', color: it.color };
        });
        var top = R.y + legend(C, legItems, R.x, R.y, R.w) + 10 * u;
        var A = { x: R.x, y: top, w: R.w, h: R.y + R.h - top };
        var cols = S.gridColumns | 0, best = 0;
        if (cols <= 0) {
          for (var c = 1; c <= N; c++) {
            var s = Math.min(A.w / c, A.h / Math.ceil(N / c));
            if (s > best) { best = s; cols = c; }
          }
        }
        var rowsN = Math.ceil(N / cols);
        var cell = Math.min(A.w / cols, A.h / rowsN);
        var size = cell * (1 - S.iconGap);
        var ox = A.x + (A.w - cell * cols) / 2, oy = A.y + (A.h - cell * rowsN) / 2;
        var owner = [], k = 0;
        counts.forEach(function (n, i) { for (var j = 0; j < n; j++) owner[k++] = i; });
        var wave = Math.max(3, N * 0.06);
        for (var i = 0; i < N; i++) {
          var x = ox + (i % cols) * cell + (cell - size) / 2, y = oy + Math.floor(i / cols) * cell + (cell - size) / 2;
          var it = items[owner[i]];
          if (S.showEmpty) drawIcon(ctx, it ? it.icon : S.icon, x, y, size, empty, S.icon);
          if (!it) continue;
          var kk = clamp((C.pLinear * (N + wave) - i) / wave, 0, 1);
          if (kk <= 0) continue;
          var e = EASINGS.snappy(kk), sz = size * (0.4 + 0.6 * e);
          ctx.save(); ctx.globalAlpha = Math.min(1, kk * 2);
          drawIcon(ctx, it.icon, x + (size - sz) / 2, y + (size - sz) / 2, sz, it.color, S.icon);
          ctx.restore();
        }
        return;
      }

      // Rows layout: one row of icons per category
      var maxV = Math.max.apply(null, items.map(function (it) { return it.v; })) || 1;
      var unit = S.unitValue > 0 ? S.unitValue : (maxV <= 40 ? 1 : niceTicks(0, maxV, 30).step);
      var footH = 44 * u;
      var A2 = { x: R.x, y: R.y, w: R.w, h: R.h - footH };
      var rh = A2.h / items.length;
      var nameSize = clamp(rh * 0.3, 14 * u, 30 * u);
      setFont(ctx, S, nameSize, 700);
      var labW = 0;
      items.forEach(function (it) { labW = Math.max(labW, ctx.measureText(it.label).width); });
      labW = Math.min(labW, R.w * 0.3) + 24 * u;
      var iconsX = A2.x + labW, iconsW = A2.w - labW;
      var maxIcons = Math.ceil(maxV / unit - 1e-9);
      var cellS = Math.min(rh * 0.85, 110 * u), perLine = 1;
      for (; cellS > 4; cellS -= 0.5) {
        perLine = Math.max(1, Math.floor(iconsW / cellS));
        if (Math.ceil(maxIcons / perLine) * cellS <= rh * 0.86) break;
      }
      var isz = cellS * (1 - S.iconGap);
      items.forEach(function (it, ri) {
        var count = it.v / unit, n = Math.ceil(count - 1e-9);
        var lines = Math.max(1, Math.ceil(n / perLine));
        var y0 = A2.y + ri * rh + (rh - lines * cellS) / 2;
        var shown = count * C.pEased;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        setFont(ctx, S, nameSize, 700); ctx.fillStyle = S.textColor;
        var cy = A2.y + ri * rh + rh / 2;
        ctx.fillText(ellipsis(ctx, it.label, labW - 24 * u), A2.x, cy - nameSize * 0.45);
        setFont(ctx, S, nameSize * 0.8, 500); ctx.fillStyle = withAlpha(S.textColor, 0.65);
        ctx.fillText(fmt(it.v * C.pEased, S), A2.x, cy + nameSize * 0.6);
        for (var j = 0; j < n; j++) {
          var x = iconsX + (j % perLine) * cellS, y = y0 + Math.floor(j / perLine) * cellS + (cellS - isz) / 2;
          if (S.showEmpty) drawIcon(ctx, it.icon, x, y, isz, empty, S.icon);
          var fill = clamp(shown - j, 0, 1);
          if (fill <= 0) continue;
          ctx.save(); ctx.beginPath(); ctx.rect(x - 1, y - 1, isz * fill + 1, isz + 2); ctx.clip();
          drawIcon(ctx, it.icon, x, y, isz, it.color, S.icon);
          ctx.restore();
        }
      });
      setFont(ctx, S, 22 * u, 500); ctx.fillStyle = withAlpha(S.textColor, 0.6);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      var fy = R.y + R.h - footH / 2;
      drawIcon(ctx, items[0].icon, R.x, fy - 12 * u, 24 * u, withAlpha(S.textColor, 0.6), S.icon);
      ctx.fillText('= ' + fmt(unit, S), R.x + 32 * u, fy);
    }
  };

  /* ---------------- Big numbers / KPI cards ---------------- */
  TEMPLATES.counters = {
    name: 'Big numbers',
    description: 'Headline stats that count up, with icons',
    dataHint: 'First column: label. Second column: the number (decimal places follow what you type, e.g. 4.8). Optional third column: icon name, emoji or uploaded image name. Optional fourth column: a short caption.',
    settings: [
      { group: 'Cards', key: 'cardStyle', label: 'Card style', type: 'select', def: 'filled', options: ['filled', 'outline', 'solid', 'plain'] },
      { group: 'Cards', key: 'columns', label: 'Columns (0 = auto)', type: 'number', def: 0, min: 0, max: 12, step: 1 },
      { group: 'Cards', key: 'showIcons', label: 'Show icons', type: 'checkbox', def: true },
      { group: 'Cards', key: 'cardRadius', label: 'Corner radius', type: 'range', def: 20, min: 0, max: 60, step: 1 },
      { group: 'Cards', key: 'stagger', label: 'Stagger animation', type: 'range', def: 0.45, min: 0, max: 0.9, step: 0.05 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var color = colorer(S);
      var items = cleanRows(C.T).map(function (r, i) {
        return { label: String(r[0]), v: num(r[1]), dec: decimalsOf(r[1]), icon: r[2], note: r[3] || '', color: color(r[0], i) };
      }).filter(function (it) { return isFinite(it.v); });
      if (!items.length) return noData(C, R);
      var n = items.length, cols = S.columns | 0, gap = 26 * u;
      if (cols <= 0) {
        var best = -1;
        for (var c = 1; c <= n; c++) {
          var rr = Math.ceil(n / c), cw = (R.w - gap * (c - 1)) / c, ch = (R.h - gap * (rr - 1)) / rr;
          var score = Math.min(cw, ch * 1.25);
          if (score > best + 0.5) { best = score; cols = c; }
        }
      }
      var rowsN = Math.ceil(n / cols);
      var cw2 = (R.w - gap * (cols - 1)) / cols, ch2 = (R.h - gap * (rowsN - 1)) / rowsN;
      var st = S.stagger;
      items.forEach(function (it, i) {
        var row = Math.floor(i / cols), col = i % cols;
        var inRow = Math.min(cols, n - row * cols);
        var x = R.x + col * (cw2 + gap) + (cols - inRow) * (cw2 + gap) / 2, y = R.y + row * (ch2 + gap);
        var start = n > 1 ? i / (n - 1) * st : 0;
        var k = clamp((C.pLinear - start) / (1 - st), 0, 1);
        var e = C.ease(k);
        ctx.save();
        ctx.globalAlpha = clamp(k * 4, 0, 1);
        ctx.translate(0, (1 - EASINGS.snappy(clamp(k * 2, 0, 1))) * 30 * u);
        var textCol = S.textColor, mutedCol = withAlpha(S.textColor, 0.65), numCol = it.color;
        if (S.cardStyle === 'filled') { ctx.fillStyle = withAlpha(it.color, 0.1); rrect(ctx, x, y, cw2, ch2, S.cardRadius * u); ctx.fill(); }
        else if (S.cardStyle === 'outline') { ctx.strokeStyle = withAlpha(it.color, 0.6); ctx.lineWidth = 3 * u; rrect(ctx, x, y, cw2, ch2, S.cardRadius * u); ctx.stroke(); }
        else if (S.cardStyle === 'solid') {
          ctx.fillStyle = it.color; rrect(ctx, x, y, cw2, ch2, S.cardRadius * u); ctx.fill();
          textCol = numCol = contrastText(it.color); mutedCol = withAlpha(textCol, 0.8);
        }
        var base = Math.min(cw2, ch2 * 1.3);
        var iconD = S.showIcons && it.icon !== '' ? base * 0.24 : 0;
        var numSize = base * 0.2, labSize = Math.max(12 * u, base * 0.07), noteSize = Math.max(11 * u, base * 0.052);
        var shown = it.v * e;
        var txt = fmt(shown, S, it.dec > 0 ? it.dec : (S.compact ? null : S.decimals));
        setFont(ctx, S, numSize, 800);
        var tw = ctx.measureText(fmt(it.v, S, it.dec > 0 ? it.dec : (S.compact ? null : S.decimals))).width;
        if (tw > cw2 * 0.86) { numSize *= cw2 * 0.86 / tw; }
        setFont(ctx, S, labSize, 600);
        var labLines = wrap(ctx, it.label, cw2 * 0.86).slice(0, 2);
        setFont(ctx, S, noteSize, 400);
        var noteLines = it.note ? wrap(ctx, it.note, cw2 * 0.86).slice(0, 2) : [];
        var stackH = (iconD ? iconD + base * 0.06 : 0) + numSize * 1.05 + labLines.length * labSize * 1.25 + (noteLines.length ? base * 0.02 + noteLines.length * noteSize * 1.3 : 0);
        var cy = y + (ch2 - stackH) / 2, cx = x + cw2 / 2;
        if (iconD) {
          var circleCol = S.cardStyle === 'solid' ? withAlpha(textCol, 0.18) : it.color;
          var icCol = S.cardStyle === 'solid' ? textCol : contrastText(toHex(it.color));
          avatar(ctx, it.icon, cx, cy + iconD / 2, iconD, circleCol, icCol);
          cy += iconD + base * 0.06;
        }
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        setFont(ctx, S, numSize, 800); ctx.fillStyle = numCol;
        ctx.fillText(txt, cx, cy); cy += numSize * 1.05;
        setFont(ctx, S, labSize, 600); ctx.fillStyle = textCol;
        labLines.forEach(function (l) { ctx.fillText(l, cx, cy); cy += labSize * 1.25; });
        if (noteLines.length) {
          cy += base * 0.02;
          setFont(ctx, S, noteSize, 400); ctx.fillStyle = mutedCol;
          noteLines.forEach(function (l) { ctx.fillText(l, cx, cy); cy += noteSize * 1.3; });
        }
        ctx.restore();
      });
    }
  };

  /* ---------------- Word cloud ---------------- */
  var STOPWORDS = ('a about above after again against all am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves also get got really much many lot lots like one two would could should im ive dont didnt doesnt isnt wasnt arent its thats theres us').split(' ');
  var STOP = {}; STOPWORDS.forEach(function (w) { STOP[w] = 1; });
  var cloudCache = {}, cloudKeys = [];

  function cloudWords(T, S) {
    var rows = cleanRows(T);
    var weighted = rows.some(function (r) { return isFinite(num(r[1])); });
    var list = [];
    if (weighted) {
      rows.forEach(function (r) { var w = num(r[1]); if (isFinite(w) && w > 0) list.push({ text: String(r[0]).trim(), w: w }); });
    } else {
      var counts = {}, display = {};
      var text = rows.map(function (r) { return r[0]; }).join(' ');
      text.split(/[^A-Za-z0-9À-ɏ'’-]+/).forEach(function (raw) {
        var w = raw.replace(/^['’-]+|['’-]+$/g, '');
        var key = w.toLowerCase().replace(/[’']/g, '');
        if (key.length < 2 || /^\d+$/.test(key)) return;
        if (S.removeCommon && STOP[key]) return;
        counts[key] = (counts[key] || 0) + 1;
        if (!display[key]) display[key] = w;
      });
      Object.keys(counts).forEach(function (k) { list.push({ text: display[k], w: counts[k] }); });
    }
    list.sort(function (a, b) { return b.w - a.w || (a.text < b.text ? -1 : 1); });
    list = list.slice(0, Math.max(1, S.maxWords | 0));
    list.forEach(function (it) {
      if (S.caseMode === 'lower') it.text = it.text.toLowerCase();
      else if (S.caseMode === 'upper') it.text = it.text.toUpperCase();
    });
    return list;
  }

  function cloudLayout(ctx, words, R, S, u) {
    var key = JSON.stringify([words, R, S.font, S.cloudWeight, S.rotation, S.contrast, S.cloudScale, u, S.padding]);
    if (cloudCache[key]) return cloudCache[key];
    var weight = { regular: 400, bold: 700, black: 900 }[S.cloudWeight] || 700;
    var maxW = words[0].w, minW = words[words.length - 1].w;
    var minRatio = 1 - clamp(S.contrast, 0, 1) * 0.86;
    var rel = words.map(function (it) { return maxW === minW ? 1 : lerp(minRatio, 1, Math.sqrt((it.w - minW) / (maxW - minW))); });
    // measure at 100px
    var meas = words.map(function (it, i) {
      setFont(ctx, S, 100 * rel[i], weight);
      var m = ctx.measureText(it.text);
      var asc = m.actualBoundingBoxAscent || 100 * rel[i] * 0.74, desc = m.actualBoundingBoxDescent || 100 * rel[i] * 0.2;
      return { w: m.width, asc: asc, desc: desc };
    });
    var sumArea = meas.reduce(function (a, m) { return a + m.w * (m.asc + m.desc); }, 0);
    var scale = Math.sqrt(0.36 * R.w * R.h / sumArea) * (S.cloudScale || 1);
    scale = Math.min(scale, R.w * 0.92 / meas[0].w, R.h * 0.4 / (meas[0].asc + meas[0].desc));
    var cx = R.x + R.w / 2, cy = R.y + R.h / 2, ratio = R.w / R.h;
    var placed, attempt;
    for (attempt = 0; attempt < 6; attempt++) {
      placed = [];
      var boxes = [];
      var missed = 0;
      for (var i = 0; i < words.length; i++) {
        var m = meas[i];
        var bw = m.w * scale, bh = (m.asc + m.desc) * scale;
        var pad = (S.padding == null ? 4 : S.padding) * u;
        var h = hash(words[i].text + i);
        var vertical = i > 0 && ((S.rotation === 'some vertical' && h % 4 === 0) || (S.rotation === 'half vertical' && h % 2 === 0));
        var W = (vertical ? bh : bw) + pad, H = (vertical ? bw : bh) + pad;
        var ok = false, px = cx, py = cy;
        var t0 = i === 0 ? 0 : (h % 628) / 100;
        for (var s = 0; s < 9000; s++) {
          var t = s * 0.045, r = t * 1.6 * u;
          var ang = t + t0;
          px = cx + r * Math.cos(ang) * Math.sqrt(ratio);
          py = cy + r * Math.sin(ang) / Math.sqrt(ratio);
          var x0 = px - W / 2, y0 = py - H / 2;
          if (x0 < R.x || y0 < R.y || x0 + W > R.x + R.w || y0 + H > R.y + R.h) { if (r > Math.max(R.w, R.h)) break; continue; }
          var hit = false;
          for (var b = 0; b < boxes.length; b++) {
            var B = boxes[b];
            if (x0 < B[0] + B[2] && x0 + W > B[0] && y0 < B[1] + B[3] && y0 + H > B[1]) { hit = true; break; }
          }
          if (!hit) { ok = true; boxes.push([x0, y0, W, H]); break; }
        }
        if (ok) placed.push({ i: i, x: px, y: py, size: 100 * rel[i] * scale, vertical: vertical, base: (m.asc - m.desc) / 2 * scale });
        else missed++;
      }
      if (missed <= Math.max(0, words.length * 0.04) || attempt === 5) break;
      scale *= 0.88;
    }
    var out = { placed: placed, weight: weight };
    cloudCache[key] = out; cloudKeys.push(key);
    if (cloudKeys.length > 24) delete cloudCache[cloudKeys.shift()];
    return out;
  }

  TEMPLATES.wordCloud = {
    name: 'Word cloud',
    description: 'Words sized by importance or frequency',
    dataHint: 'First column: word or phrase. Second column: its weight (bigger = larger text). Or leave the second column empty and paste free text (e.g. survey answers) into the first column: words are counted for you.',
    settings: [
      { group: 'Words', key: 'maxWords', label: 'Maximum words', type: 'number', def: 80, min: 1, max: 300, step: 1 },
      { group: 'Words', key: 'rotation', label: 'Rotation', type: 'select', def: 'some vertical', options: ['none', 'some vertical', 'half vertical'] },
      { group: 'Words', key: 'contrast', label: 'Size contrast', type: 'range', def: 0.8, min: 0, max: 1, step: 0.01 },
      { group: 'Words', key: 'cloudScale', label: 'Overall size', type: 'range', def: 1, min: 0.4, max: 1.6, step: 0.02 },
      { group: 'Words', key: 'padding', label: 'Space between words', type: 'range', def: 4, min: 0, max: 20, step: 1 },
      { group: 'Words', key: 'cloudWeight', label: 'Font weight', type: 'select', def: 'bold', options: ['regular', 'bold', 'black'] },
      { group: 'Words', key: 'caseMode', label: 'Letter case', type: 'select', def: 'as typed', options: ['as typed', 'lower', 'upper'] },
      { group: 'Words', key: 'removeCommon', label: 'Ignore common words (the, and…) when counting', type: 'checkbox', def: true },
      { group: 'Words', key: 'colorBy', label: 'Colour by', type: 'select', def: 'cycle', options: ['cycle', 'weight', 'single'] }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var words = cloudWords(C.T, S);
      if (!words.length) return noData(C, R);
      var L = cloudLayout(ctx, words, R, S, u);
      var color = colorer(S), pal = PALETTES[S.palette] || PALETTES.vivid;
      var n = words.length;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      L.placed.forEach(function (p) {
        var it = words[p.i];
        var start = n > 1 ? p.i / (n - 1) * 0.6 : 0;
        var k = clamp((C.pLinear - start) / 0.4, 0, 1);
        if (k <= 0) return;
        var e = EASINGS.snappy(k);
        var col;
        if (S.colorBy === 'single') col = color(it.text, 0);
        else if (S.colorBy === 'weight') col = color(it.text, Math.min(pal.length - 1, Math.floor(p.i / Math.max(1, n / 5))));
        else col = color(it.text, p.i);
        ctx.save();
        ctx.globalAlpha = clamp(k * 2, 0, 1);
        ctx.translate(p.x, p.y);
        if (p.vertical) ctx.rotate(-Math.PI / 2);
        ctx.scale(0.6 + 0.4 * e, 0.6 + 0.4 * e);
        setFont(ctx, S, p.size, L.weight);
        ctx.fillStyle = col;
        ctx.fillText(it.text, 0, p.base);
        ctx.restore();
      });
    }
  };

  /* ---------------- Bubble chart (animated scatter) ---------------- */
  TEMPLATES.scatter = {
    name: 'Scatter / bubble plot',
    description: 'Points or bubbles, optionally moving through time',
    dataHint: 'Columns in this order: Name, Time period (optional, e.g. year), X value, Y value, Size (optional), Group (optional, sets the colour). Use one row per name per time period.',
    settings: [
      { group: 'Bubbles', key: 'xTitle', label: 'X axis title', type: 'text', def: '' },
      { group: 'Bubbles', key: 'yTitle', label: 'Y axis title', type: 'text', def: '' },
      { group: 'Bubbles', key: 'logX', label: 'Logarithmic X axis', type: 'checkbox', def: false },
      { group: 'Bubbles', key: 'logY', label: 'Logarithmic Y axis', type: 'checkbox', def: false },
      { group: 'Bubbles', key: 'bubbleScale', label: 'Bubble size', type: 'range', def: 1, min: 0.2, max: 3, step: 0.05 },
      { group: 'Bubbles', key: 'bubbleOpacity', label: 'Bubble opacity', type: 'range', def: 0.82, min: 0.2, max: 1, step: 0.01 },
      { group: 'Bubbles', key: 'labels', label: 'Bubble labels', type: 'select', def: 'largest', options: ['largest', 'all', 'none'] },
      { group: 'Bubbles', key: 'labelCount', label: 'How many “largest” labels', type: 'number', def: 6, min: 1, max: 100, step: 1 },
      { group: 'Bubbles', key: 'showPeriod', label: 'Show big period label', type: 'checkbox', def: true },
      { group: 'Bubbles', key: 'xFormat', label: 'Use number format on X axis', type: 'checkbox', def: true }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var rows = cleanRows(C.T);
      if (!rows.length) return noData(C, R);
      var periods = [], seenP = {}, names = [], byName = {}, groups = [], seenG = {};
      rows.forEach(function (r) {
        var nm = String(r[0]), per = String(r[1] == null ? '' : r[1]).trim(), g = String(r[5] == null ? '' : r[5]).trim();
        if (!seenP[per]) { seenP[per] = 1; periods.push(per); }
        if (!byName[nm]) { byName[nm] = { name: nm, group: g, at: {} }; names.push(nm); }
        if (g && !seenG[g]) { seenG[g] = 1; groups.push(g); }
        byName[nm].at[per] = { x: num(r[2]), y: num(r[3]), s: num(r[4]) };
      });
      var color = colorer(S);
      var colOf = function (o, i) { return groups.length ? color(o.group, groups.indexOf(o.group)) : color(o.name, i); };
      var xs = [], ys = [], maxS = 0;
      names.forEach(function (nm) {
        var at = byName[nm].at;
        Object.keys(at).forEach(function (p) {
          var d = at[p];
          if (isFinite(d.x) && (!S.logX || d.x > 0)) xs.push(d.x);
          if (isFinite(d.y) && (!S.logY || d.y > 0)) ys.push(d.y);
          if (isFinite(d.s)) maxS = Math.max(maxS, d.s);
        });
      });
      if (!xs.length || !ys.length) return noData(C, R);
      function axis(vals, log) {
        var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
        if (log) {
          var a = Math.floor(Math.log10(lo)), b = Math.ceil(Math.log10(hi));
          if (a === b) b++;
          var t = []; for (var e = a; e <= b; e++) t.push(Math.pow(10, e));
          return { lo: Math.pow(10, a), hi: Math.pow(10, b), ticks: t, step: 0, map: function (v) { return (Math.log10(v) - a) / (b - a); } };
        }
        var span = hi - lo || Math.abs(hi) || 1;
        var nt = niceTicks(lo - span * 0.05, hi + span * 0.05, 5);
        return { lo: nt.lo, hi: nt.hi, ticks: nt.ticks, step: nt.step, map: function (v) { return (v - nt.lo) / (nt.hi - nt.lo); } };
      }
      var AX = axis(xs, S.logX), AY = axis(ys, S.logY);
      var top = R.y;
      if (groups.length) top += legend(C, groups.map(function (g, i) { return { label: g, color: color(g, i) }; }), R.x, R.y, R.w);
      setFont(ctx, S, 20 * u, 500);
      var tickLab = function (v, A, useFmt) { var st = A.step || Math.abs(v) || 1; return fmtTick(v, useFmt ? S : { compact: S.compact }, st); };
      var yW = 0; AY.ticks.forEach(function (v) { yW = Math.max(yW, ctx.measureText(tickLab(v, AY, false)).width); });
      var leftPad = yW + 18 * u + (S.yTitle ? 36 * u : 0);
      var P = { x: R.x + leftPad, y: top + 16 * u, w: R.w - leftPad - 20 * u, h: R.y + R.h - top - 16 * u - (S.xTitle ? 80 * u : 46 * u) };
      var X = function (v) { return P.x + AX.map(v) * P.w; }, Y = function (v) { return P.y + P.h - AY.map(v) * P.h; };
      ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
      AY.ticks.forEach(function (v) {
        gridLine(ctx, P.x, Y(v), P.x + P.w, Y(v), withAlpha(S.textColor, 0.1), 1.5 * u);
        ctx.fillStyle = withAlpha(S.textColor, 0.55); ctx.fillText(tickLab(v, AY, false), P.x - 12 * u, Y(v));
      });
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      AX.ticks.forEach(function (v) {
        gridLine(ctx, X(v), P.y, X(v), P.y + P.h, withAlpha(S.textColor, 0.1), 1.5 * u);
        ctx.fillStyle = withAlpha(S.textColor, 0.55); ctx.fillText(tickLab(v, AX, S.xFormat), X(v), P.y + P.h + 12 * u);
      });
      setFont(ctx, S, 22 * u, 600); ctx.fillStyle = withAlpha(S.textColor, 0.75);
      if (S.xTitle) { ctx.textBaseline = 'bottom'; ctx.fillText(S.xTitle, P.x + P.w / 2, R.y + R.h); }
      if (S.yTitle) { ctx.save(); ctx.translate(R.x + 12 * u, P.y + P.h / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = 'middle'; ctx.fillText(S.yTitle, 0, 0); ctx.restore(); }

      var np = periods.length;
      var f = C.pLinear * (np - 1), i0 = Math.floor(f), i1 = Math.min(i0 + 1, np - 1), fr = C.ease(f - i0);
      if (S.showPeriod && np > 1 && periods[0] !== '') {
        var ps = clamp(Math.min(P.w, P.h) * 0.28, 40 * u, 220 * u);
        setFont(ctx, S, ps, 800); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = withAlpha(S.textColor, 0.12);
        ctx.fillText(periods[Math.round(f)], P.x + P.w - 10 * u, P.y + P.h - 6 * u);
      }
      var maxR = 70 * u * S.bubbleScale;
      var grow = np > 1 ? 1 : C.pEased;
      var pts = [];
      names.forEach(function (nm, idx) {
        var o = byName[nm];
        var a = o.at[periods[i0]], b = o.at[periods[i1]];
        var valid = function (d) { return d && isFinite(d.x) && isFinite(d.y) && (!S.logX || d.x > 0) && (!S.logY || d.y > 0); };
        if (!valid(a) && !valid(b)) return;
        if (!valid(a)) a = b; if (!valid(b)) b = a;
        var sx = lerp(X(a.x), X(b.x), fr), sy = lerp(Y(a.y), Y(b.y), fr);
        var sa = isFinite(a.s) ? a.s : 0, sb = isFinite(b.s) ? b.s : 0;
        var sv = lerp(sa, sb, fr);
        var r = maxS > 0 ? Math.max(3 * u, Math.sqrt(Math.max(0, sv) / maxS) * maxR) : 14 * u * S.bubbleScale;
        pts.push({ x: sx, y: sy, r: r * grow, o: o, col: colOf(o, idx), s: sv });
      });
      pts.sort(function (p, q) { return q.r - p.r; });
      ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y - maxR, P.w + maxR, P.h + maxR); ctx.clip();
      pts.forEach(function (p) {
        if (p.r <= 0) return;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(p.col, S.bubbleOpacity); ctx.fill();
        ctx.strokeStyle = withAlpha(S.background, 0.9); ctx.lineWidth = 1.5 * u; ctx.stroke();
      });
      ctx.restore();
      if (S.labels !== 'none') {
        var lab = S.labels === 'all' ? pts : pts.slice(0, S.labelCount | 0);
        setFont(ctx, S, 20 * u, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        lab.forEach(function (p) {
          var lx = p.x + p.r * 0.75 + 6 * u, ly = p.y - p.r * 0.75;
          var lw2 = ctx.measureText(p.o.name).width;
          if (lx + lw2 > R.x + R.w) { lx = p.x - p.r * 0.75 - 6 * u - lw2; }
          ctx.lineWidth = 4 * u; ctx.strokeStyle = withAlpha(S.background, 0.85); ctx.lineJoin = 'round';
          ctx.strokeText(p.o.name, lx, ly);
          ctx.fillStyle = S.textColor; ctx.fillText(p.o.name, lx, ly);
        });
      }
    }
  };

  /* ---------------- Parliament (hemicycle) ---------------- */
  TEMPLATES.parliament = {
    name: 'Parliament chart',
    description: 'Seats in a hemicycle, e.g. election results',
    dataHint: 'First column: party or group. Second column: number of seats. Optional third column: a colour for that party (e.g. #e4003b).',
    settings: [
      { group: 'Seats', key: 'innerRadius', label: 'Inner hole size', type: 'range', def: 0.38, min: 0.1, max: 0.8, step: 0.01 },
      { group: 'Seats', key: 'seatSize', label: 'Seat size', type: 'range', def: 0.82, min: 0.3, max: 1, step: 0.01 },
      { group: 'Seats', key: 'showMajority', label: 'Show majority needed', type: 'checkbox', def: true },
      { group: 'Seats', key: 'majorityLabel', label: 'Majority caption', type: 'text', def: 'seats for a majority' },
      { group: 'Seats', key: 'seatShape', label: 'Seat shape', type: 'select', def: 'circle', options: ['circle', 'square'] },
      { group: 'Seats', key: 'legendPosition', label: 'Legend', type: 'select', def: 'auto', options: ['auto', 'right', 'below'] }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var color = colorer(S);
      var parties = cleanRows(C.T).map(function (r, i) {
        var c = /^#[0-9a-f]{3,8}$/i.test(String(r[2] || '').trim()) ? String(r[2]).trim() : color(r[0], i);
        return { label: String(r[0]), n: Math.max(0, Math.round(num(r[1]))), color: c };
      }).filter(function (p) { return isFinite(p.n) && p.n > 0; });
      if (!parties.length) return noData(C, R);
      var N = Math.min(5000, parties.reduce(function (a, p) { return a + p.n; }, 0));
      var inner = S.innerRadius;
      // choose number of rows
      var k, caps, spacing;
      for (k = 1; k < 400; k++) {
        spacing = k === 1 ? (1 - inner) : (1 - inner) / (k - 1);
        caps = [];
        var tot = 0;
        for (var i = 0; i < k; i++) {
          var r = k === 1 ? (1 + inner) / 2 : inner + i * spacing;
          var c = Math.floor(Math.PI * r / spacing) + 1; caps.push(c); tot += c;
        }
        if (tot >= N) break;
      }
      var capTot = caps.reduce(function (a, b) { return a + b; }, 0);
      var exact = caps.map(function (c) { return N * c / capTot; });
      var per = exact.map(Math.floor);
      var rem = N - per.reduce(function (a, b) { return a + b; }, 0);
      exact.map(function (e, i) { return [e - Math.floor(e), i]; }).sort(function (a, b) { return b[0] - a[0]; })
        .forEach(function (p) { if (rem > 0 && per[p[1]] < caps[p[1]]) { per[p[1]]++; rem--; } });
      var seats = [];
      per.forEach(function (n, i) {
        var r = k === 1 ? (1 + inner) / 2 : inner + i * spacing;
        for (var j = 0; j < n; j++) seats.push({ a: n === 1 ? Math.PI / 2 : Math.PI * (1 - j / (n - 1)), r: r });
      });
      seats.sort(function (p, q) { return q.a - p.a || p.r - q.r; });
      var owner = [], idx = 0;
      parties.forEach(function (p, pi) { for (var j = 0; j < p.n && idx < N; j++) owner[idx++] = pi; });

      var right = S.legendPosition === 'right' || (S.legendPosition === 'auto' && R.w > R.h * 1.3);
      var legW = right ? Math.min(R.w * 0.34, 520 * u) : R.w;
      var rowH = 42 * u;
      var legRows = right ? parties.length : Math.ceil(parties.length / 2);
      var legH = right ? 0 : Math.min(R.h * 0.4, legRows * rowH + 10 * u);
      var A = right ? { x: R.x, y: R.y, w: R.w - legW - 30 * u, h: R.h } : { x: R.x, y: R.y, w: R.w, h: R.h - legH };
      var seatR = spacing * 0.5 * S.seatSize;
      var Rad = Math.min(A.w / 2 / (1 + seatR), (A.h - 10 * u) / (1 + seatR));
      var cx = A.x + A.w / 2, cy = A.y + A.h / 2 + Rad * (1 + seatR) / 2;
      var wave = Math.max(4, N * 0.08);
      seats.forEach(function (s, i) {
        var p = parties[owner[i]]; if (!p) return;
        var kk = clamp((C.pLinear * (N + wave) - i) / wave, 0, 1);
        if (kk <= 0) return;
        var e = EASINGS.snappy(kk);
        var x = cx + Math.cos(s.a) * s.r * Rad, y = cy - Math.sin(s.a) * s.r * Rad, rr = seatR * Rad * (0.3 + 0.7 * e);
        ctx.globalAlpha = clamp(kk * 2, 0, 1);
        ctx.fillStyle = p.color;
        if (S.seatShape === 'square') { rrect(ctx, x - rr, y - rr, rr * 2, rr * 2, rr * 0.25); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); }
      });
      ctx.globalAlpha = 1;
      if (S.showMajority) {
        var maj = Math.floor(N / 2) + 1;
        var big = Math.min(inner * Rad * 0.5, 90 * u);
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        setFont(ctx, S, big, 800); ctx.fillStyle = S.textColor;
        ctx.fillText(String(maj), cx, cy - big * 0.45);
        setFont(ctx, S, Math.max(14 * u, big * 0.26), 500); ctx.fillStyle = withAlpha(S.textColor, 0.6);
        ctx.fillText(S.majorityLabel || '', cx, cy);
        gridLine(ctx, cx, cy - (inner * Rad) + 4 * u, cx, cy - Rad * (1 + seatR) - 6 * u, withAlpha(S.textColor, 0.35), 2 * u);
      }
      // Legend
      var cols = right ? 1 : 2;
      var colW = (right ? legW : R.w) / cols;
      var lx0 = right ? R.x + R.w - legW : R.x;
      var ly0 = right ? R.y + Math.max(0, (R.h - parties.length * rowH) / 2) : R.y + R.h - legH + 10 * u;
      parties.forEach(function (p, i) {
        var col = right ? 0 : Math.floor(i / legRows), row = right ? i : i % legRows;
        var x = lx0 + col * colW, y = ly0 + row * rowH;
        if (y + rowH > R.y + R.h + 1) return;
        ctx.globalAlpha = clamp(C.pLinear * 3 - i * 0.1, 0, 1);
        ctx.fillStyle = p.color; rrect(ctx, x, y + rowH / 2 - 10 * u, 20 * u, 20 * u, 5 * u); ctx.fill();
        ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        setFont(ctx, S, 24 * u, 800);
        var nt = String(p.n), nw = ctx.measureText(nt).width;
        ctx.fillStyle = S.textColor; ctx.textAlign = 'right';
        ctx.fillText(nt, x + colW - 24 * u, y + rowH / 2);
        setFont(ctx, S, 24 * u, 500); ctx.textAlign = 'left';
        ctx.fillText(ellipsis(ctx, p.label, colW - nw - 80 * u), x + 32 * u, y + rowH / 2);
      });
      ctx.globalAlpha = 1;
    }
  };

  /* ---------------- Treemap ---------------- */
  function squarify(values, rect) {
    var total = values.reduce(function (a, b) { return a + b; }, 0);
    var out = [];
    if (!(total > 0) || rect.w <= 0 || rect.h <= 0) return values.map(function () { return { x: rect.x, y: rect.y, w: 0, h: 0 }; });
    var scaled = values.map(function (v) { return v / total * rect.w * rect.h; });
    var x = rect.x, y = rect.y, w = rect.w, h = rect.h, row = [], i = 0;
    function worst(rw, side) {
      var s = 0, mx = 0, mn = Infinity;
      rw.forEach(function (a) { s += a; mx = Math.max(mx, a); mn = Math.min(mn, a); });
      return Math.max(side * side * mx / (s * s), (s * s) / (side * side * mn));
    }
    function layoutRow() {
      var s = row.reduce(function (a, b) { return a + b; }, 0);
      if (w >= h) {
        var rw = s / h, yy = y;
        row.forEach(function (a) { var rh = a / rw; out.push({ x: x, y: yy, w: rw, h: rh }); yy += rh; });
        x += rw; w -= rw;
      } else {
        var rh2 = s / w, xx = x;
        row.forEach(function (a) { var cw = a / rh2; out.push({ x: xx, y: y, w: cw, h: rh2 }); xx += cw; });
        y += rh2; h -= rh2;
      }
    }
    while (i < scaled.length) {
      var side = Math.min(w, h), a = scaled[i];
      if (!row.length || worst(row.concat([a]), side) <= worst(row, side)) { row.push(a); i++; }
      else { layoutRow(); row = []; }
    }
    if (row.length) layoutRow();
    return out;
  }

  TEMPLATES.treemap = {
    name: 'Treemap',
    description: 'Nested rectangles sized by value',
    dataHint: 'First column: item name. Second column: value. Optional third column: group (items in the same group sit together and share a colour).',
    settings: [
      { group: 'Tiles', key: 'showValues', label: 'Show values', type: 'checkbox', def: true },
      { group: 'Tiles', key: 'groupLabels', label: 'Show group headings', type: 'checkbox', def: true },
      { group: 'Tiles', key: 'tileGap', label: 'Gap between tiles', type: 'range', def: 3, min: 0, max: 16, step: 0.5 },
      { group: 'Tiles', key: 'tileRadius', label: 'Corner radius', type: 'range', def: 6, min: 0, max: 30, step: 1 },
      { group: 'Tiles', key: 'labelScale', label: 'Label size', type: 'range', def: 1, min: 0.5, max: 2, step: 0.05 },
      { group: 'Tiles', key: 'shadeItems', label: 'Shade items within a group', type: 'checkbox', def: true }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var color = colorer(S);
      var items = cleanRows(C.T).map(function (r) { return { label: String(r[0]), v: num(r[1]), group: String(r[2] == null ? '' : r[2]).trim() }; })
        .filter(function (it) { return isFinite(it.v) && it.v > 0; });
      if (!items.length) return noData(C, R);
      var grouped = items.some(function (it) { return it.group; });
      var groups = [], gmap = {};
      items.forEach(function (it) {
        var g = grouped ? (it.group || 'Other') : it.label;
        if (!gmap[g]) { gmap[g] = { name: g, items: [], v: 0 }; groups.push(gmap[g]); }
        gmap[g].items.push(it); gmap[g].v += it.v;
      });
      groups.forEach(function (g, i) { g.color = color(g.name, i); g.items.sort(function (a, b) { return b.v - a.v; }); });
      var order = groups.slice().sort(function (a, b) { return b.v - a.v; });
      var gr = squarify(order.map(function (g) { return g.v; }), R);
      var gap = S.tileGap * u;
      var tiles = [];
      var heads = [];
      order.forEach(function (g, gi) {
        var r = gr[gi];
        var inner = { x: r.x, y: r.y, w: r.w, h: r.h };
        if (grouped && S.groupLabels && r.h > 90 * u && r.w > 80 * u) {
          var hh = 34 * u;
          heads.push({ g: g, x: r.x + gap, y: r.y + gap, w: r.w - gap * 2, h: hh });
          inner = { x: r.x, y: r.y + hh, w: r.w, h: r.h - hh };
        }
        var ir = grouped ? squarify(g.items.map(function (it) { return it.v; }), inner) : [inner];
        g.items.forEach(function (it, ii) {
          var shade = grouped && S.shadeItems && g.items.length > 1 ? 1 - 0.45 * ii / (g.items.length - 1) : 1;
          tiles.push({ it: it, r: ir[ii], color: g.color, shade: shade });
        });
      });
      var n = tiles.length;
      tiles.forEach(function (t, i) {
        var start = n > 1 ? i / (n - 1) * 0.5 : 0;
        var k = clamp((C.pLinear - start) / 0.5, 0, 1);
        if (k <= 0) return;
        var e = EASINGS.snappy(k);
        var r = t.r, w = Math.max(0, r.w - gap * 2) * e, h = Math.max(0, r.h - gap * 2) * e;
        var x = r.x + r.w / 2 - w / 2, y = r.y + r.h / 2 - h / 2;
        ctx.save();
        ctx.globalAlpha = clamp(k * 2, 0, 1);
        ctx.fillStyle = S.background; rrect(ctx, x, y, w, h, S.tileRadius * u); ctx.fill();
        ctx.fillStyle = withAlpha(t.color, t.shade); rrect(ctx, x, y, w, h, S.tileRadius * u); ctx.fill();
        var tc = contrastText(t.color);
        var fs = clamp(Math.min(w, h) * 0.16, 12 * u, 44 * u) * S.labelScale;
        setFont(ctx, S, fs, 700);
        var pad = 10 * u;
        if (fs >= 12 * u && h > fs * 1.4 && w > 40 * u) {
          ctx.fillStyle = tc; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          var lines = wrap(ctx, t.it.label, w - pad * 2).slice(0, Math.max(1, Math.floor((h - pad * 2) / (fs * 1.15)) - (S.showValues ? 1 : 0)));
          lines.forEach(function (l, li) { ctx.fillText(ellipsis(ctx, l, w - pad * 2), x + pad, y + pad + li * fs * 1.15); });
          if (S.showValues && h > fs * 2.6) {
            setFont(ctx, S, fs * 0.85, 400); ctx.globalAlpha *= 0.85;
            ctx.fillText(ellipsis(ctx, fmt(t.it.v, S), w - pad * 2), x + pad, y + pad + lines.length * fs * 1.15 + 2 * u);
          }
        }
        ctx.restore();
      });
      heads.forEach(function (hd) {
        ctx.globalAlpha = clamp(C.pLinear * 4, 0, 1);
        setFont(ctx, S, 22 * u, 800); ctx.fillStyle = S.textColor; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        var label = hd.g.name + (S.showValues ? '  ·  ' + fmt(hd.g.v, S) : '');
        ctx.fillText(ellipsis(ctx, label, hd.w - 8 * u), hd.x + 4 * u, hd.y + hd.h / 2);
        ctx.globalAlpha = 1;
      });
    }
  };

  /* ================================================================== */
  /* Shared helpers for the extended template set                        */
  /* ================================================================== */

  function xAxisInfo(rows) {
    var xs = rows.map(function (r) { return r[0]; });
    var numericX = xs.every(function (x) { return isFinite(num(x)); });
    var xv = numericX ? xs.map(num) : xs.map(function (_, i) { return i; });
    var lo = Math.min.apply(null, xv), hi = Math.max.apply(null, xv);
    if (hi === lo) hi = lo + 1;
    return { labels: xs, xv: xv, lo: lo, hi: hi };
  }

  function drawXLabels(C, P, XI, X) {
    var ctx = C.ctx, S = C.S, u = C.u;
    setFont(ctx, S, 20 * u, 500);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = withAlpha(S.textColor, 0.6);
    var maxW = 0; XI.labels.forEach(function (x) { maxW = Math.max(maxW, ctx.measureText(String(x)).width); });
    var n = XI.labels.length;
    var every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(P.w / (maxW + 30 * u)))));
    for (var i = 0; i < n; i += every) ctx.fillText(String(XI.labels[i]), X(XI.xv[i]), P.y + P.h + 12 * u);
  }

  function smoothTo(ctx, pts, curve, start) {
    // pts: [[x,y],...]; draws from pts[0] (assumes current point there unless start)
    if (start) ctx.moveTo(pts[0][0], pts[0][1]); else ctx.lineTo(pts[0][0], pts[0][1]);
    for (var k = 1; k < pts.length; k++) {
      if (curve) {
        var p0 = pts[k - 2] || pts[k - 1], p1 = pts[k - 1], p2 = pts[k], p3 = pts[k + 1] || p2, t = 0.18;
        ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t, p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t, p2[0], p2[1]);
      } else ctx.lineTo(pts[k][0], pts[k][1]);
    }
  }

  function yAxis(C, P, nt, Y, fmtFn) {
    var ctx = C.ctx, S = C.S, u = C.u;
    setFont(ctx, S, 20 * u, 500);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    nt.ticks.forEach(function (tv) {
      if (tv < nt.lo - 1e-9 || tv > nt.hi + 1e-9) return;
      gridLine(ctx, P.x, Y(tv), P.x + P.w, Y(tv), withAlpha(S.textColor, tv === 0 ? 0.35 : 0.1), (tv === 0 ? 2 : 1.5) * u);
      ctx.fillStyle = withAlpha(S.textColor, 0.55);
      ctx.fillText(fmtFn ? fmtFn(tv) : fmtTick(tv, S, nt.step), P.x - 12 * u, Y(tv));
    });
  }

  function tickWidth(C, nt, fmtFn) {
    setFont(C.ctx, C.S, 20 * C.u, 500);
    var w = 0;
    nt.ticks.forEach(function (tv) { w = Math.max(w, C.ctx.measureText(fmtFn ? fmtFn(tv) : fmtTick(tv, C.S, nt.step)).width); });
    return w;
  }

  /* Spreads labels vertically so they do not overlap. items: [{y}] → sets .ly */
  function spreadLabels(items, gap, lo, hi) {
    items.sort(function (a, b) { return a.y - b.y; });
    items.forEach(function (h) { h.ly = h.y; });
    for (var it = 0; it < 40; it++) {
      for (var k = 1; k < items.length; k++) {
        var d = items[k].ly - items[k - 1].ly;
        if (d < gap) { var push = (gap - d) / 2; items[k].ly += push; items[k - 1].ly -= push; }
      }
      if (items.length) {
        if (lo != null && items[0].ly < lo) { var s1 = lo - items[0].ly; items.forEach(function (h) { h.ly += s1; }); }
        if (hi != null && items[items.length - 1].ly > hi) { var s2 = items[items.length - 1].ly - hi; items.forEach(function (h) { h.ly -= s2; }); }
      }
    }
  }

  function mixColor(a, b, t) {
    var pa = parseInt(String(a).replace('#', ''), 16), pb = parseInt(String(b).replace('#', ''), 16);
    var r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t)), g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t)), bl = Math.round(lerp(pa & 255, pb & 255, t));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  }

  function toHex(c) {
    if (/^#[0-9a-f]{6}$/i.test(c)) return c;
    if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map(function (x) { return x + x; }).join('');
    return '#888888';
  }

  function parseDate(v) {
    if (v == null || String(v).trim() === '') return NaN;
    var s = String(v).trim();
    if (/^-?\d{1,4}$/.test(s)) return Date.UTC(+s, 0, 1);
    var m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/); // dd/mm/yyyy (UK)
    if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    var t = Date.parse(s.length === 10 ? s + 'T00:00:00Z' : s);
    return isFinite(t) ? t : NaN;
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function sweepText(ctx, text, x, y, k) {
    ctx.save(); ctx.globalAlpha *= clamp(k, 0, 1); ctx.fillText(text, x, y); ctx.restore();
  }

  /* ---------------- Area chart ---------------- */
  TEMPLATES.area = {
    name: 'Area chart',
    description: 'Stacked, 100% or streamgraph areas over time',
    dataHint: 'First column: x values (dates, years or labels). Each further column is one series.',
    settings: [
      { group: 'Areas', key: 'areaMode', label: 'Type', type: 'select', def: 'stacked', options: ['stacked', '100% stacked', 'overlapping', 'streamgraph'] },
      { group: 'Areas', key: 'curve', label: 'Smooth curves', type: 'checkbox', def: true },
      { group: 'Areas', key: 'areaOpacity', label: 'Fill opacity', type: 'range', def: 0.85, min: 0.1, max: 1, step: 0.01 },
      { group: 'Areas', key: 'showLegend', label: 'Show legend', type: 'checkbox', def: true },
      { group: 'Areas', key: 'inlineLabels', label: 'Label inside areas', type: 'checkbox', def: true }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var header = C.T[0] || [], rows = cleanRows(C.T), names = header.slice(1);
      if (rows.length < 2 || !names.length) return noData(C, R);
      var color = colorer(S), XI = xAxisInfo(rows), n = rows.length, ns = names.length;
      var V = rows.map(function (r) { return names.map(function (_, j) { var v = num(r[j + 1]); return isFinite(v) ? Math.max(0, v) : 0; }); });
      if (S.areaMode === 'overlapping') V = rows.map(function (r) { return names.map(function (_, j) { var v = num(r[j + 1]); return isFinite(v) ? v : 0; }); });
      var totals = V.map(function (row) { return row.reduce(function (a, b) { return a + b; }, 0); });
      var maxTot = Math.max.apply(null, totals) || 1;
      var lo = 0, hi;
      var bands = names.map(function () { return []; }); // per series: [[y0,y1] per x]
      V.forEach(function (row, i) {
        var base = S.areaMode === 'streamgraph' ? -totals[i] / 2 : 0, acc = base;
        row.forEach(function (v, j) {
          if (S.areaMode === 'overlapping') { bands[j].push([0, v]); return; }
          var val = S.areaMode === '100% stacked' ? (totals[i] ? v / totals[i] : 0) : v;
          bands[j].push([acc, acc + val]); acc += val;
        });
      });
      if (S.areaMode === '100% stacked') { lo = 0; hi = 1; }
      else if (S.areaMode === 'streamgraph') { lo = -maxTot / 2; hi = maxTot / 2; }
      else if (S.areaMode === 'overlapping') { hi = -Infinity; lo = 0; V.forEach(function (r) { r.forEach(function (v) { hi = Math.max(hi, v); lo = Math.min(lo, v); }); }); }
      else hi = maxTot;
      var nt = niceTicks(lo, hi, 5);
      if (S.areaMode === '100% stacked') nt = { ticks: [0, 0.25, 0.5, 0.75, 1], lo: 0, hi: 1, step: 0.25 };
      var pctFmt = function (v) { return Math.round(v * 100) + '%'; };
      var tf = S.areaMode === '100% stacked' ? pctFmt : null;
      var top = R.y;
      if (S.showLegend) top += legend(C, names.map(function (nm, j) { return { label: String(nm), color: color(nm, j) }; }), R.x, R.y, R.w);
      var stream = S.areaMode === 'streamgraph';
      var leftPad = stream ? 10 * u : tickWidth(C, nt, tf) + 16 * u;
      var P = { x: R.x + leftPad, y: top + 10 * u, w: R.w - leftPad - 10 * u, h: R.y + R.h - top - 10 * u - 40 * u };
      var X = function (v) { return P.x + (v - XI.lo) / (XI.hi - XI.lo) * P.w; };
      var Y = function (v) { return P.y + P.h - (v - nt.lo) / (nt.hi - nt.lo) * P.h; };
      if (!stream) yAxis(C, P, nt, Y, tf);
      drawXLabels(C, P, XI, X);
      ctx.save();
      ctx.beginPath(); ctx.rect(P.x - 2, P.y - 20 * u, (P.w + 4) * C.pEased, P.h + 40 * u); ctx.clip();
      var order = names.map(function (_, j) { return j; });
      order.forEach(function (j) {
        var topPts = bands[j].map(function (b, i) { return [X(XI.xv[i]), Y(b[1])]; });
        var botPts = bands[j].map(function (b, i) { return [X(XI.xv[i]), Y(b[0])]; }).reverse();
        var col = color(names[j], j);
        ctx.beginPath(); smoothTo(ctx, topPts, S.curve, true); smoothTo(ctx, botPts, S.curve, false); ctx.closePath();
        ctx.fillStyle = withAlpha(col, S.areaMode === 'overlapping' ? Math.min(0.45, S.areaOpacity) : S.areaOpacity); ctx.fill();
        if (S.areaMode === 'overlapping') { ctx.beginPath(); smoothTo(ctx, topPts, S.curve, true); ctx.strokeStyle = col; ctx.lineWidth = 3.5 * u; ctx.stroke(); }
      });
      ctx.restore();
      if (S.inlineLabels && S.areaMode !== 'overlapping') {
        setFont(ctx, S, 22 * u, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        names.forEach(function (nm, j) {
          var best = -1, bi = 0;
          bands[j].forEach(function (b, i) { var t = Math.abs(Y(b[0]) - Y(b[1])); if (t > best) { best = t; bi = i; } });
          var lx = X(XI.xv[bi]); if (lx > P.x + P.w * C.pEased) return;
          var tw = ctx.measureText(String(nm)).width;
          if (best < 30 * u) return;
          lx = clamp(lx, P.x + tw / 2 + 8 * u, P.x + P.w - tw / 2 - 8 * u);
          ctx.fillStyle = contrastText(toHex(color(nm, j)));
          ctx.fillText(String(nm), lx, (Y(bands[j][bi][0]) + Y(bands[j][bi][1])) / 2);
        });
      }
    }
  };

  /* ---------------- Waterfall ---------------- */
  TEMPLATES.waterfall = {
    name: 'Waterfall chart',
    description: 'How a starting value rises and falls to a total',
    dataHint: 'First column: step name. Second column: the change (positive or negative). Type “total” (or leave blank) in the value column to show a running subtotal at that point.',
    settings: [
      { group: 'Waterfall', key: 'firstIsStart', label: 'First row is the starting value', type: 'checkbox', def: true },
      { group: 'Waterfall', key: 'showTotal', label: 'Add a final total bar', type: 'checkbox', def: true },
      { group: 'Waterfall', key: 'totalLabel', label: 'Total bar label', type: 'text', def: 'Total' },
      { group: 'Waterfall', key: 'upColor', label: 'Increase colour', type: 'color', def: '#16B88A' },
      { group: 'Waterfall', key: 'downColor', label: 'Decrease colour', type: 'color', def: '#F05252' },
      { group: 'Waterfall', key: 'totalColor', label: 'Total colour', type: 'color', def: '#2E6BFF' },
      { group: 'Waterfall', key: 'showValues', label: 'Value labels', type: 'checkbox', def: true },
      { group: 'Waterfall', key: 'connectors', label: 'Connector lines', type: 'checkbox', def: true }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var rows = cleanRows(C.T);
      if (!rows.length) return noData(C, R);
      var bars = [], acc = 0;
      rows.forEach(function (r, i) {
        var raw = String(r[1] == null ? '' : r[1]).trim(), v = num(raw);
        var isTotal = raw === '' || /^(total|subtotal|=)$/i.test(raw);
        if (isTotal) { bars.push({ label: String(r[0]), y0: 0, y1: acc, kind: 'total', v: acc }); return; }
        if (!isFinite(v)) return;
        if (i === 0 && S.firstIsStart) { acc = v; bars.push({ label: String(r[0]), y0: 0, y1: v, kind: 'total', v: v }); return; }
        bars.push({ label: String(r[0]), y0: acc, y1: acc + v, kind: v >= 0 ? 'up' : 'down', v: v }); acc += v;
      });
      if (S.showTotal) bars.push({ label: S.totalLabel || 'Total', y0: 0, y1: acc, kind: 'total', v: acc });
      var lo = 0, hi = 0; bars.forEach(function (b) { lo = Math.min(lo, b.y0, b.y1); hi = Math.max(hi, b.y0, b.y1); });
      var nt = niceTicks(lo, hi, 5);
      var leftPad = tickWidth(C, nt) + 16 * u;
      var P = { x: R.x + leftPad, y: R.y + 34 * u, w: R.w - leftPad, h: R.h - 34 * u - 50 * u };
      var Y = function (v) { return P.y + P.h - (v - nt.lo) / (nt.hi - nt.lo) * P.h; };
      yAxis(C, P, nt, Y);
      var n = bars.length, gw = P.w / n, bw = gw * 0.66;
      var col = { up: S.upColor, down: S.downColor, total: S.totalColor };
      var labSize = clamp(gw * 0.16, 11 * u, 22 * u);
      bars.forEach(function (b, i) {
        var start = n > 1 ? i / (n - 1) * 0.6 : 0, k = C.ease(clamp((C.pLinear - start) / 0.4, 0, 1));
        var x = P.x + i * gw + (gw - bw) / 2;
        setFont(ctx, S, labSize, 500); ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = withAlpha(S.textColor, 0.75);
        wrap(ctx, b.label, gw - 6 * u).slice(0, 2).forEach(function (l, li) { ctx.fillText(ellipsis(ctx, l, gw - 4 * u), x + bw / 2, P.y + P.h + 10 * u + li * labSize * 1.15); });
        if (k <= 0) return;
        var yEnd = lerp(b.y0, b.y1, k);
        ctx.fillStyle = col[b.kind];
        rrect(ctx, x, Y(Math.max(b.y0, yEnd)), bw, Math.max(1, Math.abs(Y(yEnd) - Y(b.y0))), 4 * u); ctx.fill();
        if (S.connectors && i < n - 1 && k >= 1) {
          ctx.setLineDash([5 * u, 5 * u]);
          gridLine(ctx, x + bw, Y(b.y1), x + gw + (gw - bw) / 2, Y(b.y1), withAlpha(S.textColor, 0.35), 1.5 * u);
          ctx.setLineDash([]);
        }
        if (S.showValues && k > 0.6) {
          setFont(ctx, S, labSize, 700); ctx.textBaseline = 'bottom'; ctx.fillStyle = withAlpha(S.textColor, 0.85 * (k - 0.6) / 0.4);
          var txt = (b.kind === 'up' ? '+' : '') + fmt(b.v, S);
          ctx.fillText(txt, x + bw / 2, Y(Math.max(b.y0, b.y1)) - 6 * u);
        }
      });
    }
  };

  /* ---------------- Slope chart ---------------- */
  TEMPLATES.slope = {
    name: 'Slope chart',
    description: 'Before-and-after change between two points',
    dataHint: 'First column: names. Second column: the “before” value. Third column: the “after” value. The column headers become the two axis titles.',
    settings: [
      { group: 'Slopes', key: 'slopeColor', label: 'Colour lines by', type: 'select', def: 'change', options: ['change', 'name'] },
      { group: 'Slopes', key: 'upColor', label: 'Increase colour', type: 'color', def: '#16B88A' },
      { group: 'Slopes', key: 'downColor', label: 'Decrease colour', type: 'color', def: '#F05252' },
      { group: 'Slopes', key: 'lineWidth', label: 'Line width', type: 'range', def: 4, min: 1, max: 12, step: 0.5 },
      { group: 'Slopes', key: 'zeroBase', label: 'Axis starts at zero', type: 'checkbox', def: false }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var header = C.T[0] || [], rows = cleanRows(C.T);
      var lastCol = Math.max(2, header.length - 1);
      var items = rows.map(function (r, i) { return { label: String(r[0]), a: num(r[1]), b: num(r[lastCol]), i: i }; })
        .filter(function (d) { return isFinite(d.a) && isFinite(d.b); });
      if (!items.length) return noData(C, R);
      var color = colorer(S);
      var lo = Infinity, hi = -Infinity;
      items.forEach(function (d) { lo = Math.min(lo, d.a, d.b); hi = Math.max(hi, d.a, d.b); });
      if (S.zeroBase) lo = Math.min(0, lo);
      var pad = (hi - lo) * 0.05 || 1; lo -= S.zeroBase ? 0 : pad; hi += pad;
      setFont(ctx, S, 22 * u, 600);
      var lw = 0; items.forEach(function (d) { lw = Math.max(lw, ctx.measureText(d.label + '  ' + fmt(Math.max(Math.abs(d.a), Math.abs(d.b)), S)).width); });
      lw = Math.min(lw + 30 * u, R.w * 0.32);
      var P = { x: R.x + lw, y: R.y + 60 * u, w: R.w - lw * 2, h: R.h - 70 * u };
      var Y = function (v) { return P.y + P.h - (v - lo) / (hi - lo) * P.h; };
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      setFont(ctx, S, 26 * u, 800); ctx.fillStyle = S.textColor;
      ctx.fillText(String(header[1] || ''), P.x, P.y - 22 * u);
      ctx.fillText(String(header[lastCol] || ''), P.x + P.w, P.y - 22 * u);
      gridLine(ctx, P.x, P.y - 10 * u, P.x, P.y + P.h, withAlpha(S.textColor, 0.25), 2 * u);
      gridLine(ctx, P.x + P.w, P.y - 10 * u, P.x + P.w, P.y + P.h, withAlpha(S.textColor, 0.25), 2 * u);
      var k = C.pEased;
      var colOf = function (d) { return S.slopeColor === 'name' ? color(d.label, d.i) : (d.b >= d.a ? S.upColor : S.downColor); };
      items.forEach(function (d) {
        var c = colOf(d), x1 = lerp(P.x, P.x + P.w, k), y1 = lerp(Y(d.a), Y(d.b), k);
        ctx.strokeStyle = c; ctx.lineWidth = S.lineWidth * u; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(P.x, Y(d.a)); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(P.x, Y(d.a), S.lineWidth * u * 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x1, y1, S.lineWidth * u * 1.5, 0, Math.PI * 2); ctx.fill();
      });
      var gap = 30 * u;
      var L = items.map(function (d) { return { y: Y(d.a), d: d }; }), Rr = items.map(function (d) { return { y: Y(d.b), d: d }; });
      spreadLabels(L, gap, P.y, P.y + P.h); spreadLabels(Rr, gap, P.y, P.y + P.h);
      ctx.textBaseline = 'middle';
      L.forEach(function (o) {
        ctx.textAlign = 'right'; setFont(ctx, S, 22 * u, 600); ctx.fillStyle = S.textColor;
        var v = fmt(o.d.a, S); var vw = ctx.measureText(v).width;
        ctx.fillText(v, P.x - 14 * u, o.ly);
        setFont(ctx, S, 22 * u, 500); ctx.fillStyle = withAlpha(S.textColor, 0.7);
        ctx.fillText(ellipsis(ctx, o.d.label, lw - vw - 40 * u), P.x - 24 * u - vw, o.ly);
      });
      Rr.forEach(function (o) {
        ctx.save(); ctx.globalAlpha = clamp((k - 0.8) / 0.2, 0, 1);
        ctx.textAlign = 'left'; setFont(ctx, S, 22 * u, 700); ctx.fillStyle = colOf(o.d);
        var v = fmt(o.d.b, S); var vw = ctx.measureText(v).width;
        ctx.fillText(v, P.x + P.w + 14 * u, o.ly);
        setFont(ctx, S, 22 * u, 500); ctx.fillStyle = withAlpha(S.textColor, 0.7);
        ctx.fillText(ellipsis(ctx, o.d.label, lw - vw - 40 * u), P.x + P.w + 24 * u + vw, o.ly);
        ctx.restore();
      });
    }
  };

  /* ---------------- Radar ---------------- */
  TEMPLATES.radar = {
    name: 'Radar chart',
    description: 'Compare several measures on spokes',
    dataHint: 'First column: the measures (one spoke each). Each further column is one series drawn as a shape.',
    settings: [
      { group: 'Radar', key: 'radarMax', label: 'Maximum value (0 = auto)', type: 'number', def: 0, min: 0, step: 1 },
      { group: 'Radar', key: 'gridShape', label: 'Grid shape', type: 'select', def: 'polygon', options: ['polygon', 'circle'] },
      { group: 'Radar', key: 'gridLevels', label: 'Grid rings', type: 'number', def: 5, min: 1, max: 12, step: 1 },
      { group: 'Radar', key: 'fillOpacity', label: 'Fill opacity', type: 'range', def: 0.18, min: 0, max: 0.8, step: 0.01 },
      { group: 'Radar', key: 'showDots', label: 'Dots on points', type: 'checkbox', def: true }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var header = C.T[0] || [], rows = cleanRows(C.T), names = header.slice(1);
      if (rows.length < 3 || !names.length) return noData(C, R);
      var color = colorer(S), n = rows.length;
      var max = S.radarMax > 0 ? S.radarMax : 0;
      if (!max) { rows.forEach(function (r) { names.forEach(function (_, j) { var v = num(r[j + 1]); if (isFinite(v)) max = Math.max(max, v); }); }); max = niceTicks(0, max, S.gridLevels).hi || 1; }
      var top = R.y;
      if (names.length > 1) top += legend(C, names.map(function (nm, j) { return { label: String(nm), color: color(nm, j) }; }), R.x, R.y, R.w);
      var A = { x: R.x, y: top, w: R.w, h: R.y + R.h - top };
      setFont(ctx, S, 22 * u, 600);
      var lab = 0; rows.forEach(function (r) { lab = Math.max(lab, Math.min(ctx.measureText(String(r[0])).width, 220 * u)); });
      var rad = Math.min(A.w / 2 - lab - 20 * u, A.h / 2 - 40 * u);
      var cx = A.x + A.w / 2, cy = A.y + A.h / 2;
      var ang = function (i) { return -Math.PI / 2 + i / n * Math.PI * 2; };
      var lv = Math.max(1, S.gridLevels | 0);
      for (var l = 1; l <= lv; l++) {
        var rr = rad * l / lv;
        ctx.beginPath();
        if (S.gridShape === 'circle') ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        else for (var i = 0; i <= n; i++) { var a = ang(i % n); ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
        ctx.strokeStyle = withAlpha(S.textColor, 0.12); ctx.lineWidth = 1.5 * u; ctx.stroke();
        setFont(ctx, S, 16 * u, 500); ctx.fillStyle = withAlpha(S.textColor, 0.45); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(fmtTick(max * l / lv, S, max / lv), cx + 4 * u, cy - rr - 2 * u);
      }
      rows.forEach(function (r, i) {
        var a = ang(i);
        gridLine(ctx, cx, cy, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, withAlpha(S.textColor, 0.12), 1.5 * u);
        setFont(ctx, S, 22 * u, 600); ctx.fillStyle = S.textColor;
        var ca = Math.cos(a), sa = Math.sin(a);
        ctx.textAlign = Math.abs(ca) < 0.2 ? 'center' : ca > 0 ? 'left' : 'right';
        ctx.textBaseline = Math.abs(sa) < 0.2 ? 'middle' : sa > 0 ? 'top' : 'bottom';
        ctx.fillText(ellipsis(ctx, String(r[0]), lab), cx + ca * (rad + 14 * u), cy + sa * (rad + 14 * u));
      });
      names.forEach(function (nm, j) {
        var st = names.length > 1 ? j / (names.length - 1) * 0.35 : 0;
        var k = C.ease(clamp((C.pLinear - st) / 0.65, 0, 1));
        if (k <= 0) return;
        var c = color(nm, j), pts = rows.map(function (r, i) { var v = num(r[j + 1]); v = isFinite(v) ? clamp(v / max, 0, 1.2) : 0; var a = ang(i); return [cx + Math.cos(a) * rad * v * k, cy + Math.sin(a) * rad * v * k]; });
        ctx.beginPath(); pts.forEach(function (p, i) { ctx[i ? 'lineTo' : 'moveTo'](p[0], p[1]); }); ctx.closePath();
        ctx.fillStyle = withAlpha(c, S.fillOpacity); ctx.fill();
        ctx.strokeStyle = c; ctx.lineWidth = 3.5 * u; ctx.lineJoin = 'round'; ctx.stroke();
        if (S.showDots) pts.forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], 5 * u, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); });
      });
    }
  };

  /* ---------------- Survey / diverging Likert bars ---------------- */
  TEMPLATES.survey = {
    name: 'Survey results',
    description: 'Diverging bars for agree/disagree scales',
    dataHint: 'First column: the question or statement. Further columns: the answer options in order from most negative to most positive (e.g. Strongly disagree … Strongly agree). Cells are counts or percentages.',
    settings: [
      { group: 'Survey', key: 'neutral', label: 'Middle (neutral) answer', type: 'select', def: 'centred', options: ['centred', 'at the end', 'hidden'] },
      { group: 'Survey', key: 'showPercent', label: 'Show percentages', type: 'checkbox', def: true },
      { group: 'Survey', key: 'negColor', label: 'Negative colour', type: 'color', def: '#E8590C' },
      { group: 'Survey', key: 'posColor', label: 'Positive colour', type: 'color', def: '#2E6BFF' },
      { group: 'Survey', key: 'neutralColor', label: 'Neutral colour', type: 'color', def: '#C9CDD6' },
      { group: 'Survey', key: 'barRadius', label: 'Corner radius', type: 'range', def: 4, min: 0, max: 20, step: 1 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var header = C.T[0] || [], rows = cleanRows(C.T), opts = header.slice(1);
      var m = opts.length;
      if (!rows.length || m < 2) return noData(C, R);
      var half = Math.floor(m / 2), hasNeutral = m % 2 === 1;
      var custom = parseCustomColors(S.customColors);
      var colors = opts.map(function (o, i) {
        if (custom[String(o).toLowerCase()]) return custom[String(o).toLowerCase()];
        if (hasNeutral && i === half) return S.neutralColor;
        if (i < half) return mixColor(toHex(S.negColor), '#ffffff', half > 1 ? i / (half - 1) * 0.55 : 0);
        var pi = i - (hasNeutral ? half + 1 : half);
        return mixColor(toHex(S.posColor), '#ffffff', half > 1 ? (half - 1 - pi) / (half - 1) * 0.55 : 0);
      });
      var legItems = opts.map(function (o, i) { return { label: String(o), color: colors[i] }; });
      if (hasNeutral && S.neutral === 'hidden') legItems.splice(half, 1);
      var top = R.y + legend(C, legItems, R.x, R.y, R.w) + 6 * u;
      var data = rows.map(function (r) {
        var v = opts.map(function (_, i) { var x = num(r[i + 1]); return isFinite(x) ? Math.max(0, x) : 0; });
        var tot = v.reduce(function (a, b) { return a + b; }, 0) || 1;
        return { label: String(r[0]), p: v.map(function (x) { return x / tot; }) };
      });
      var neg = function (d) { var s = 0; for (var i = 0; i < half; i++) s += d.p[i]; return s; };
      var pos = function (d) { var s = 0; for (var i = hasNeutral ? half + 1 : half; i < m; i++) s += d.p[i]; return s; };
      var neu = function (d) { return hasNeutral ? d.p[half] : 0; };
      var maxL = 0, maxR = 0;
      data.forEach(function (d) {
        var nl = neg(d) + (S.neutral === 'centred' ? neu(d) / 2 : 0), pr = pos(d) + (S.neutral === 'centred' ? neu(d) / 2 : 0);
        maxL = Math.max(maxL, nl); maxR = Math.max(maxR, pr);
      });
      var neutralW = S.neutral === 'at the end' && hasNeutral ? Math.max.apply(null, data.map(neu)) : 0;
      setFont(ctx, S, 22 * u, 600);
      var labW = Math.min(R.w * 0.3, Math.max.apply(null, data.map(function (d) { return ctx.measureText(d.label).width; })) + 20 * u);
      var avail = R.w - labW - (neutralW ? 30 * u : 0);
      var scale = avail / (maxL + maxR + neutralW || 1);
      var cx = R.x + labW + maxL * scale;
      var rh = (R.y + R.h - top) / data.length, bh = Math.min(rh * 0.62, 70 * u);
      gridLine(ctx, cx, top, cx, R.y + R.h, withAlpha(S.textColor, 0.4), 2 * u);
      var k = C.pEased;
      data.forEach(function (d, di) {
        var y = top + di * rh + (rh - bh) / 2;
        setFont(ctx, S, clamp(rh * 0.28, 12 * u, 22 * u), 600); ctx.fillStyle = S.textColor; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        var ls = wrap(ctx, d.label, labW - 20 * u).slice(0, 2), lh = clamp(rh * 0.28, 12 * u, 22 * u) * 1.2;
        ls.forEach(function (l, li) { ctx.fillText(ellipsis(ctx, l, labW - 20 * u), R.x, y + bh / 2 + (li - (ls.length - 1) / 2) * lh); });
        var segs = [];
        var leftStart = cx - (neg(d) + (S.neutral === 'centred' ? neu(d) / 2 : 0)) * scale;
        var x = leftStart;
        for (var i = 0; i < m; i++) {
          if (hasNeutral && i === half && S.neutral !== 'centred') continue;
          segs.push({ i: i, x: x, w: d.p[i] * scale }); x += d.p[i] * scale;
        }
        if (hasNeutral && S.neutral === 'at the end') segs.push({ i: half, x: R.x + R.w - neutralW * scale, w: d.p[half] * scale });
        segs.forEach(function (s) {
          var sx = s.i === half && S.neutral === 'at the end' && hasNeutral ? s.x : cx + (s.x - cx) * k;
          var sw = s.w * k;
          if (sw <= 0.5) return;
          ctx.fillStyle = colors[s.i];
          rrect(ctx, sx, y, sw, bh, S.barRadius * u); ctx.fill();
          if (S.showPercent && sw > 44 * u && k > 0.85) {
            setFont(ctx, S, clamp(bh * 0.36, 11 * u, 20 * u), 700);
            ctx.fillStyle = contrastText(toHex(colors[s.i])); ctx.textAlign = 'center';
            ctx.fillText(Math.round(d.p[s.i] * 100) + '%', sx + sw / 2, y + bh / 2);
          }
        });
      });
    }
  };

  /* ---------------- Table ---------------- */
  TEMPLATES.table = {
    name: 'Table',
    description: 'A styled table with inline bars or heatmap',
    dataHint: 'Any table. The first row is the header. Number columns get inline bars or heatmap shading. Type an uploaded image name (or an emoji) in a cell to show it as a picture.',
    settings: [
      { group: 'Table', key: 'cellStyle', label: 'Number columns', type: 'select', def: 'bars', options: ['bars', 'heatmap', 'plain'] },
      { group: 'Table', key: 'sortColumn', label: 'Sort by column (0 = as entered)', type: 'number', def: 0, min: 0, max: 50, step: 1 },
      { group: 'Table', key: 'sortDesc', label: 'Sort largest first', type: 'checkbox', def: true },
      { group: 'Table', key: 'maxRows', label: 'Maximum rows', type: 'number', def: 15, min: 1, max: 100, step: 1 },
      { group: 'Table', key: 'zebra', label: 'Striped rows', type: 'checkbox', def: true },
      { group: 'Table', key: 'headerColor', label: 'Header colour', type: 'color', def: '#1f2430' }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var header = C.T[0] || [], rows = cleanRows(C.T);
      if (!rows.length) return noData(C, R);
      var nc = header.length;
      var numeric = header.map(function (_, c) { return c > 0 && rows.every(function (r) { return String(r[c] == null ? '' : r[c]).trim() === '' || isFinite(num(r[c])); }); });
      if (S.sortColumn > 0 && S.sortColumn <= nc) {
        var sc = S.sortColumn - 1;
        rows = rows.slice().sort(function (a, b) {
          var va = numeric[sc] ? num(a[sc]) : String(a[sc]), vb = numeric[sc] ? num(b[sc]) : String(b[sc]);
          var cmp = numeric[sc] ? (va - vb) : (va < vb ? -1 : va > vb ? 1 : 0);
          return S.sortDesc ? -cmp : cmp;
        });
      }
      rows = rows.slice(0, Math.max(1, S.maxRows | 0));
      var colMax = header.map(function (_, c) { var m = 0; if (numeric[c]) rows.forEach(function (r) { var v = num(r[c]); if (isFinite(v)) m = Math.max(m, Math.abs(v)); }); return m || 1; });
      var rh = Math.min(64 * u, R.h / (rows.length + 1)), fs = clamp(rh * 0.38, 11 * u, 26 * u);
      setFont(ctx, S, fs, 600);
      var widths = header.map(function (h, c) {
        var w = ctx.measureText(String(h)).width;
        rows.forEach(function (r) { var t = numeric[c] ? fmt(num(r[c]), S) : String(r[c] == null ? '' : r[c]); w = Math.max(w, ctx.measureText(t).width); });
        return w + (numeric[c] && S.cellStyle === 'bars' ? 120 * u : 30 * u);
      });
      var tw = widths.reduce(function (a, b) { return a + b; }, 0);
      var sc2 = R.w / tw; widths = widths.map(function (w) { return w * sc2; });
      var hc = S.headerColor;
      ctx.fillStyle = hc; rrect(ctx, R.x, R.y, R.w, rh, 8 * u); ctx.fill();
      var x = R.x;
      setFont(ctx, S, fs, 700); ctx.textBaseline = 'middle';
      header.forEach(function (h, c) {
        ctx.fillStyle = contrastText(toHex(hc)); ctx.textAlign = numeric[c] ? 'right' : 'left';
        ctx.fillText(ellipsis(ctx, String(h), widths[c] - 24 * u), numeric[c] ? x + widths[c] - 14 * u : x + 14 * u, R.y + rh / 2);
        x += widths[c];
      });
      var color = colorer(S);
      rows.forEach(function (r, ri) {
        var st = rows.length > 1 ? ri / (rows.length - 1) * 0.6 : 0, k = clamp((C.pLinear - st) / 0.4, 0, 1);
        if (k <= 0) return;
        var e = C.ease(k), y = R.y + rh * (ri + 1);
        ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.translate((1 - e) * 40 * u, 0);
        if (S.zebra && ri % 2 === 1) { ctx.fillStyle = withAlpha(S.textColor, 0.04); ctx.fillRect(R.x, y, R.w, rh); }
        gridLine(ctx, R.x, y + rh, R.x + R.w, y + rh, withAlpha(S.textColor, 0.08), 1 * u);
        var cx2 = R.x;
        header.forEach(function (_, c) {
          var w = widths[c], v = num(r[c]);
          if (numeric[c] && isFinite(v)) {
            var ccol = toHex(color(header[c], c - 1));
            if (S.cellStyle === 'bars') {
              var bw = (w - 28 * u) * Math.abs(v) / colMax[c] * e;
              ctx.fillStyle = withAlpha(ccol, 0.22); rrect(ctx, cx2 + 14 * u, y + rh * 0.18, bw, rh * 0.64, 4 * u); ctx.fill();
            } else if (S.cellStyle === 'heatmap') {
              ctx.fillStyle = withAlpha(ccol, 0.08 + 0.72 * Math.abs(v) / colMax[c]); ctx.fillRect(cx2 + 2 * u, y + 2 * u, w - 4 * u, rh - 4 * u);
            }
            setFont(ctx, S, fs, 600); ctx.textAlign = 'right';
            ctx.fillStyle = S.cellStyle === 'heatmap' && Math.abs(v) / colMax[c] > 0.6 ? contrastText(ccol) : S.textColor;
            ctx.fillText(fmt(v, S), cx2 + w - 14 * u, y + rh / 2);
          } else {
            setFont(ctx, S, fs, c === 0 ? 700 : 500); ctx.textAlign = 'left'; ctx.fillStyle = S.textColor;
            var ic = resolveIcon(r[c]);
            if (ic && (ic.image || (ic.emoji && String(r[c]).length <= 4))) drawIcon(ctx, r[c], cx2 + 14 * u, y + rh * 0.12, rh * 0.76, S.textColor);
            else ctx.fillText(ellipsis(ctx, String(r[c] == null ? '' : r[c]), w - 28 * u), cx2 + 14 * u, y + rh / 2);
          }
          cx2 += w;
        });
        ctx.restore();
      });
    }
  };

  /* ---------------- Marimekko ---------------- */
  TEMPLATES.marimekko = {
    name: 'Marimekko',
    description: 'Columns whose widths and heights are both shares',
    dataHint: 'First column: categories (they become columns, width = category total). Further columns: segments within each category.',
    settings: [
      { group: 'Marimekko', key: 'showLabels', label: 'Percentages inside segments', type: 'checkbox', def: true },
      { group: 'Marimekko', key: 'mekkoGap', label: 'Gap between blocks', type: 'range', def: 3, min: 0, max: 14, step: 0.5 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var header = C.T[0] || [], rows = cleanRows(C.T), segs = header.slice(1);
      if (!rows.length || !segs.length) return noData(C, R);
      var color = colorer(S);
      var cats = rows.map(function (r) { var v = segs.map(function (_, j) { var x = num(r[j + 1]); return isFinite(x) ? Math.max(0, x) : 0; }); return { label: String(r[0]), v: v, tot: v.reduce(function (a, b) { return a + b; }, 0) }; })
        .filter(function (c) { return c.tot > 0; });
      var grand = cats.reduce(function (a, c) { return a + c.tot; }, 0);
      if (!grand) return noData(C, R);
      var top = R.y + legend(C, segs.map(function (s, j) { return { label: String(s), color: color(s, j) }; }), R.x, R.y, R.w);
      var P = { x: R.x, y: top + 6 * u, w: R.w, h: R.y + R.h - top - 6 * u - 64 * u };
      var gap = S.mekkoGap * u, x = P.x;
      cats.forEach(function (c, ci) {
        var w = c.tot / grand * P.w;
        var st = cats.length > 1 ? ci / (cats.length - 1) * 0.5 : 0, k = C.ease(clamp((C.pLinear - st) / 0.5, 0, 1));
        var y = P.y + P.h;
        c.v.forEach(function (v, j) {
          var h = v / c.tot * P.h * k;
          if (h <= 0) return;
          var col = color(segs[j], j);
          ctx.fillStyle = col; ctx.fillRect(x + gap / 2, y - h + gap / 2, Math.max(0, w - gap), Math.max(0, h - gap));
          if (S.showLabels && w > 50 * u && h > 34 * u && k > 0.9) {
            setFont(ctx, S, clamp(Math.min(w, h) * 0.22, 11 * u, 22 * u), 700); ctx.fillStyle = contrastText(toHex(col));
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(v / c.tot * 100) + '%', x + w / 2, y - h / 2);
          }
          y -= h;
        });
        setFont(ctx, S, clamp(w * 0.14, 11 * u, 22 * u), 700); ctx.fillStyle = S.textColor; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(ellipsis(ctx, c.label, w - 6 * u), x + w / 2, P.y + P.h + 10 * u);
        setFont(ctx, S, clamp(w * 0.12, 10 * u, 19 * u), 500); ctx.fillStyle = withAlpha(S.textColor, 0.6);
        ctx.fillText(ellipsis(ctx, fmt(c.tot, S) + ' (' + Math.round(c.tot / grand * 100) + '%)', w - 6 * u), x + w / 2, P.y + P.h + 36 * u);
        x += w;
      });
    }
  };

  /* ---------------- Hierarchy helpers ---------------- */
  function buildTree(C) {
    var header = C.T[0] || [], rows = cleanRows(C.T);
    var nc = header.length;
    var valCol = nc - 1;
    var root = { name: 'root', children: [], v: 0, depth: 0 };
    rows.forEach(function (r) {
      var v = num(r[valCol]); if (!isFinite(v) || v <= 0) return;
      var node = root;
      for (var c = 0; c < valCol; c++) {
        var nm = String(r[c] == null ? '' : r[c]).trim(); if (!nm) break;
        var ch = null;
        for (var i = 0; i < node.children.length; i++) if (node.children[i].name === nm) { ch = node.children[i]; break; }
        if (!ch) { ch = { name: nm, children: [], v: 0, depth: node.depth + 1, parent: node }; node.children.push(ch); }
        node = ch;
      }
      node.own = (node.own || 0) + v;
    });
    (function sum(n) { n.v = (n.own || 0); n.children.forEach(function (c) { sum(c); n.v += c.v; }); n.children.sort(function (a, b) { return b.v - a.v; }); })(root);
    var maxD = 0; (function d(n) { maxD = Math.max(maxD, n.depth); n.children.forEach(d); })(root);
    root.maxDepth = maxD;
    return root;
  }

  /* ---------------- Sunburst ---------------- */
  TEMPLATES.sunburst = {
    name: 'Sunburst',
    description: 'Rings showing a hierarchy of parts',
    dataHint: 'One column per level of the hierarchy (e.g. Region, Country, City), then a final value column.',
    settings: [
      { group: 'Sunburst', key: 'holeSize', label: 'Centre hole', type: 'range', def: 0.25, min: 0, max: 0.6, step: 0.01 },
      { group: 'Sunburst', key: 'ringGap', label: 'Gap between slices', type: 'range', def: 1.5, min: 0, max: 6, step: 0.5 },
      { group: 'Sunburst', key: 'showLabels', label: 'Labels on slices', type: 'checkbox', def: true },
      { group: 'Sunburst', key: 'centerText', label: 'Centre caption', type: 'text', def: 'Total' }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var root = buildTree(C);
      if (!root.v || !root.children.length) return noData(C, R);
      var color = colorer(S);
      var cx = R.x + R.w / 2, cy = R.y + R.h / 2, rad = Math.min(R.w, R.h) / 2;
      var hole = rad * S.holeSize, ring = (rad - hole) / root.maxDepth;
      var sweep = C.pEased * Math.PI * 2;
      var labels = [];
      function draw(node, a0, a1, base) {
        var a = a0;
        node.children.forEach(function (ch, i) {
          var span = ch.v / node.v * (a1 - a0);
          var col = node === root ? toHex(color(ch.name, i)) : mixColor(base, '#ffffff', Math.min(0.55, 0.2 * (ch.depth - 1) + (i % 3) * 0.06));
          var s = a, e = a + span;
          var r0 = hole + (ch.depth - 1) * ring, r1 = r0 + ring;
          var start = -Math.PI / 2 + s, end = -Math.PI / 2 + Math.min(e, sweep);
          if (end > start) {
            var g = S.ringGap * u / Math.max(r1, 1);
            ctx.beginPath();
            ctx.arc(cx, cy, r1 - S.ringGap * u / 2, start + g / 2, Math.max(start + g / 2, end - g / 2));
            ctx.arc(cx, cy, r0 + S.ringGap * u / 2, Math.max(start + g / 2, end - g / 2), start + g / 2, true);
            ctx.closePath(); ctx.fillStyle = col; ctx.fill();
            if (S.showLabels && e <= sweep + 1e-6 && span * (r0 + r1) / 2 > 70 * u) labels.push({ n: ch, mid: -Math.PI / 2 + (s + e) / 2, r: (r0 + r1) / 2, col: col, arc: span * (r0 + r1) / 2 });
          }
          draw(ch, s, e, ch.depth === 1 ? col : base);
          a = e;
        });
      }
      draw(root, 0, Math.PI * 2, '#888888');
      labels.forEach(function (l) {
        var fs = clamp(Math.min(ring * 0.28, l.arc * 0.12), 11 * u, 24 * u);
        setFont(ctx, S, fs, 700);
        var x = cx + Math.cos(l.mid) * l.r, y = cy + Math.sin(l.mid) * l.r;
        var t = ellipsis(ctx, l.n.name, Math.min(l.arc * 0.9, ring * 1.6));
        ctx.fillStyle = contrastText(l.col); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t, x, y);
      });
      if (hole > 50 * u) {
        setFont(ctx, S, Math.min(hole * 0.38, 56 * u), 800); ctx.fillStyle = S.textColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(fmt(root.v * C.pEased, S), cx, cy - (S.centerText ? hole * 0.1 : 0));
        if (S.centerText) { setFont(ctx, S, Math.min(hole * 0.16, 22 * u), 500); ctx.fillStyle = withAlpha(S.textColor, 0.6); ctx.fillText(S.centerText, cx, cy + hole * 0.25); }
      }
    }
  };

  /* ---------------- Packed bubbles (bubble chart / circle packing) ---------------- */
  var packCache = {}, packKeys = [];
  function relaxPack(circles, iterations) {
    // circles: [{r}] sorted desc; deterministic phyllotaxis start then overlap relaxation
    var golden = Math.PI * (3 - Math.sqrt(5));
    var scaleR = circles.length ? circles[0].r : 1;
    circles.forEach(function (c, i) { var d = Math.sqrt(i) * scaleR * 1.1; c.x = Math.cos(i * golden) * d; c.y = Math.sin(i * golden) * d; });
    for (var it = 0; it < iterations; it++) {
      var pull = 0.02 * (1 - it / iterations) + 0.002;
      circles.forEach(function (c) { c.x -= c.x * pull; c.y -= c.y * pull; });
      for (var i = 0; i < circles.length; i++) {
        for (var j = i + 1; j < circles.length; j++) {
          var a = circles[i], b = circles[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1e-6, min = a.r + b.r + (a.pad || 0);
          if (d < min) {
            var o = (min - d) / 2, ux = dx / d, uy = dy / d;
            var wa = b.r * b.r / (a.r * a.r + b.r * b.r), wb = 1 - wa;
            a.x -= ux * o * 2 * wa; a.y -= uy * o * 2 * wa; b.x += ux * o * 2 * wb; b.y += uy * o * 2 * wb;
          }
        }
      }
    }
    var cx = 0, cy = 0, tw = 0;
    circles.forEach(function (c) { cx += c.x * c.r * c.r; cy += c.y * c.r * c.r; tw += c.r * c.r; });
    cx /= tw || 1; cy /= tw || 1;
    var enc = 0;
    circles.forEach(function (c) { c.x -= cx; c.y -= cy; enc = Math.max(enc, Math.sqrt(c.x * c.x + c.y * c.y) + c.r); });
    return enc;
  }

  TEMPLATES.packedBubbles = {
    name: 'Packed bubbles',
    description: 'Bubbles sized by value, optionally grouped',
    dataHint: 'First column: name. Second column: value (bubble area). Optional third column: group (bubbles cluster by group).',
    settings: [
      { group: 'Bubbles', key: 'bubblePad', label: 'Space between bubbles', type: 'range', def: 3, min: 0, max: 20, step: 0.5 },
      { group: 'Bubbles', key: 'showValues', label: 'Show values', type: 'checkbox', def: true },
      { group: 'Bubbles', key: 'groupOutlines', label: 'Outline groups', type: 'checkbox', def: true },
      { group: 'Bubbles', key: 'packFill', label: 'Fill amount', type: 'range', def: 0.92, min: 0.4, max: 1, step: 0.01 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var items = cleanRows(C.T).map(function (r) { return { label: String(r[0]), v: num(r[1]), group: String(r[2] == null ? '' : r[2]).trim() }; })
        .filter(function (d) { return isFinite(d.v) && d.v > 0; });
      if (!items.length) return noData(C, R);
      var color = colorer(S);
      var grouped = items.some(function (d) { return d.group; });
      var groups = [], gmap = {};
      items.forEach(function (d) { var g = grouped ? (d.group || 'Other') : ''; if (!gmap[g]) { gmap[g] = { name: g, items: [] }; groups.push(gmap[g]); } gmap[g].items.push(d); });
      var groupNames = groups.map(function (g) { return g.name; }), labels = items.map(function (d) { return d.label; });
      var top = R.y;
      if (grouped) top += legend(C, groups.map(function (g, i) { return { label: g.name, color: color(g.name, i) }; }), R.x, R.y, R.w);
      var A = { x: R.x, y: top, w: R.w, h: R.y + R.h - top };
      var key = JSON.stringify([items, S.bubblePad, grouped]);
      var L = packCache[key];
      if (!L) {
        var pad = S.bubblePad * 0.01;
        var maxV = Math.max.apply(null, items.map(function (d) { return d.v; }));
        var gcircles = groups.map(function (g) {
          var cs = g.items.map(function (d) { return { d: d, r: Math.sqrt(d.v / maxV), pad: pad }; }).sort(function (a, b) { return b.r - a.r; });
          var enc = relaxPack(cs, Math.min(400, 80 + cs.length * 3));
          return { g: g, cs: cs, r: enc + pad * 4, pad: pad * 6 };
        }).sort(function (a, b) { return b.r - a.r; });
        if (gcircles.length > 1) relaxPack(gcircles, 300); else { gcircles[0].x = 0; gcircles[0].y = 0; }
        var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        gcircles.forEach(function (gc) { minX = Math.min(minX, gc.x - gc.r); maxX = Math.max(maxX, gc.x + gc.r); minY = Math.min(minY, gc.y - gc.r); maxY = Math.max(maxY, gc.y + gc.r); });
        L = { gcs: gcircles, minX: minX, maxX: maxX, minY: minY, maxY: maxY };
        packCache[key] = L; packKeys.push(key); if (packKeys.length > 12) delete packCache[packKeys.shift()];
      }
      var sc = Math.min(A.w / (L.maxX - L.minX), A.h / (L.maxY - L.minY)) * S.packFill;
      var ox = A.x + A.w / 2 - (L.minX + L.maxX) / 2 * sc, oy = A.y + A.h / 2 - (L.minY + L.maxY) / 2 * sc;
      var all = [];
      L.gcs.forEach(function (gc) { gc.cs.forEach(function (c) { all.push({ c: c, gc: gc }); }); });
      all.sort(function (a, b) { return b.c.r - a.c.r; });
      var n = all.length;
      if (grouped && S.groupOutlines) {
        L.gcs.forEach(function (gc) {
          ctx.beginPath(); ctx.arc(ox + gc.x * sc, oy + gc.y * sc, gc.r * sc, 0, Math.PI * 2);
          ctx.fillStyle = withAlpha(S.textColor, 0.03 * C.pEased); ctx.fill();
          ctx.strokeStyle = withAlpha(S.textColor, 0.12 * C.pEased); ctx.lineWidth = 1.5 * u; ctx.stroke();
        });
      }
      all.forEach(function (o, i) {
        var st = n > 1 ? i / (n - 1) * 0.55 : 0, k = clamp((C.pLinear - st) / 0.45, 0, 1);
        if (k <= 0) return;
        var e = EASINGS.snappy(k), c = o.c;
        var x = ox + (o.gc.x + c.x) * sc, y = oy + (o.gc.y + c.y) * sc, r = c.r * sc * e;
        var gi = groupNames.indexOf(o.gc.g.name);
        var col = grouped ? color(o.gc.g.name, gi) : color(c.d.label, labels.indexOf(c.d.label));
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
        if (r > 34 * u) {
          var fs = clamp(r * 0.3, 11 * u, 40 * u);
          setFont(ctx, S, fs, 700); ctx.fillStyle = contrastText(toHex(col)); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          var lines = wrap(ctx, c.d.label, r * 1.6).slice(0, 2);
          var vh = S.showValues && r > 50 * u ? fs * 0.95 : 0;
          var y0 = y - ((lines.length - 1) * fs * 1.1 + vh) / 2;
          lines.forEach(function (l, li) { ctx.fillText(ellipsis(ctx, l, r * 1.7), x, y0 + li * fs * 1.1); });
          if (vh) { setFont(ctx, S, fs * 0.78, 500); ctx.globalAlpha = 0.85; ctx.fillText(fmt(c.d.v, S), x, y0 + lines.length * fs * 1.1); ctx.globalAlpha = 1; }
        }
      });
    }
  };

  /* ---------------- Gauge ---------------- */
  TEMPLATES.gauge = {
    name: 'Gauge',
    description: 'Dials showing progress towards a target',
    dataHint: 'First column: label. Second column: value. Optional third and fourth columns: minimum and maximum (default 0–100). Optional fifth column: a target marker.',
    settings: [
      { group: 'Gauge', key: 'gaugeArc', label: 'Dial shape', type: 'select', def: 'semicircle', options: ['semicircle', 'three-quarter'] },
      { group: 'Gauge', key: 'gaugeThickness', label: 'Thickness', type: 'range', def: 0.22, min: 0.05, max: 0.5, step: 0.01 },
      { group: 'Gauge', key: 'needle', label: 'Show needle', type: 'checkbox', def: false },
      { group: 'Gauge', key: 'trafficLight', label: 'Red / amber / green by value', type: 'checkbox', def: false },
      { group: 'Gauge', key: 'showRange', label: 'Show min and max', type: 'checkbox', def: true }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var color = colorer(S);
      var items = cleanRows(C.T).map(function (r, i) {
        var mn = num(r[2]), mx = num(r[3]);
        return { label: String(r[0]), v: num(r[1]), dec: decimalsOf(r[1]), min: isFinite(mn) ? mn : 0, max: isFinite(mx) ? mx : 100, target: num(r[4]), color: color(r[0], i) };
      }).filter(function (d) { return isFinite(d.v); });
      if (!items.length) return noData(C, R);
      var n = items.length, cols = 1, best = 0, gap = 30 * u;
      for (var c = 1; c <= n; c++) { var rr = Math.ceil(n / c), w = (R.w - gap * (c - 1)) / c, h = (R.h - gap * (rr - 1)) / rr, s = Math.min(w, h * 1.5); if (s > best) { best = s; cols = c; } }
      var rowsN = Math.ceil(n / cols), cw = (R.w - gap * (cols - 1)) / cols, ch = (R.h - gap * (rowsN - 1)) / rowsN;
      var three = S.gaugeArc === 'three-quarter';
      var a0 = three ? Math.PI * 0.75 : Math.PI, a1 = three ? Math.PI * 2.25 : Math.PI * 2;
      items.forEach(function (d, i) {
        var col = i % cols, row = Math.floor(i / cols), inRow = Math.min(cols, n - row * cols);
        var x = R.x + col * (cw + gap) + (cols - inRow) * (cw + gap) / 2, y = R.y + row * (ch + gap);
        var labelH = 60 * u;
        var rad = three ? Math.min(cw / 2, (ch - labelH) / 1.75) * 0.95 : Math.min(cw / 2, (ch - labelH) * 0.92) * 0.95;
        var cx = x + cw / 2, cy = three ? y + rad + 6 * u : y + rad + 10 * u;
        var th = rad * S.gaugeThickness;
        var st = n > 1 ? i / (n - 1) * 0.35 : 0, k = C.ease(clamp((C.pLinear - st) / 0.65, 0, 1));
        var frac = clamp((d.v - d.min) / (d.max - d.min || 1), 0, 1) * k;
        var fill = d.color;
        if (S.trafficLight) fill = frac < 0.33 ? '#F05252' : frac < 0.66 ? '#FFB020' : '#16B88A';
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy, rad - th / 2, a0, a1); ctx.strokeStyle = withAlpha(S.textColor, 0.1); ctx.lineWidth = th; ctx.stroke();
        if (frac > 0.001) { ctx.beginPath(); ctx.arc(cx, cy, rad - th / 2, a0, a0 + (a1 - a0) * frac); ctx.strokeStyle = fill; ctx.stroke(); }
        ctx.lineCap = 'butt';
        if (isFinite(d.target)) {
          var ta = a0 + (a1 - a0) * clamp((d.target - d.min) / (d.max - d.min || 1), 0, 1);
          gridLine(ctx, cx + Math.cos(ta) * (rad - th * 1.15), cy + Math.sin(ta) * (rad - th * 1.15), cx + Math.cos(ta) * (rad + th * 0.15), cy + Math.sin(ta) * (rad + th * 0.15), S.textColor, 4 * u);
        }
        if (S.needle) {
          var na = a0 + (a1 - a0) * frac;
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(na) * (rad - th * 1.3), cy + Math.sin(na) * (rad - th * 1.3));
          ctx.lineTo(cx + Math.cos(na + Math.PI / 2) * 8 * u, cy + Math.sin(na + Math.PI / 2) * 8 * u);
          ctx.lineTo(cx + Math.cos(na - Math.PI / 2) * 8 * u, cy + Math.sin(na - Math.PI / 2) * 8 * u); ctx.closePath();
          ctx.fillStyle = S.textColor; ctx.fill();
          ctx.beginPath(); ctx.arc(cx, cy, 10 * u, 0, Math.PI * 2); ctx.fill();
        }
        var fs = Math.min(rad * 0.36, 90 * u);
        setFont(ctx, S, fs, 800); ctx.fillStyle = S.textColor; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        var shown = d.min + (d.v - d.min) * k;
        ctx.fillText(fmt(shown, S, d.dec > 0 ? d.dec : (S.compact ? null : S.decimals)), cx, S.needle ? cy - rad * 0.3 : cy - (three ? -fs * 0.35 : 4 * u));
        if (S.showRange) {
          setFont(ctx, S, Math.max(12 * u, fs * 0.26), 500); ctx.fillStyle = withAlpha(S.textColor, 0.55); ctx.textBaseline = 'top';
          ctx.fillText(fmt(d.min, S), cx + Math.cos(a0) * (rad - th / 2), cy + Math.sin(a0) * (rad - th / 2) + th / 2 + 4 * u);
          ctx.fillText(fmt(d.max, S), cx + Math.cos(a1) * (rad - th / 2), cy + Math.sin(a1) * (rad - th / 2) + th / 2 + 4 * u);
        }
        setFont(ctx, S, clamp(rad * 0.13, 14 * u, 30 * u), 700); ctx.fillStyle = S.textColor; ctx.textBaseline = 'top';
        var ly = three ? cy + rad * 0.75 : cy + 36 * u;
        ctx.fillText(ellipsis(ctx, d.label, cw - 10 * u), cx, ly);
      });
    }
  };

  /* ---------------- Calendar heatmap ---------------- */
  TEMPLATES.calendar = {
    name: 'Calendar heatmap',
    description: 'Daily values laid out like a calendar',
    dataHint: 'First column: date (YYYY-MM-DD or DD/MM/YYYY). Second column: value for that day.',
    settings: [
      { group: 'Calendar', key: 'heatColor', label: 'Colour', type: 'color', def: '#16B88A' },
      { group: 'Calendar', key: 'weekStart', label: 'Weeks start on', type: 'select', def: 'Monday', options: ['Monday', 'Sunday'] },
      { group: 'Calendar', key: 'cellRadius', label: 'Cell corner radius', type: 'range', def: 0.2, min: 0, max: 0.5, step: 0.01 },
      { group: 'Calendar', key: 'showLegend', label: 'Show colour key', type: 'checkbox', def: true }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var DAY = 864e5;
      var pts = cleanRows(C.T).map(function (r) { return { t: parseDate(r[0]), v: num(r[1]) }; }).filter(function (p) { return isFinite(p.t) && isFinite(p.v); });
      if (!pts.length) return noData(C, R);
      var map = {}, maxV = 0, minT = Infinity, maxT = -Infinity;
      pts.forEach(function (p) { var d = Math.floor(p.t / DAY); map[d] = (map[d] || 0) + p.v; minT = Math.min(minT, d); maxT = Math.max(maxT, d); });
      Object.keys(map).forEach(function (k) { maxV = Math.max(maxV, map[k]); });
      var y0 = new Date(minT * DAY).getUTCFullYear(), y1 = new Date(maxT * DAY).getUTCFullYear();
      var years = []; for (var y = y0; y <= y1; y++) years.push(y);
      var mon = S.weekStart === 'Monday';
      var legH = S.showLegend ? 50 * u : 0;
      var labW = 70 * u, cell = Math.min((R.w - labW) / 54, (R.h - legH - years.length * 36 * u) / (years.length * 7.6));
      var bh = cell * 7 + 70 * u;
      var startY = R.y + (R.h - legH - years.length * bh - (years.length - 1) * cell * 0.6) / 2;
      var gx = R.x + (R.w - labW - cell * 54) / 2 + labW;
      var heat = toHex(S.heatColor), empty = withAlpha(S.textColor, 0.06);
      var reveal = minT + (maxT - minT + 1) * C.pLinear;
      years.forEach(function (yr, yi) {
        var by = startY + yi * (bh + cell * 0.6) + 64 * u;
        var jan1 = Date.UTC(yr, 0, 1) / DAY, dec31 = Date.UTC(yr, 11, 31) / DAY;
        var dow0 = (new Date(jan1 * DAY).getUTCDay() + (mon ? 6 : 0)) % 7;
        setFont(ctx, S, 26 * u, 800); ctx.fillStyle = S.textColor; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(String(yr), gx - labW + 6 * u, by - 34 * u);
        setFont(ctx, S, Math.min(18 * u, cell * 0.8), 500); ctx.fillStyle = withAlpha(S.textColor, 0.55); ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
        var dn = mon ? ['Mon', '', 'Wed', '', 'Fri', '', ''] : ['', 'Mon', '', 'Wed', '', 'Fri', ''];
        dn.forEach(function (t, i) { if (t) ctx.fillText(t, gx - 8 * u, by + i * cell + cell / 2); });
        for (var d = jan1; d <= dec31; d++) {
          var idx = d - jan1 + dow0, wk = Math.floor(idx / 7), dw = idx % 7;
          var x = gx + wk * cell, yy = by + dw * cell;
          var dt = new Date(d * DAY);
          if (dt.getUTCDate() === 1) {
            ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; ctx.fillStyle = withAlpha(S.textColor, 0.6);
            setFont(ctx, S, Math.min(18 * u, cell * 0.9), 600);
            ctx.fillText(MONTHS[dt.getUTCMonth()], x, by - 4 * u);
          }
          var v = map[d];
          var shown = d <= reveal && v != null;
          ctx.fillStyle = shown ? mixColor('#ffffff', heat, 0.12 + 0.88 * (maxV ? v / maxV : 0)) : empty;
          rrect(ctx, x + cell * 0.08, yy + cell * 0.08, cell * 0.84, cell * 0.84, cell * S.cellRadius); ctx.fill();
        }
      });
      if (S.showLegend) {
        var lx = R.x + R.w - 300 * u, ly = R.y + R.h - 30 * u;
        setFont(ctx, S, 18 * u, 500); ctx.fillStyle = withAlpha(S.textColor, 0.6); ctx.textBaseline = 'middle'; ctx.textAlign = 'right';
        ctx.fillText('Less', lx - 8 * u, ly);
        for (var i = 0; i < 5; i++) { ctx.fillStyle = mixColor('#ffffff', heat, 0.12 + 0.88 * i / 4); rrect(ctx, lx + i * 30 * u, ly - 11 * u, 22 * u, 22 * u, 4 * u); ctx.fill(); }
        ctx.fillStyle = withAlpha(S.textColor, 0.6); ctx.textAlign = 'left';
        ctx.fillText('More (max ' + fmt(maxV, S) + ')', lx + 156 * u, ly);
      }
    }
  };

  /* ---------------- Link data helper (source, target, value) ---------------- */
  function readLinks(C) {
    var nodes = [], idx = {}, links = [];
    function node(name) { name = String(name).trim(); if (!(name in idx)) { idx[name] = nodes.length; nodes.push({ name: name, i: nodes.length, out: 0, inn: 0 }); } return idx[name]; }
    cleanRows(C.T).forEach(function (r) {
      var s = String(r[0] == null ? '' : r[0]).trim(), t = String(r[1] == null ? '' : r[1]).trim();
      if (!s || !t) return;
      var v = num(r[2]); if (!isFinite(v)) v = 1; if (v <= 0) return;
      var a = node(s), b = node(t);
      links.push({ s: a, t: b, v: v });
      nodes[a].out += v; nodes[b].inn += v;
    });
    return { nodes: nodes, links: links };
  }

  /* ---------------- Sankey ---------------- */
  TEMPLATES.sankey = {
    name: 'Sankey diagram',
    description: 'Flows between stages, width = amount',
    dataHint: 'Three columns: Source, Target, Value. Each row is one flow (e.g. Budget → Housing → Rent). Stages are worked out automatically.',
    settings: [
      { group: 'Sankey', key: 'nodeWidth', label: 'Node width', type: 'range', def: 18, min: 4, max: 60, step: 1 },
      { group: 'Sankey', key: 'nodeGap', label: 'Gap between nodes', type: 'range', def: 18, min: 2, max: 80, step: 1 },
      { group: 'Sankey', key: 'linkOpacity', label: 'Flow opacity', type: 'range', def: 0.38, min: 0.05, max: 0.9, step: 0.01 },
      { group: 'Sankey', key: 'linkColor', label: 'Colour flows by', type: 'select', def: 'source', options: ['source', 'target', 'grey'] },
      { group: 'Sankey', key: 'showValues', label: 'Show node values', type: 'checkbox', def: true }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var G = readLinks(C), nodes = G.nodes, links = G.links;
      if (!links.length) return noData(C, R);
      var color = colorer(S);
      // columns by longest path from a source (ignores cycles)
      nodes.forEach(function (n) { n.col = 0; n.size = Math.max(n.out, n.inn); });
      for (var it = 0; it < nodes.length; it++) {
        var changed = false;
        links.forEach(function (l) { if (l.s !== l.t && nodes[l.t].col < nodes[l.s].col + 1 && nodes[l.s].col + 1 < nodes.length) { nodes[l.t].col = nodes[l.s].col + 1; changed = true; } });
        if (!changed) break;
      }
      var maxCol = 0; nodes.forEach(function (n) { maxCol = Math.max(maxCol, n.col); });
      nodes.forEach(function (n) { if (n.out === 0 && n.col < maxCol) n.col = maxCol; });
      var cols = []; for (var c = 0; c <= maxCol; c++) cols.push([]);
      nodes.forEach(function (n) { cols[n.col].push(n); });
      setFont(ctx, S, 22 * u, 600);
      var labW = Math.min(R.w * 0.2, Math.max.apply(null, nodes.map(function (n) { return ctx.measureText(n.name).width; })) + 20 * u);
      var P = { x: R.x + labW, y: R.y, w: R.w - labW * 2, h: R.h };
      var nw = S.nodeWidth * u, gap = S.nodeGap * u;
      var ky = Infinity;
      cols.forEach(function (cl) { var tot = cl.reduce(function (a, n) { return a + n.size; }, 0); ky = Math.min(ky, (P.h - gap * (cl.length - 1)) / (tot || 1)); });
      cols.forEach(function (cl, ci) {
        var x = P.x + (maxCol ? ci / maxCol : 0.5) * (P.w - nw);
        var tot = cl.reduce(function (a, n) { return a + n.size * ky; }, 0) + gap * (cl.length - 1);
        var y = P.y + (P.h - tot) / 2;
        cl.forEach(function (n) { n.x = x; n.y = y; n.h = Math.max(1, n.size * ky); y += n.h + gap; });
      });
      // relax vertical order towards connected nodes
      for (var pass = 0; pass < 6; pass++) {
        cols.forEach(function (cl, ci) {
          if (ci === 0 && pass % 2 === 0) return;
          cl.forEach(function (n) {
            var ws = 0, sy = 0;
            links.forEach(function (l) {
              var o = l.t === n.i ? nodes[l.s] : l.s === n.i ? nodes[l.t] : null;
              if (o && o !== n) { ws += l.v; sy += (o.y + o.h / 2) * l.v; }
            });
            if (ws) n.cy = sy / ws; else n.cy = n.y + n.h / 2;
          });
          cl.sort(function (a, b) { return a.cy - b.cy; });
          var tot = cl.reduce(function (a, n) { return a + n.h; }, 0) + gap * (cl.length - 1), y = P.y + (P.h - tot) / 2;
          cl.forEach(function (n) { n.y = y; y += n.h + gap; });
        });
      }
      nodes.forEach(function (n) { n.color = color(n.name, n.i); n.so = 0; n.ti = 0; });
      var sorted = links.slice().sort(function (a, b) { return (nodes[a.t].y - nodes[b.t].y) || (nodes[a.s].y - nodes[b.s].y); });
      sorted.forEach(function (l) { var s = nodes[l.s]; l.sy = s.y + s.so; s.so += l.v * ky; });
      links.slice().sort(function (a, b) { return nodes[a.s].y - nodes[b.s].y; }).forEach(function (l) { var t = nodes[l.t]; l.ty = t.y + t.ti; t.ti += l.v * ky; });
      var reveal = P.x + (P.w + 2) * C.pEased;
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y - 10, reveal - R.x, R.h + 20); ctx.clip();
      links.forEach(function (l) {
        var s = nodes[l.s], t = nodes[l.t], w = l.v * ky;
        var x0 = s.x + nw, x1 = t.x, mx = (x0 + x1) / 2;
        ctx.beginPath();
        ctx.moveTo(x0, l.sy); ctx.bezierCurveTo(mx, l.sy, mx, l.ty, x1, l.ty);
        ctx.lineTo(x1, l.ty + w); ctx.bezierCurveTo(mx, l.ty + w, mx, l.sy + w, x0, l.sy + w); ctx.closePath();
        var lc = S.linkColor === 'target' ? t.color : S.linkColor === 'grey' ? S.textColor : s.color;
        ctx.fillStyle = withAlpha(toHex(lc), S.linkColor === 'grey' ? S.linkOpacity * 0.5 : S.linkOpacity); ctx.fill();
      });
      nodes.forEach(function (n) { ctx.fillStyle = n.color; rrect(ctx, n.x, n.y, nw, n.h, 3 * u); ctx.fill(); });
      ctx.restore();
      nodes.forEach(function (n) {
        if (n.x > reveal) return;
        var right = n.col === maxCol && maxCol > 0;
        ctx.textAlign = right ? 'left' : (n.col === 0 ? 'right' : 'left'); ctx.textBaseline = 'middle';
        var lx = right ? n.x + nw + 10 * u : n.col === 0 ? n.x - 10 * u : n.x + nw + 10 * u;
        var cy = n.y + n.h / 2;
        setFont(ctx, S, 22 * u, 700); ctx.fillStyle = S.textColor;
        var both = S.showValues && n.h > 44 * u;
        ctx.fillText(ellipsis(ctx, n.name, labW - 14 * u), lx, both ? cy - 11 * u : cy);
        if (S.showValues) { setFont(ctx, S, 19 * u, 500); ctx.fillStyle = withAlpha(S.textColor, 0.6); if (both) ctx.fillText(fmt(n.size, S), lx, cy + 13 * u); }
      });
    }
  };

  /* ---------------- Chord ---------------- */
  TEMPLATES.chord = {
    name: 'Chord diagram',
    description: 'Two-way flows around a circle',
    dataHint: 'Three columns: Source, Target, Value. Each row is a flow between two groups.',
    settings: [
      { group: 'Chord', key: 'arcWidth', label: 'Outer ring thickness', type: 'range', def: 0.06, min: 0.02, max: 0.2, step: 0.005 },
      { group: 'Chord', key: 'padAngle', label: 'Gap between groups', type: 'range', def: 2, min: 0, max: 10, step: 0.5 },
      { group: 'Chord', key: 'ribbonOpacity', label: 'Ribbon opacity', type: 'range', def: 0.6, min: 0.1, max: 1, step: 0.01 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var G = readLinks(C), nodes = G.nodes;
      if (!G.links.length) return noData(C, R);
      var n = nodes.length, M = [];
      for (var i = 0; i < n; i++) { M.push([]); for (var j = 0; j < n; j++) M[i].push(0); }
      G.links.forEach(function (l) { M[l.s][l.t] += l.v; });
      var tot = nodes.map(function (_, i) { var s = 0; for (var j = 0; j < n; j++) s += M[i][j] + (i !== j ? M[j][i] : 0); return s; });
      var grand = tot.reduce(function (a, b) { return a + b; }, 0);
      var color = colorer(S);
      setFont(ctx, S, 22 * u, 700);
      var lab = Math.min(200 * u, Math.max.apply(null, nodes.map(function (d) { return ctx.measureText(d.name).width; })));
      var rad = Math.min(R.w, R.h) / 2 - lab - 24 * u, cx = R.x + R.w / 2, cy = R.y + R.h / 2;
      var pad = S.padAngle * Math.PI / 180, avail = Math.PI * 2 - pad * n;
      var a = -Math.PI / 2, arcs = [];
      nodes.forEach(function (d, i) { var span = tot[i] / grand * avail; arcs.push({ a0: a, a1: a + span, off: a }); a += span + pad; });
      var kArc = C.ease(clamp(C.pLinear / 0.5, 0, 1)), kRib = C.ease(clamp((C.pLinear - 0.35) / 0.65, 0, 1));
      var rw = rad * S.arcWidth, ri = rad - rw - 4 * u;
      // ribbons
      var sub = arcs.map(function (ar) { return ar.a0; });
      var pairs = [];
      for (var p = 0; p < n; p++) for (var q = p; q < n; q++) {
        var w = M[p][q] + (p !== q ? M[q][p] : 0); if (!w) continue;
        var sp = w / grand * avail;
        pairs.push({ p: p, q: q, ps: sub[p], pe: sub[p] + sp, qs: 0, qe: 0, w: w });
        sub[p] += sp;
        if (p !== q) { pairs[pairs.length - 1].qs = sub[q]; pairs[pairs.length - 1].qe = sub[q] + sp; sub[q] += sp; }
        else { pairs[pairs.length - 1].qs = pairs[pairs.length - 1].ps; pairs[pairs.length - 1].qe = pairs[pairs.length - 1].pe; }
      }
      if (kRib > 0) pairs.forEach(function (pr) {
        var bigger = M[pr.p][pr.q] >= M[pr.q][pr.p] ? pr.p : pr.q;
        ctx.beginPath();
        ctx.arc(cx, cy, ri, pr.ps, pr.pe);
        ctx.quadraticCurveTo(cx, cy, cx + Math.cos(pr.qs) * ri, cy + Math.sin(pr.qs) * ri);
        ctx.arc(cx, cy, ri, pr.qs, pr.qe);
        ctx.quadraticCurveTo(cx, cy, cx + Math.cos(pr.ps) * ri, cy + Math.sin(pr.ps) * ri);
        ctx.closePath();
        ctx.fillStyle = withAlpha(toHex(color(nodes[bigger].name, bigger)), S.ribbonOpacity * kRib); ctx.fill();
      });
      arcs.forEach(function (ar, i) {
        var end = ar.a0 + (ar.a1 - ar.a0) * kArc;
        ctx.beginPath(); ctx.arc(cx, cy, rad, ar.a0, end); ctx.arc(cx, cy, rad - rw, end, ar.a0, true); ctx.closePath();
        ctx.fillStyle = color(nodes[i].name, i); ctx.fill();
        var mid = (ar.a0 + ar.a1) / 2;
        ctx.save(); ctx.globalAlpha = kArc;
        ctx.translate(cx + Math.cos(mid) * (rad + 12 * u), cy + Math.sin(mid) * (rad + 12 * u));
        var flip = Math.cos(mid) < 0;
        ctx.rotate(flip ? mid + Math.PI : mid);
        setFont(ctx, S, 22 * u, 700); ctx.fillStyle = S.textColor; ctx.textAlign = flip ? 'right' : 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(ellipsis(ctx, nodes[i].name, lab), 0, 0);
        ctx.restore();
      });
    }
  };

  /* ---------------- Arc diagram ---------------- */
  TEMPLATES.arc = {
    name: 'Arc diagram',
    description: 'Connections drawn as arcs along a line',
    dataHint: 'Three columns: From, To, and an optional Value (arc thickness). Names are placed along a line in the order they first appear.',
    settings: [
      { group: 'Arcs', key: 'arcSort', label: 'Order nodes', type: 'select', def: 'as entered', options: ['as entered', 'most connected first', 'alphabetical'] },
      { group: 'Arcs', key: 'arcMaxWidth', label: 'Thickest arc', type: 'range', def: 14, min: 1, max: 40, step: 1 },
      { group: 'Arcs', key: 'arcOpacity', label: 'Arc opacity', type: 'range', def: 0.55, min: 0.1, max: 1, step: 0.01 },
      { group: 'Arcs', key: 'arcColor', label: 'Colour arcs by', type: 'select', def: 'source', options: ['source', 'single colour'] }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var G = readLinks(C), nodes = G.nodes.slice(), links = G.links;
      if (!links.length) return noData(C, R);
      var color = colorer(S);
      if (S.arcSort === 'most connected first') nodes.sort(function (a, b) { return (b.out + b.inn) - (a.out + a.inn); });
      if (S.arcSort === 'alphabetical') nodes.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
      var pos = {}; nodes.forEach(function (n, k) { pos[n.i] = k; });
      setFont(ctx, S, 20 * u, 600);
      var lab = Math.min(R.h * 0.3, Math.max.apply(null, nodes.map(function (d) { return ctx.measureText(d.name).width; })) + 16 * u);
      var baseY = R.y + R.h - lab;
      var X = function (k) { return R.x + 20 * u + (nodes.length > 1 ? k / (nodes.length - 1) : 0.5) * (R.w - 40 * u); };
      var maxV = Math.max.apply(null, links.map(function (l) { return l.v; }));
      var maxDeg = Math.max.apply(null, nodes.map(function (n) { return n.out + n.inn; }));
      var maxSpan = 0; links.forEach(function (l) { maxSpan = Math.max(maxSpan, Math.abs(X(pos[l.t]) - X(pos[l.s]))); });
      var hScale = Math.min(1, (baseY - R.y - 10 * u) / (maxSpan / 2 || 1));
      links.forEach(function (l, li) {
        var st = links.length > 1 ? li / (links.length - 1) * 0.5 : 0, k = C.ease(clamp((C.pLinear - st) / 0.5, 0, 1));
        if (k <= 0) return;
        var x0 = X(pos[l.s]), x1 = X(pos[l.t]), mx = (x0 + x1) / 2, r = Math.abs(x1 - x0) / 2;
        ctx.save(); ctx.translate(mx, baseY); ctx.scale(1, hScale);
        ctx.beginPath();
        var startA = x0 < x1 ? Math.PI : 0, dir = x0 < x1 ? 1 : -1;
        ctx.arc(0, 0, r, startA, startA + dir * Math.PI * k, dir < 0);
        ctx.restore();
        ctx.strokeStyle = withAlpha(toHex(S.arcColor === 'source' ? color(G.nodes[l.s].name, l.s) : color('', 0)), S.arcOpacity);
        ctx.lineWidth = Math.max(1.5 * u, l.v / maxV * S.arcMaxWidth * u); ctx.lineCap = 'round'; ctx.stroke();
      });
      nodes.forEach(function (n, k) {
        var x = X(k), rr = (5 + 10 * Math.sqrt((n.out + n.inn) / maxDeg)) * u;
        ctx.beginPath(); ctx.arc(x, baseY, rr, 0, Math.PI * 2); ctx.fillStyle = color(n.name, n.i); ctx.fill();
        ctx.save(); ctx.translate(x, baseY + rr + 8 * u); ctx.rotate(Math.PI / 4);
        setFont(ctx, S, 20 * u, 600); ctx.fillStyle = S.textColor; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(ellipsis(ctx, n.name, lab * 1.3), 0, 0); ctx.restore();
      });
    }
  };

  /* ---------------- Network graph ---------------- */
  var netCache = {}, netKeys = [];
  TEMPLATES.network = {
    name: 'Network graph',
    description: 'Who is connected to whom',
    dataHint: 'Two or three columns: From, To, and an optional Value (link strength). Clusters are coloured automatically.',
    settings: [
      { group: 'Network', key: 'nodeScale', label: 'Node size', type: 'range', def: 1, min: 0.3, max: 3, step: 0.05 },
      { group: 'Network', key: 'labelCount', label: 'Labels on the biggest nodes', type: 'number', def: 20, min: 0, max: 500, step: 1 },
      { group: 'Network', key: 'netColor', label: 'Colour nodes by', type: 'select', def: 'cluster', options: ['cluster', 'connections', 'single colour'] },
      { group: 'Network', key: 'spread', label: 'Spread', type: 'range', def: 1, min: 0.4, max: 2.5, step: 0.05 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var G = readLinks(C), nodes = G.nodes, links = G.links;
      if (!links.length) return noData(C, R);
      var key = JSON.stringify([nodes.map(function (n) { return n.name; }), links, S.spread]);
      var L = netCache[key];
      if (!L) {
        var N = nodes.length, pos = [], golden = Math.PI * (3 - Math.sqrt(5));
        for (var i = 0; i < N; i++) { var d = Math.sqrt(i + 0.5); pos.push([Math.cos(i * golden) * d, Math.sin(i * golden) * d]); }
        var kk = 1.2 * S.spread, temp = Math.sqrt(N);
        var iters = Math.min(500, 150 + N * 2);
        for (var it = 0; it < iters; it++) {
          var disp = pos.map(function () { return [0, 0]; });
          for (var a = 0; a < N; a++) for (var b = a + 1; b < N; b++) {
            var dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1], dd = Math.max(0.01, dx * dx + dy * dy), f = kk * kk / dd;
            disp[a][0] += dx * f; disp[a][1] += dy * f; disp[b][0] -= dx * f; disp[b][1] -= dy * f;
          }
          links.forEach(function (l) {
            if (l.s === l.t) return;
            var dx = pos[l.s][0] - pos[l.t][0], dy = pos[l.s][1] - pos[l.t][1], dist = Math.sqrt(dx * dx + dy * dy) || 0.01, f = dist / kk;
            disp[l.s][0] -= dx * f; disp[l.s][1] -= dy * f; disp[l.t][0] += dx * f; disp[l.t][1] += dy * f;
          });
          for (var c = 0; c < N; c++) {
            disp[c][0] -= pos[c][0] * 0.02; disp[c][1] -= pos[c][1] * 0.02;
            var len = Math.sqrt(disp[c][0] * disp[c][0] + disp[c][1] * disp[c][1]) || 1, step = Math.min(len, temp);
            pos[c][0] += disp[c][0] / len * step; pos[c][1] += disp[c][1] / len * step;
          }
          temp = Math.max(0.01, temp * 0.985);
        }
        // clusters: label propagation (deterministic)
        var lab = nodes.map(function (_, i) { return i; }), adj = nodes.map(function () { return []; });
        links.forEach(function (l) { adj[l.s].push([l.t, l.v]); adj[l.t].push([l.s, l.v]); });
        for (var pass = 0; pass < 12; pass++) {
          for (var q = 0; q < N; q++) {
            var votes = {}; adj[q].forEach(function (e) { votes[lab[e[0]]] = (votes[lab[e[0]]] || 0) + e[1]; });
            var best = lab[q], bv = -1; Object.keys(votes).forEach(function (k2) { if (votes[k2] > bv || (votes[k2] === bv && +k2 < best)) { bv = votes[k2]; best = +k2; } });
            lab[q] = best;
          }
        }
        var clusterIds = {}, cl = lab.map(function (x) { if (!(x in clusterIds)) clusterIds[x] = Object.keys(clusterIds).length; return clusterIds[x]; });
        // reveal order: BFS from best-connected node
        var deg = nodes.map(function (n) { return n.out + n.inn; });
        var order = [], seen = {}, startN = deg.indexOf(Math.max.apply(null, deg)), queue = [startN];
        while (order.length < N) {
          if (!queue.length) { for (var z = 0; z < N; z++) if (!seen[z]) { queue.push(z); break; } }
          var cur = queue.shift(); if (seen[cur]) continue; seen[cur] = 1; order.push(cur);
          adj[cur].slice().sort(function (x, y) { return deg[y[0]] - deg[x[0]]; }).forEach(function (e) { if (!seen[e[0]]) queue.push(e[0]); });
        }
        var rank = []; order.forEach(function (n2, i2) { rank[n2] = i2; });
        L = { pos: pos, cl: cl, rank: rank, deg: deg };
        netCache[key] = L; netKeys.push(key); if (netKeys.length > 8) delete netCache[netKeys.shift()];
      }
      var color = colorer(S);
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      L.pos.forEach(function (p) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); });
      var maxDeg = Math.max.apply(null, L.deg);
      var margin = 50 * u;
      var sc = Math.min((R.w - margin * 2) / (maxX - minX || 1), (R.h - margin * 2) / (maxY - minY || 1));
      var ox = R.x + R.w / 2 - (minX + maxX) / 2 * sc, oy = R.y + R.h / 2 - (minY + maxY) / 2 * sc;
      var N2 = nodes.length;
      var vis = function (i) { return clamp((C.pLinear * (N2 + 4) - L.rank[i]) / 4, 0, 1); };
      var P = function (i) { var e = EASINGS.snappy(vis(i)); var cx = R.x + R.w / 2, cy = R.y + R.h / 2; return [lerp(cx, ox + L.pos[i][0] * sc, 0.6 + 0.4 * e), lerp(cy, oy + L.pos[i][1] * sc, 0.6 + 0.4 * e)]; };
      var maxV = Math.max.apply(null, links.map(function (l) { return l.v; }));
      links.forEach(function (l) {
        var k = Math.min(vis(l.s), vis(l.t)); if (k <= 0) return;
        var a = P(l.s), b = P(l.t);
        ctx.strokeStyle = withAlpha(S.textColor, 0.18 * k); ctx.lineWidth = (1 + 4 * l.v / maxV) * u;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      });
      var labelled = nodes.map(function (_, i) { return i; }).sort(function (a, b) { return L.deg[b] - L.deg[a]; }).slice(0, S.labelCount | 0);
      var isLab = {}; labelled.forEach(function (i) { isLab[i] = 1; });
      nodes.forEach(function (n, i) {
        var k = vis(i); if (k <= 0) return;
        var p = P(i), r = (6 + 18 * Math.sqrt(L.deg[i] / maxDeg)) * u * S.nodeScale * EASINGS.snappy(k);
        var col = S.netColor === 'cluster' ? color(String(L.cl[i]), L.cl[i]) : S.netColor === 'connections' ? mixColor('#ffffff', toHex(color('', 0)), 0.3 + 0.7 * L.deg[i] / maxDeg) : color('', 0);
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
        ctx.strokeStyle = S.background; ctx.lineWidth = 2 * u; ctx.stroke();
        if (isLab[i] && k > 0.5) {
          setFont(ctx, S, 19 * u, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.lineWidth = 4 * u; ctx.strokeStyle = withAlpha(S.background, 0.9); ctx.lineJoin = 'round';
          ctx.strokeText(n.name, p[0], p[1] + r + 4 * u); ctx.fillStyle = S.textColor; ctx.fillText(n.name, p[0], p[1] + r + 4 * u);
        }
      });
    }
  };

  /* ---------------- Timeline ---------------- */
  TEMPLATES.timeline = {
    name: 'Timeline',
    description: 'Key events in date order',
    dataHint: 'First column: date or year. Second column: event title. Optional third column: a short description. Optional fourth column: an icon name, emoji or uploaded image name.',
    settings: [
      { group: 'Timeline', key: 'orientation', label: 'Direction', type: 'select', def: 'auto', options: ['auto', 'horizontal', 'vertical'] },
      { group: 'Timeline', key: 'spacing', label: 'Spacing', type: 'select', def: 'even', options: ['even', 'by date'] },
      { group: 'Timeline', key: 'sortByDate', label: 'Sort by date', type: 'checkbox', def: true },
      { group: 'Timeline', key: 'colorEvents', label: 'Colour each event', type: 'checkbox', def: true }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var ev = cleanRows(C.T).map(function (r, i) { return { when: String(r[0]), t: parseDate(r[0]), title: String(r[1] || ''), desc: String(r[2] || ''), icon: r[3] || '', i: i }; });
      if (!ev.length) return noData(C, R);
      if (S.sortByDate) ev.sort(function (a, b) { return (isFinite(a.t) && isFinite(b.t)) ? a.t - b.t : a.i - b.i; });
      var color = colorer(S), n = ev.length;
      var horiz = S.orientation === 'horizontal' || (S.orientation === 'auto' && R.w >= R.h);
      var tMin = Infinity, tMax = -Infinity; ev.forEach(function (e) { if (isFinite(e.t)) { tMin = Math.min(tMin, e.t); tMax = Math.max(tMax, e.t); } });
      var byDate = S.spacing === 'by date' && isFinite(tMin) && tMax > tMin;
      var frac = function (e, i) { return byDate && isFinite(e.t) ? (e.t - tMin) / (tMax - tMin) : (n > 1 ? i / (n - 1) : 0.5); };
      var k = C.pLinear, lineK = C.ease(clamp(k / 0.85, 0, 1));
      var main = withAlpha(S.textColor, 0.25);
      if (horiz) {
        var ly = R.y + R.h / 2, x0 = R.x + 30 * u, x1 = R.x + R.w - 30 * u;
        gridLine(ctx, x0, ly, lerp(x0, x1, lineK), ly, main, 4 * u);
        var slot = (x1 - x0) / Math.max(1, n - 1) * 1.9, cardW = Math.min(360 * u, Math.max(140 * u, slot));
        ev.forEach(function (e, i) {
          var x = lerp(x0, x1, frac(e, i));
          var appear = clamp((lineK * (x1 - x0 + 60 * u) + x0 - x) / (60 * u), 0, 1);
          if (appear <= 0) return;
          var col = S.colorEvents ? color(e.title, i) : color('', 0), up = i % 2 === 0;
          ctx.save(); ctx.globalAlpha = appear;
          var stem = R.h * 0.12;
          gridLine(ctx, x, ly, x, up ? ly - stem : ly + stem, withAlpha(toHex(col), 0.6), 2 * u);
          ctx.beginPath(); ctx.arc(x, ly, 11 * u, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
          ctx.beginPath(); ctx.arc(x, ly, 5 * u, 0, Math.PI * 2); ctx.fillStyle = S.background; ctx.fill();
          var cx = clamp(x - cardW / 2, R.x, R.x + R.w - cardW);
          setFont(ctx, S, 20 * u, 500); var dl = wrap(ctx, e.desc, cardW).slice(0, 4);
          setFont(ctx, S, 24 * u, 800); var tl = wrap(ctx, e.title, cardW).slice(0, 2);
          var iconS = e.icon ? 40 * u : 0;
          var h = iconS + (iconS ? 8 * u : 0) + 28 * u + tl.length * 28 * u + (dl.length ? 6 * u + dl.length * 25 * u : 0);
          var y = up ? ly - stem - 10 * u - h : ly + stem + 10 * u;
          y += (1 - EASINGS.snappy(appear)) * (up ? 20 : -20) * u;
          ctx.textAlign = x - cardW / 2 < R.x ? 'left' : x + cardW / 2 > R.x + R.w ? 'right' : 'center';
          var tx = ctx.textAlign === 'left' ? cx : ctx.textAlign === 'right' ? cx + cardW : x;
          ctx.textBaseline = 'top';
          if (iconS) { drawIcon(ctx, e.icon, tx - (ctx.textAlign === 'center' ? iconS / 2 : ctx.textAlign === 'right' ? iconS : 0), y, iconS, col); y += iconS + 8 * u; }
          setFont(ctx, S, 22 * u, 800); ctx.fillStyle = col; ctx.fillText(e.when, tx, y); y += 28 * u;
          setFont(ctx, S, 24 * u, 800); ctx.fillStyle = S.textColor; tl.forEach(function (l) { ctx.fillText(l, tx, y); y += 28 * u; });
          if (dl.length) { y += 6 * u; setFont(ctx, S, 20 * u, 500); ctx.fillStyle = withAlpha(S.textColor, 0.7); dl.forEach(function (l) { ctx.fillText(l, tx, y); y += 25 * u; }); }
          ctx.restore();
        });
      } else {
        var lx = R.x + Math.min(R.w * 0.3, 220 * u), y0 = R.y + 20 * u, y1 = R.y + R.h - 20 * u;
        gridLine(ctx, lx, y0, lx, lerp(y0, y1, lineK), main, 4 * u);
        ev.forEach(function (e, i) {
          var y = lerp(y0, y1, frac(e, i));
          var appear = clamp((lineK * (y1 - y0 + 50 * u) + y0 - y) / (50 * u), 0, 1);
          if (appear <= 0) return;
          var col = S.colorEvents ? color(e.title, i) : color('', 0);
          ctx.save(); ctx.globalAlpha = appear;
          ctx.beginPath(); ctx.arc(lx, y, 11 * u, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
          ctx.beginPath(); ctx.arc(lx, y, 5 * u, 0, Math.PI * 2); ctx.fillStyle = S.background; ctx.fill();
          setFont(ctx, S, 24 * u, 800); ctx.fillStyle = col; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillText(ellipsis(ctx, e.when, lx - R.x - 30 * u), lx - 26 * u, y);
          var tx = lx + 30 * u + (1 - EASINGS.snappy(appear)) * 20 * u, tw = R.x + R.w - tx;
          var slotH = (y1 - y0) / Math.max(1, n - 1);
          if (e.icon) { drawIcon(ctx, e.icon, tx, y - 18 * u, 36 * u, col); tx += 46 * u; tw -= 46 * u; }
          ctx.textAlign = 'left'; setFont(ctx, S, 26 * u, 800); ctx.fillStyle = S.textColor;
          ctx.fillText(ellipsis(ctx, e.title, tw), tx, e.desc && slotH > 60 * u ? y - 14 * u : y);
          if (e.desc && slotH > 60 * u) { setFont(ctx, S, 20 * u, 500); ctx.fillStyle = withAlpha(S.textColor, 0.7); ctx.fillText(ellipsis(ctx, e.desc, tw), tx, y + 16 * u); }
          ctx.restore();
        });
      }
    }
  };

  /* ---------------- Gantt ---------------- */
  TEMPLATES.gantt = {
    name: 'Gantt chart',
    description: 'Tasks or periods on a time axis',
    dataHint: 'Columns: Task, Start date, End date, and an optional Group (sets the colour). Dates can be YYYY-MM-DD, DD/MM/YYYY or just a year.',
    settings: [
      { group: 'Gantt', key: 'barRadius', label: 'Corner radius', type: 'range', def: 8, min: 0, max: 30, step: 1 },
      { group: 'Gantt', key: 'showDates', label: 'Show dates on bars', type: 'checkbox', def: true },
      { group: 'Gantt', key: 'todayLine', label: 'Marker line date (optional)', type: 'text', def: '' }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u, DAY = 864e5;
      var tasks = cleanRows(C.T).map(function (r, i) { return { name: String(r[0]), s: parseDate(r[1]), e: parseDate(r[2]), g: String(r[3] == null ? '' : r[3]).trim(), i: i, rs: r[1], re: r[2] }; })
        .filter(function (t) { return isFinite(t.s) && isFinite(t.e); });
      if (!tasks.length) return noData(C, R);
      tasks.forEach(function (t) { if (t.e < t.s) { var x = t.e; t.e = t.s; t.s = x; } if (/^\d{1,4}$/.test(String(t.re).trim())) t.e = Date.UTC(+String(t.re).trim() + 1, 0, 1) - DAY; });
      var color = colorer(S), groups = [];
      tasks.forEach(function (t) { if (t.g && groups.indexOf(t.g) < 0) groups.push(t.g); });
      var top = R.y;
      if (groups.length) top += legend(C, groups.map(function (g, i) { return { label: g, color: color(g, i) }; }), R.x, R.y, R.w);
      var t0 = Math.min.apply(null, tasks.map(function (t) { return t.s; })), t1 = Math.max.apply(null, tasks.map(function (t) { return t.e; })) + DAY;
      var span = t1 - t0; t0 -= span * 0.02; t1 += span * 0.02;
      setFont(ctx, S, 22 * u, 600);
      var labW = Math.min(R.w * 0.28, Math.max.apply(null, tasks.map(function (t) { return ctx.measureText(t.name).width; })) + 24 * u);
      var P = { x: R.x + labW, y: top + 40 * u, w: R.w - labW, h: R.y + R.h - top - 40 * u };
      var X = function (t) { return P.x + (t - t0) / (t1 - t0) * P.w; };
      // ticks
      var days = (t1 - t0) / DAY, ticks = [], d0 = new Date(t0), fmtT;
      if (days > 365 * 4) { var step = Math.ceil(days / 365 / 10); for (var y = d0.getUTCFullYear(); Date.UTC(y, 0, 1) <= t1; y += step) ticks.push(Date.UTC(y, 0, 1)); fmtT = function (t) { return String(new Date(t).getUTCFullYear()); }; }
      else if (days > 75) { var ms = Math.max(1, Math.ceil(days / 30 / 12)); for (var m = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1); m <= t1;) { ticks.push(m); var dm = new Date(m); m = Date.UTC(dm.getUTCFullYear(), dm.getUTCMonth() + ms, 1); } fmtT = function (t) { var dd = new Date(t); return MONTHS[dd.getUTCMonth()] + (dd.getUTCMonth() === 0 ? ' ' + dd.getUTCFullYear() : ''); }; }
      else { var ws = days > 21 ? 7 : 1; for (var w = Math.floor(t0 / DAY) * DAY; w <= t1; w += ws * DAY) ticks.push(w); fmtT = function (t) { var dd = new Date(t); return dd.getUTCDate() + ' ' + MONTHS[dd.getUTCMonth()]; }; }
      setFont(ctx, S, 18 * u, 600); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ticks.forEach(function (t) { if (t < t0) return; gridLine(ctx, X(t), P.y - 6 * u, X(t), P.y + P.h, withAlpha(S.textColor, 0.08), 1.5 * u); ctx.fillStyle = withAlpha(S.textColor, 0.6); ctx.fillText(fmtT(t), X(t) + 5 * u, P.y - 10 * u); });
      var rh = P.h / tasks.length, bh = Math.min(rh * 0.68, 56 * u);
      tasks.forEach(function (t, i) {
        var y = P.y + i * rh + (rh - bh) / 2;
        var st = tasks.length > 1 ? i / (tasks.length - 1) * 0.5 : 0, k = C.ease(clamp((C.pLinear - st) / 0.5, 0, 1));
        if (i % 2 === 1) { ctx.fillStyle = withAlpha(S.textColor, 0.03); ctx.fillRect(R.x, P.y + i * rh, R.w, rh); }
        setFont(ctx, S, clamp(rh * 0.36, 12 * u, 22 * u), 600); ctx.fillStyle = S.textColor; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(ellipsis(ctx, t.name, labW - 20 * u), R.x, y + bh / 2);
        if (k <= 0) return;
        var col = t.g ? color(t.g, groups.indexOf(t.g)) : color(t.name, i);
        var x0 = X(t.s), w = Math.max(4 * u, (X(t.e + DAY) - x0)) * k;
        ctx.fillStyle = col; rrect(ctx, x0, y, w, bh, S.barRadius * u); ctx.fill();
        if (S.showDates && k > 0.95) {
          var dd = fmtT === undefined ? '' : (function () { var a = new Date(t.s), b = new Date(t.e); var f = function (z) { return z.getUTCDate() + ' ' + MONTHS[z.getUTCMonth()] + (days > 300 ? ' ' + z.getUTCFullYear() : ''); }; return f(a) + ' – ' + f(b); })();
          setFont(ctx, S, clamp(bh * 0.34, 11 * u, 18 * u), 600);
          var tw = ctx.measureText(dd).width;
          if (tw + 20 * u < w) { ctx.fillStyle = contrastText(toHex(col)); ctx.fillText(dd, x0 + 10 * u, y + bh / 2); }
          else if (x0 + w + tw + 10 * u < R.x + R.w) { ctx.fillStyle = withAlpha(S.textColor, 0.6); ctx.fillText(dd, x0 + w + 8 * u, y + bh / 2); }
        }
      });
      var mk = parseDate(S.todayLine);
      if (isFinite(mk) && mk >= t0 && mk <= t1) {
        ctx.setLineDash([6 * u, 6 * u]); gridLine(ctx, X(mk), P.y - 6 * u, X(mk), P.y + P.h, '#F05252', 2.5 * u); ctx.setLineDash([]);
      }
    }
  };

  /* ---------------- Maps ---------------- */
  var GEO = null, geoIndex = null;
  var COUNTRY_ALIASES = {
    'uk': 'united kingdom', 'great britain': 'united kingdom', 'britain': 'united kingdom', 'england': 'united kingdom', 'scotland': 'united kingdom', 'wales': 'united kingdom', 'northern ireland': 'united kingdom',
    'usa': 'united states of america', 'us': 'united states of america', 'united states': 'united states of america', 'america': 'united states of america',
    'drc': 'dem rep congo', 'dr congo': 'dem rep congo', 'democratic republic of the congo': 'dem rep congo', 'congo kinshasa': 'dem rep congo',
    'republic of the congo': 'congo', 'congo brazzaville': 'congo', 'czech republic': 'czechia', 'south sudan': 's sudan',
    'central african republic': 'central african rep', 'dominican republic': 'dominican rep', 'bosnia and herzegovina': 'bosnia and herz', 'bosnia': 'bosnia and herz',
    'north macedonia': 'macedonia', 'ivory coast': 'cote divoire', 'swaziland': 'eswatini', 'western sahara': 'w sahara', 'equatorial guinea': 'eq guinea',
    'solomon islands': 'solomon is', 'falkland islands': 'falkland is', 'korea': 'south korea', 'republic of korea': 'south korea', 'korea republic of': 'south korea',
    'dprk': 'north korea', 'russian federation': 'russia', 'viet nam': 'vietnam', 'lao pdr': 'laos', 'iran islamic republic of': 'iran', 'syrian arab republic': 'syria',
    'turkiye': 'turkey', 'burma': 'myanmar', 'east timor': 'timorleste', 'timor leste': 'timorleste', 'uae': 'united arab emirates', 'holland': 'netherlands',
    'the netherlands': 'netherlands', 'the gambia': 'gambia', 'cabo verde': 'cape verde', 'tanzania united republic of': 'tanzania', 'bolivia plurinational state of': 'bolivia',
    'venezuela bolivarian republic of': 'venezuela', 'moldova republic of': 'moldova', 'palestinian territories': 'palestine', 'state of palestine': 'palestine'
  };
  function normName(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^the /, '');
  }
  function eqEarth(lon, lat) {
    var A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
    var l = lon * Math.PI / 180, p = lat * Math.PI / 180, th = Math.asin(M * Math.sin(p)), t2 = th * th, t6 = t2 * t2 * t2;
    return [l * Math.cos(th) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), -(th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)))];
  }
  function getGeo() {
    if (GEO) return GEO;
    var src = typeof InfographicGeo !== 'undefined' ? InfographicGeo : (typeof window !== 'undefined' ? window.InfographicGeo : null);
    if (!src) return null;
    GEO = src.countries.map(function (c) {
      var rings = c.r.map(function (r) { var out = []; for (var i = 0; i < r.length; i += 2) { var p = eqEarth(clamp(r[i], -180, 180), r[i + 1]); out.push(p[0], p[1]); } return out; });
      var bx = 0, by = 0, cnt = 0, minY = Infinity, maxY = -Infinity, area = 0, big = 0;
      rings.forEach(function (r, ri) {
        var a = 0; for (var i = 0; i < r.length - 2; i += 2) a += r[i] * r[i + 3] - r[i + 2] * r[i + 1];
        if (Math.abs(a) > area) { area = Math.abs(a); big = ri; }
        for (var j = 0; j < r.length; j += 2) { minY = Math.min(minY, r[j + 1]); maxY = Math.max(maxY, r[j + 1]); }
      });
      var rb = rings[big] || []; for (var k = 0; k < rb.length; k += 2) { bx += rb[k]; by += rb[k + 1]; cnt++; }
      return { name: c.n, key: normName(c.n), rings: rings, cx: cnt ? bx / cnt : 0, cy: cnt ? by / cnt : 0, antarctic: c.n === 'Antarctica' };
    });
    geoIndex = {}; GEO.forEach(function (g) { geoIndex[g.key] = g; });
    return GEO;
  }
  function findCountry(name) {
    var k = normName(name);
    if (COUNTRY_ALIASES[k]) k = normName(COUNTRY_ALIASES[k]);
    return geoIndex[k] || null;
  }
  function mapFrame(C, R, hideAntarctica) {
    var geo = getGeo(); if (!geo) return null;
    var topLat = 84, botLat = hideAntarctica ? -58 : -90;
    var tl = eqEarth(-180, topLat), br = eqEarth(180, botLat), lw = eqEarth(-180, 0);
    var minX = lw[0], maxX = -lw[0], minY = tl[1], maxY = br[1];
    var sc = Math.min(R.w / (maxX - minX), R.h / (maxY - minY));
    var ox = R.x + R.w / 2 - (minX + maxX) / 2 * sc, oy = R.y + R.h / 2 - (minY + maxY) / 2 * sc;
    return { geo: geo, sc: sc, ox: ox, oy: oy, project: function (lon, lat) { var p = eqEarth(lon, lat); return [ox + p[0] * sc, oy + p[1] * sc]; } };
  }
  function outlinePath(ctx, F, hideAntarctica) {
    var bot = hideAntarctica ? -58 : -90;
    ctx.beginPath();
    for (var lat = 84; lat >= bot; lat -= 2) { var p = F.project(180, lat); ctx[lat === 84 ? 'moveTo' : 'lineTo'](p[0], p[1]); }
    for (var lat2 = bot; lat2 <= 84; lat2 += 2) { var q = F.project(-180, lat2); ctx.lineTo(q[0], q[1]); }
    ctx.closePath();
  }
  function countryPath(ctx, g, F) {
    ctx.beginPath();
    g.rings.forEach(function (r) { for (var i = 0; i < r.length; i += 2) { var x = F.ox + r[i] * F.sc, y = F.oy + r[i + 1] * F.sc; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.closePath(); });
  }
  function noGeo(C, R) {
    setFont(C.ctx, C.S, 26 * C.u, 500); C.ctx.fillStyle = withAlpha(C.S.textColor, 0.5); C.ctx.textAlign = 'center'; C.ctx.textBaseline = 'middle';
    C.ctx.fillText('Map outlines not loaded (vendor/world.js)', R.x + R.w / 2, R.y + R.h / 2);
  }

  TEMPLATES.choropleth = {
    name: 'Country map',
    description: 'Countries shaded by value or category',
    dataHint: 'First column: country name (e.g. United Kingdom, France, USA). Second column: a number (shaded scale) or a category (coloured groups). Add more number columns to animate through time periods, like a bar chart race.',
    settings: [
      { group: 'Map', key: 'mapLow', label: 'Low colour', type: 'color', def: '#E3ECFF' },
      { group: 'Map', key: 'mapHigh', label: 'High colour', type: 'color', def: '#1D3FB0' },
      { group: 'Map', key: 'mapSteps', label: 'Colour steps (0 = smooth)', type: 'number', def: 0, min: 0, max: 9, step: 1 },
      { group: 'Map', key: 'noDataColor', label: 'No-data colour', type: 'color', def: '#E5E7EB' },
      { group: 'Map', key: 'hideAntarctica', label: 'Hide Antarctica', type: 'checkbox', def: true },
      { group: 'Map', key: 'oceanColor', label: 'Sea colour', type: 'color', def: '#ffffff' },
      { group: 'Map', key: 'showPeriod', label: 'Show period label (multi-column data)', type: 'checkbox', def: true },
      { group: 'Map', key: 'labelTop', label: 'Label the top countries', type: 'number', def: 0, min: 0, max: 50, step: 1 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var F = mapFrame(C, R, false); if (!F) return noGeo(C, R);
      var header = C.T[0] || [], rows = cleanRows(C.T);
      var periods = header.slice(1);
      var numeric = rows.some(function (r) { return isFinite(num(r[1])); });
      var legH = 70 * u;
      var A = { x: R.x, y: R.y, w: R.w, h: R.h - legH };
      F = mapFrame(C, A, S.hideAntarctica);
      var data = {}, unmatched = 0, lo = Infinity, hi = -Infinity, cats = [];
      rows.forEach(function (r) {
        var g = findCountry(r[0]); if (!g) { unmatched++; return; }
        if (numeric) { var vals = periods.map(function (_, j) { var v = num(r[j + 1]); if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } return v; }); data[g.key] = vals; }
        else { var c = String(r[1] == null ? '' : r[1]).trim(); if (c) { if (cats.indexOf(c) < 0) cats.push(c); data[g.key] = c; } }
      });
      var np = numeric ? periods.length : 1;
      var f = C.pLinear * (np - 1), i0 = Math.floor(f), i1 = Math.min(i0 + 1, np - 1), fr = C.ease(f - i0);
      var color = colorer(S);
      var low = toHex(S.mapLow), high = toHex(S.mapHigh);
      var scaleCol = function (v) {
        var t = hi > lo ? (v - lo) / (hi - lo) : 1;
        if (S.mapSteps > 0) t = Math.min(S.mapSteps - 1, Math.floor(t * S.mapSteps)) / Math.max(1, S.mapSteps - 1);
        return mixColor(low, high, clamp(t, 0, 1));
      };
      ctx.save(); outlinePath(ctx, F, S.hideAntarctica); ctx.fillStyle = S.oceanColor; ctx.fill();
      ctx.strokeStyle = withAlpha(S.textColor, 0.15); ctx.lineWidth = 1.5 * u; ctx.stroke(); ctx.clip();
      var sweepK = np > 1 ? 1 : C.pLinear;
      var minCx = -2.7, maxCx = 2.7;
      F.geo.forEach(function (g) {
        if (g.antarctic && S.hideAntarctica) return;
        countryPath(ctx, g, F);
        ctx.fillStyle = S.noDataColor; ctx.fill('evenodd');
        var d = data[g.key];
        if (d != null) {
          var appear = np > 1 ? 1 : clamp((sweepK - (g.cx - minCx) / (maxCx - minCx) * 0.6) / 0.4, 0, 1);
          if (appear > 0) {
            var col;
            if (numeric) {
              var a = d[i0], b = d[i1];
              if (!isFinite(a)) a = b; if (!isFinite(b)) b = a;
              col = isFinite(a) ? scaleCol(lerp(a, b, fr)) : null;
            } else col = toHex(color(d, cats.indexOf(d)));
            if (col) { ctx.globalAlpha = appear; ctx.fillStyle = col; ctx.fill('evenodd'); ctx.globalAlpha = 1; }
          }
        }
        ctx.strokeStyle = withAlpha(S.oceanColor === '#ffffff' ? '#ffffff' : S.background, 0.9); ctx.lineWidth = 0.8 * u; ctx.stroke();
      });
      ctx.restore();
      if (S.labelTop > 0 && numeric) {
        var ranked = Object.keys(data).map(function (k) { var d = data[k]; return { g: geoIndex[k], v: lerp(isFinite(d[i0]) ? d[i0] : d[i1], isFinite(d[i1]) ? d[i1] : d[i0], fr) }; })
          .filter(function (o) { return isFinite(o.v); }).sort(function (a, b) { return b.v - a.v; }).slice(0, S.labelTop | 0);
        setFont(ctx, S, 18 * u, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ranked.forEach(function (o) {
          var x = F.ox + o.g.cx * F.sc, y = F.oy + o.g.cy * F.sc;
          ctx.globalAlpha = clamp(C.pLinear * 2 - 1, 0, 1);
          ctx.lineWidth = 4 * u; ctx.strokeStyle = withAlpha('#ffffff', 0.85); ctx.lineJoin = 'round';
          ctx.strokeText(fmt(o.v, S), x, y); ctx.fillStyle = '#1f2430'; ctx.fillText(fmt(o.v, S), x, y);
          ctx.globalAlpha = 1;
        });
      }
      // legend
      var ly = R.y + R.h - legH + 24 * u;
      if (numeric && isFinite(lo)) {
        var lw = Math.min(420 * u, R.w * 0.5), lx = R.x;
        var steps = S.mapSteps > 0 ? S.mapSteps : 60;
        for (var i = 0; i < steps; i++) { ctx.fillStyle = mixColor(low, high, steps > 1 ? i / (steps - 1) : 1); ctx.fillRect(lx + i * lw / steps, ly, lw / steps + 0.5, 18 * u); }
        setFont(ctx, S, 18 * u, 500); ctx.fillStyle = withAlpha(S.textColor, 0.65); ctx.textBaseline = 'top';
        ctx.textAlign = 'left'; ctx.fillText(fmt(lo, S), lx, ly + 24 * u);
        ctx.textAlign = 'right'; ctx.fillText(fmt(hi, S), lx + lw, ly + 24 * u);
        ctx.textAlign = 'left'; ctx.fillStyle = S.noDataColor; ctx.fillRect(lx + lw + 30 * u, ly, 18 * u, 18 * u);
        ctx.fillStyle = withAlpha(S.textColor, 0.65); ctx.textBaseline = 'middle'; ctx.fillText('No data', lx + lw + 56 * u, ly + 9 * u);
      } else if (cats.length) legend(C, cats.map(function (c, i) { return { label: c, color: color(c, i) }; }), R.x, ly - 8 * u, R.w * 0.7);
      if (np > 1 && S.showPeriod) {
        setFont(ctx, S, Math.min(110 * u, R.h * 0.12), 800); ctx.fillStyle = withAlpha(S.textColor, 0.25); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText(String(periods[Math.round(f)]), R.x + R.w, R.y + R.h);
      }
      if (unmatched) {
        setFont(ctx, S, 16 * u, 500); ctx.fillStyle = withAlpha(S.textColor, 0.45); ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(unmatched + ' name' + (unmatched > 1 ? 's' : '') + ' not matched to a country', R.x + R.w, R.y);
      }
    }
  };

  TEMPLATES.pointMap = {
    name: 'Point map',
    description: 'Bubbles on a world map at given locations',
    dataHint: 'Columns: Name, Latitude, Longitude, Value (bubble size, optional), Group (colour, optional). Example: London, 51.51, -0.13, 9000000, Europe.',
    settings: [
      { group: 'Map', key: 'landColor', label: 'Land colour', type: 'color', def: '#E5E7EB' },
      { group: 'Map', key: 'oceanColor', label: 'Sea colour', type: 'color', def: '#ffffff' },
      { group: 'Map', key: 'hideAntarctica', label: 'Hide Antarctica', type: 'checkbox', def: true },
      { group: 'Map', key: 'pointScale', label: 'Bubble size', type: 'range', def: 1, min: 0.2, max: 4, step: 0.05 },
      { group: 'Map', key: 'pointOpacity', label: 'Bubble opacity', type: 'range', def: 0.75, min: 0.1, max: 1, step: 0.01 },
      { group: 'Map', key: 'labelTop', label: 'Label the biggest points', type: 'number', def: 8, min: 0, max: 100, step: 1 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var pts = cleanRows(C.T).map(function (r) { return { name: String(r[0]), lat: num(r[1]), lon: num(r[2]), v: num(r[3]), g: String(r[4] == null ? '' : r[4]).trim() }; })
        .filter(function (p) { return isFinite(p.lat) && isFinite(p.lon); });
      var color = colorer(S), groups = [];
      pts.forEach(function (p) { if (p.g && groups.indexOf(p.g) < 0) groups.push(p.g); });
      var top = R.y;
      if (groups.length) top += legend(C, groups.map(function (g, i) { return { label: g, color: color(g, i) }; }), R.x, R.y, R.w);
      var A = { x: R.x, y: top, w: R.w, h: R.y + R.h - top };
      var F = mapFrame(C, A, S.hideAntarctica); if (!F) return noGeo(C, R);
      ctx.save(); outlinePath(ctx, F, S.hideAntarctica); ctx.fillStyle = S.oceanColor; ctx.fill();
      ctx.strokeStyle = withAlpha(S.textColor, 0.15); ctx.lineWidth = 1.5 * u; ctx.stroke(); ctx.clip();
      F.geo.forEach(function (g) {
        if (g.antarctic && S.hideAntarctica) return;
        countryPath(ctx, g, F); ctx.fillStyle = S.landColor; ctx.fill('evenodd');
        ctx.strokeStyle = S.oceanColor; ctx.lineWidth = 0.8 * u; ctx.stroke();
      });
      ctx.restore();
      if (!pts.length) return;
      var maxV = Math.max.apply(null, pts.map(function (p) { return isFinite(p.v) ? p.v : 0; }));
      var order = pts.slice().sort(function (a, b) { return (b.v || 0) - (a.v || 0); });
      var n = order.length;
      order.forEach(function (p, i) {
        var st = n > 1 ? i / (n - 1) * 0.6 : 0, k = clamp((C.pLinear - st) / 0.4, 0, 1);
        if (k <= 0) return;
        var xy = F.project(p.lon, p.lat);
        var r = (maxV > 0 && isFinite(p.v) ? 4 + 46 * Math.sqrt(p.v / maxV) : 9) * u * S.pointScale * EASINGS.snappy(k);
        var col = p.g ? color(p.g, groups.indexOf(p.g)) : color('', 0);
        ctx.beginPath(); ctx.arc(xy[0], xy[1], r, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(toHex(col), S.pointOpacity); ctx.fill();
        ctx.strokeStyle = withAlpha('#ffffff', 0.9); ctx.lineWidth = 1.5 * u; ctx.stroke();
        p.sx = xy[0]; p.sy = xy[1]; p.r = r; p.k = k;
      });
      setFont(ctx, S, 19 * u, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      order.slice(0, S.labelTop | 0).forEach(function (p) {
        if (!p.k || p.k < 0.6) return;
        ctx.lineWidth = 4 * u; ctx.strokeStyle = withAlpha(S.background, 0.9); ctx.lineJoin = 'round';
        ctx.strokeText(p.name, p.sx + p.r + 5 * u, p.sy); ctx.fillStyle = S.textColor; ctx.fillText(p.name, p.sx + p.r + 5 * u, p.sy);
      });
    }
  };

  /* ================================================================== */
  /* Card templates                                                      */
  /* ================================================================== */

  var CARD_STYLES = ['soft', 'white', 'solid', 'outline', 'accent bar'];

  /* Draws a card background; returns the text colours to use on it. */
  function cardBg(C, x, y, w, h, style, col, radius) {
    var ctx = C.ctx, S = C.S, u = C.u;
    col = toHex(col);
    var out = { text: S.textColor, muted: withAlpha(S.textColor, 0.68), accent: col, onAccent: contrastText(col) };
    ctx.save();
    if (style === 'solid') {
      ctx.fillStyle = col; rrect(ctx, x, y, w, h, radius); ctx.fill();
      out.text = contrastText(col); out.muted = withAlpha(out.text === '#ffffff' ? '#ffffff' : '#1f2430', 0.82); out.accent = out.text; out.onAccent = col;
    } else if (style === 'white' || style === 'accent bar') {
      ctx.shadowColor = 'rgba(15,23,42,0.12)'; ctx.shadowBlur = 24 * u; ctx.shadowOffsetY = 6 * u;
      ctx.fillStyle = '#ffffff'; rrect(ctx, x, y, w, h, radius); ctx.fill();
      ctx.shadowColor = 'transparent';
      if (style === 'accent bar') { ctx.save(); rrect(ctx, x, y, w, h, radius); ctx.clip(); ctx.fillStyle = col; ctx.fillRect(x, y, w, Math.max(6 * u, h * 0.03)); ctx.restore(); }
      out.text = '#1f2430'; out.muted = 'rgba(31,36,48,0.68)';
    } else if (style === 'outline') {
      ctx.strokeStyle = withAlpha(col, 0.7); ctx.lineWidth = 3 * u; rrect(ctx, x + 1.5 * u, y + 1.5 * u, w - 3 * u, h - 3 * u, radius); ctx.stroke();
    } else {
      ctx.fillStyle = withAlpha(col, 0.11); rrect(ctx, x, y, w, h, radius); ctx.fill();
    }
    ctx.restore();
    return out;
  }

  /* Wraps text, shrinking the font until it fits maxH. Returns {size, lines}. */
  function fitText(C, text, maxW, maxH, size, minSize, weight, lh) {
    var ctx = C.ctx, S = C.S, lines = [];
    text = String(text || '');
    if (!text) return { size: size, lines: [] };
    for (; size >= minSize; size *= 0.92) {
      setFont(ctx, S, size, weight);
      lines = wrap(ctx, text, maxW);
      if (lines.length * size * lh <= maxH) return { size: size, lines: lines };
    }
    size = minSize; setFont(ctx, S, size, weight);
    lines = wrap(ctx, text, maxW);
    var max = Math.max(1, Math.floor(maxH / (size * lh)));
    if (lines.length > max) { lines = lines.slice(0, max); lines[max - 1] = ellipsis(ctx, lines[max - 1] + '…', maxW); }
    return { size: size, lines: lines };
  }

  function gridLayout(n, W, H, gap, aspect) {
    var best = -1, cols = 1;
    for (var c = 1; c <= n; c++) {
      var r = Math.ceil(n / c), cw = (W - gap * (c - 1)) / c, ch = (H - gap * (r - 1)) / r;
      var score = Math.min(cw, ch * aspect);
      if (score > best + 0.5) { best = score; cols = c; }
    }
    var rows = Math.ceil(n / cols);
    return { cols: cols, rows: rows, cw: (W - gap * (cols - 1)) / cols, ch: (H - gap * (rows - 1)) / rows };
  }

  function pill(C, text, x, y, size, bg, fg, align) {
    var ctx = C.ctx, u = C.u;
    setFont(ctx, C.S, size, 700);
    var w = ctx.measureText(text).width + size * 1.2, h = size * 1.7;
    var px = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.fillStyle = bg; rrect(ctx, px, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, px + w / 2, y + h / 2 + u * 0.5);
    return { w: w, h: h };
  }

  /* ---------------- Content cards ---------------- */
  TEMPLATES.cards = {
    name: 'Content cards',
    description: 'A grid of cards with icon, tag, title and text',
    dataHint: 'Columns: Title, Text, Tag (optional label shown as a pill), Icon or image (an icon name, emoji, or the name of an uploaded image to show as a photo), Colour (optional, e.g. #2e6bff).',
    settings: [
      { group: 'Cards', key: 'cardStyle', label: 'Card style', type: 'select', def: 'white', options: CARD_STYLES },
      { group: 'Cards', key: 'cardVisual', label: 'Top of card', type: 'select', def: 'auto', options: ['auto', 'photo', 'icon circle', 'colour band with icon', 'big emoji or icon', 'none'] },
      { group: 'Cards', key: 'photoHeight', label: 'Photo height', type: 'range', def: 0.45, min: 0.2, max: 0.75, step: 0.01 },
      { group: 'Cards', key: 'cardAlign', label: 'Text alignment', type: 'select', def: 'left', options: ['left', 'center'] },
      { group: 'Cards', key: 'columns', label: 'Columns (0 = auto)', type: 'number', def: 0, min: 0, max: 8, step: 1 },
      { group: 'Cards', key: 'cardRadius', label: 'Corner radius', type: 'range', def: 18, min: 0, max: 60, step: 1 },
      { group: 'Cards', key: 'cardGap', label: 'Space between cards', type: 'range', def: 28, min: 4, max: 80, step: 1 },
      { group: 'Cards', key: 'stagger', label: 'Stagger animation', type: 'range', def: 0.5, min: 0, max: 0.9, step: 0.05 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var color = colorer(S);
      var items = cleanRows(C.T).map(function (r, i) {
        var c = /^#[0-9a-f]{3,6}$/i.test(String(r[4] || '').trim()) ? String(r[4]).trim() : color(r[2] || r[0], i);
        return { title: String(r[0]), text: String(r[1] || ''), tag: String(r[2] || '').trim(), icon: String(r[3] || '').trim(), color: c };
      });
      if (!items.length) return noData(C, R);
      var gap = S.cardGap * u, n = items.length, L;
      if (S.columns > 0) { var cc = Math.min(n, S.columns | 0), rr = Math.ceil(n / cc); L = { cols: cc, rows: rr, cw: (R.w - gap * (cc - 1)) / cc, ch: (R.h - gap * (rr - 1)) / rr }; }
      else L = gridLayout(n, R.w, R.h, gap, 1.15);
      var center = S.cardAlign === 'center';
      items.forEach(function (it, i) {
        var row = Math.floor(i / L.cols), col = i % L.cols, inRow = Math.min(L.cols, n - row * L.cols);
        var x = R.x + col * (L.cw + gap) + (L.cols - inRow) * (L.cw + gap) / 2, y = R.y + row * (L.ch + gap);
        var st = n > 1 ? i / (n - 1) * S.stagger : 0, k = clamp((C.pLinear - st) / (1 - S.stagger), 0, 1);
        if (k <= 0) return;
        var e = EASINGS.snappy(clamp(k * 1.6, 0, 1));
        ctx.save();
        ctx.globalAlpha = clamp(k * 3, 0, 1);
        ctx.translate(0, (1 - e) * 40 * u);
        var cw = L.cw, ch = L.ch, rad = S.cardRadius * u;
        var col2 = cardBg(C, x, y, cw, ch, S.cardStyle, it.color, rad);
        var base = Math.min(cw, ch * 1.3), pad = Math.max(16 * u, base * 0.08);
        var cy = y + pad, tx = center ? x + cw / 2 : x + pad, maxW = cw - pad * 2;
        var hasIcon = it.icon !== '';
        var photo = findImage(it.icon), visual = S.cardVisual;
        if (visual === 'auto') visual = photo ? 'photo' : 'icon circle';
        if (visual === 'photo' && !photo) visual = 'icon circle';
        if (visual === 'photo') {
          var ph = ch * S.photoHeight;
          if (imgReady(photo)) { ctx.save(); rrect(ctx, x, y, cw, ch, rad); ctx.clip(); drawCover(ctx, photo, x, y, cw, ph); ctx.restore(); }
          else { ctx.fillStyle = withAlpha(toHex(it.color), 0.2); ctx.fillRect(x, y, cw, ph); }
          cy = y + ph + pad * 0.6;
        } else if (visual === 'colour band with icon') {
          var bh = ch * 0.26;
          ctx.save(); rrect(ctx, x, y, cw, ch, rad); ctx.clip(); ctx.fillStyle = it.color; ctx.fillRect(x, y, cw, bh); ctx.restore();
          if (hasIcon) { var isz = bh * 0.56; drawIcon(ctx, it.icon, center ? x + cw / 2 - isz / 2 : x + pad, y + (bh - isz) / 2, isz, contrastText(toHex(it.color))); }
          cy = y + bh + pad * 0.7;
        } else if (visual === 'icon circle' && hasIcon) {
          var d = base * 0.2;
          var cx0 = center ? x + cw / 2 : x + pad + d / 2;
          avatar(ctx, it.icon, cx0, cy + d / 2, d, col2.accent, col2.onAccent);
          cy += d + pad * 0.6;
        } else if (visual === 'big emoji or icon' && hasIcon) {
          var bd = base * 0.24;
          drawIcon(ctx, it.icon, center ? x + cw / 2 - bd / 2 : x + pad, cy, bd, col2.accent);
          cy += bd + pad * 0.5;
        }
        if (it.tag) { var pp = pill(C, it.tag.toUpperCase(), tx, cy, Math.max(10 * u, base * 0.034), withAlpha(toHex(S.cardStyle === 'solid' ? col2.text : it.color), 0.16), S.cardStyle === 'solid' ? col2.text : it.color, center ? 'center' : 'left'); cy += pp.h + pad * 0.45; }
        var bottom = y + ch - pad;
        var tf = fitText(C, it.title, maxW, Math.max(20 * u, (bottom - cy) * 0.42), base * 0.085, 13 * u, 800, 1.15);
        ctx.textAlign = center ? 'center' : 'left'; ctx.textBaseline = 'top';
        setFont(ctx, S, tf.size, 800); ctx.fillStyle = col2.text;
        tf.lines.forEach(function (l) { ctx.fillText(l, tx, cy); cy += tf.size * 1.15; });
        cy += pad * 0.3;
        var bf = fitText(C, it.text, maxW, bottom - cy, base * 0.055, 11 * u, 400, 1.4);
        setFont(ctx, S, bf.size, 400); ctx.fillStyle = col2.muted;
        bf.lines.forEach(function (l) { ctx.fillText(l, tx, cy); cy += bf.size * 1.4; });
        ctx.restore();
      });
    }
  };

  /* ---------------- Quote / fact carousel ---------------- */
  TEMPLATES.quoteCards = {
    name: 'Quote carousel',
    description: 'One quote or fact card at a time',
    dataHint: 'Columns: Quote (or fact), Name (optional), Role or source (optional), Icon or photo (icon name, emoji or uploaded image name, optional). Each row becomes one card; they play in order across the animation length.',
    settings: [
      { group: 'Carousel', key: 'cardStyle', label: 'Card style', type: 'select', def: 'soft', options: CARD_STYLES },
      { group: 'Carousel', key: 'transition', label: 'Transition', type: 'select', def: 'slide', options: ['slide', 'fade', 'zoom'] },
      { group: 'Carousel', key: 'photoLayout', label: 'Photos (from the Icon column)', type: 'select', def: 'large photo', options: ['large photo', 'small avatar'] },
      { group: 'Carousel', key: 'quoteMarks', label: 'Show quotation mark', type: 'checkbox', def: true },
      { group: 'Carousel', key: 'showDots', label: 'Show progress dots', type: 'checkbox', def: true },
      { group: 'Carousel', key: 'colourEach', label: 'Different colour per card', type: 'checkbox', def: true },
      { group: 'Carousel', key: 'cardRadius', label: 'Corner radius', type: 'range', def: 28, min: 0, max: 80, step: 1 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var color = colorer(S);
      var items = cleanRows(C.T).map(function (r, i) { return { q: String(r[0]), name: String(r[1] || ''), role: String(r[2] || ''), icon: String(r[3] || '').trim(), i: i }; });
      if (!items.length) return noData(C, R);
      var n = items.length;
      var dotsH = S.showDots && n > 1 ? 50 * u : 0;
      var cw = Math.min(R.w, Math.max(R.w * 0.82, 0)), ch = R.h - dotsH;
      cw = Math.min(cw, ch * 2.4);
      var cx = R.x + R.w / 2, x0 = cx - cw / 2, y0 = R.y;
      var pos = C.pLinear * n, cur = Math.min(n - 1, Math.floor(pos)), local = pos - cur;
      if (C.pLinear >= 1) { cur = n - 1; local = 0.5; }
      var trans = 0.18;
      function drawCard(idx, offset, alpha, scale) {
        var it = items[idx], col = S.colourEach ? color(it.name || it.q, idx) : color('', 0);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(cx + offset, y0 + ch / 2); ctx.scale(scale, scale); ctx.translate(-cx, -(y0 + ch / 2));
        var c2 = cardBg(C, x0, y0, cw, ch, S.cardStyle, col, S.cardRadius * u);
        var pad = Math.max(30 * u, Math.min(cw, ch) * 0.1), tx = x0 + pad, maxW = cw - pad * 2, cy = y0 + pad;
        var qPhoto = findImage(it.icon), big = qPhoto && S.photoLayout === 'large photo';
        if (big) {
          var pw = cw * 0.36;
          if (imgReady(qPhoto)) { ctx.save(); rrect(ctx, x0, y0, cw, ch, S.cardRadius * u); ctx.clip(); drawCover(ctx, qPhoto, x0, y0, pw, ch); ctx.restore(); }
          tx = x0 + pw + pad; maxW = cw - pw - pad * 2;
        }
        if (S.quoteMarks) {
          setFont(ctx, S, Math.min(ch * 0.3, 200 * u), 900); ctx.fillStyle = withAlpha(toHex(c2.accent === '#ffffff' || c2.accent === '#1f2430' ? c2.accent : col), 0.9);
          ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('“', tx - 6 * u, cy - Math.min(ch * 0.06, 40 * u));
          cy += Math.min(ch * 0.15, 100 * u);
        }
        var footH = it.name || it.role ? Math.min(ch * 0.2, 110 * u) : 0;
        var qf = fitText(C, it.q, maxW, y0 + ch - pad - footH - cy, Math.min(ch * 0.1, 64 * u), 16 * u, 700, 1.25);
        setFont(ctx, S, qf.size, 700); ctx.fillStyle = c2.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        qf.lines.forEach(function (l) { ctx.fillText(l, tx, cy); cy += qf.size * 1.25; });
        if (footH) {
          var fy = y0 + ch - pad - footH * 0.7, ax = tx;
          if (it.icon && !big) {
            var d = footH * 0.8;
            avatar(ctx, it.icon, tx + d / 2, fy + d * 0.35, d, S.cardStyle === 'solid' ? withAlpha(c2.text, 0.2) : col, S.cardStyle === 'solid' ? c2.text : contrastText(toHex(col)));
            ax += d + 18 * u;
          }
          ctx.textBaseline = 'top';
          setFont(ctx, S, Math.min(footH * 0.3, 32 * u), 800); ctx.fillStyle = c2.text;
          ctx.fillText(ellipsis(ctx, it.name, maxW - (ax - tx)), ax, fy);
          setFont(ctx, S, Math.min(footH * 0.24, 25 * u), 500); ctx.fillStyle = c2.muted;
          ctx.fillText(ellipsis(ctx, it.role, maxW - (ax - tx)), ax, fy + Math.min(footH * 0.3, 32 * u) * 1.3);
        }
        ctx.restore();
      }
      var outK = cur < n - 1 ? clamp((local - (1 - trans)) / trans, 0, 1) : 0;
      var inK = cur > 0 ? clamp(local / trans, 0, 1) : clamp(local / trans + (C.t < 0.05 ? 0 : 1), 0, 1);
      if (cur === 0) inK = EASINGS.snappy(clamp(C.pLinear * n / trans, 0, 1));
      var eo = C.ease(outK), shift = R.w * 0.6;
      if (S.transition === 'slide') {
        drawCard(cur, -eo * shift, 1 - eo, 1);
        if (outK > 0) drawCard(cur + 1, (1 - eo) * shift, eo, 1);
        if (cur === 0 && inK < 1) { /* first card entrance handled by alpha below */ }
      } else if (S.transition === 'zoom') {
        drawCard(cur, 0, 1 - eo, 1 + eo * 0.12);
        if (outK > 0) drawCard(cur + 1, 0, eo, 0.88 + eo * 0.12);
      } else {
        drawCard(cur, 0, 1 - eo, 1);
        if (outK > 0) drawCard(cur + 1, 0, eo, 1);
      }
      if (cur === 0 && inK < 1) { ctx.fillStyle = S.background; ctx.globalAlpha = 1 - inK; ctx.fillRect(R.x - 2, R.y - 2, R.w + 4, ch + 4); ctx.globalAlpha = 1; }
      if (dotsH) {
        var active = outK > 0.5 ? cur + 1 : cur, dw = 14 * u, gapD = 14 * u, total = n * dw + (n - 1) * gapD + 24 * u;
        var dx = cx - total / 2, dy = R.y + R.h - dotsH / 2;
        for (var i = 0; i < n; i++) {
          var w = i === active ? dw + 24 * u : dw;
          ctx.fillStyle = i === active ? color('', 0) : withAlpha(S.textColor, 0.18);
          rrect(ctx, dx, dy - dw / 2, w, dw, dw / 2); ctx.fill(); dx += w + gapD;
        }
      }
    }
  };

  /* ---------------- Leaderboard cards ---------------- */
  TEMPLATES.rankCards = {
    name: 'Leaderboard cards',
    description: 'Ranked cards with values and change arrows',
    dataHint: 'Columns: Name, Value, Change (optional, e.g. +12 or -3.5%), Icon or photo (icon name, emoji or uploaded image name, optional), Caption (optional).',
    settings: [
      { group: 'Leaderboard', key: 'cardStyle', label: 'Card style', type: 'select', def: 'white', options: CARD_STYLES },
      { group: 'Leaderboard', key: 'sortRanks', label: 'Sort largest first', type: 'checkbox', def: true },
      { group: 'Leaderboard', key: 'highlightTop', label: 'Highlight the top', type: 'number', def: 3, min: 0, max: 20, step: 1 },
      { group: 'Leaderboard', key: 'showBars', label: 'Progress bar in each card', type: 'checkbox', def: true },
      { group: 'Leaderboard', key: 'upColor', label: 'Rise colour', type: 'color', def: '#16B88A' },
      { group: 'Leaderboard', key: 'downColor', label: 'Fall colour', type: 'color', def: '#F05252' },
      { group: 'Leaderboard', key: 'cardRadius', label: 'Corner radius', type: 'range', def: 16, min: 0, max: 50, step: 1 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var color = colorer(S);
      var items = cleanRows(C.T).map(function (r, i) {
        var ch = String(r[2] == null ? '' : r[2]).trim();
        return { name: String(r[0]), v: num(r[1]), dec: decimalsOf(r[1]), chg: ch, chgV: num(ch), icon: String(r[3] || '').trim(), cap: String(r[4] || ''), i: i };
      }).filter(function (d) { return isFinite(d.v); });
      if (!items.length) return noData(C, R);
      if (S.sortRanks) items.sort(function (a, b) { return b.v - a.v; });
      var n = items.length, gap = 16 * u;
      var cols = n > 8 && R.w > R.h ? 2 : 1, perCol = Math.ceil(n / cols);
      var cw = (R.w - gap * 2 * (cols - 1)) / cols, rh = Math.min(140 * u, (R.h - gap * (perCol - 1)) / perCol);
      var maxV = Math.max.apply(null, items.map(function (d) { return Math.abs(d.v); })) || 1;
      var startY = R.y + (R.h - (perCol * rh + (perCol - 1) * gap)) / 2;
      items.forEach(function (d, i) {
        var col = Math.floor(i / perCol), row = i % perCol;
        var x = R.x + col * (cw + gap * 2), y = startY + row * (rh + gap);
        var st = n > 1 ? i / (n - 1) * 0.5 : 0, k = clamp((C.pLinear - st) / 0.5, 0, 1);
        if (k <= 0) return;
        var e = EASINGS.snappy(clamp(k * 1.5, 0, 1));
        var accent = toHex(color(d.name, d.i));
        var top = i < (S.highlightTop | 0);
        ctx.save(); ctx.globalAlpha = clamp(k * 3, 0, 1); ctx.translate((1 - e) * 80 * u, 0);
        var c2 = cardBg(C, x, y, cw, rh, top && S.cardStyle !== 'solid' ? S.cardStyle : S.cardStyle, top ? accent : (S.cardStyle === 'solid' ? mixColor(accent, '#ffffff', 0.35) : accent), S.cardRadius * u);
        var pad = rh * 0.18, cy = y + rh / 2;
        // rank badge
        var bd = rh * 0.52, bx = x + pad;
        ctx.fillStyle = top ? (S.cardStyle === 'solid' ? withAlpha(c2.text, 0.22) : accent) : withAlpha(c2.text, 0.08);
        ctx.beginPath(); ctx.arc(bx + bd / 2, cy, bd / 2, 0, Math.PI * 2); ctx.fill();
        setFont(ctx, S, bd * 0.48, 900); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = top ? (S.cardStyle === 'solid' ? c2.text : contrastText(accent)) : c2.text;
        ctx.fillText(String(i + 1), bx + bd / 2, cy + u);
        var tx = bx + bd + pad * 0.8;
        if (d.icon) {
          if (findImage(d.icon)) { var asz = rh * 0.62; avatar(ctx, d.icon, tx + asz / 2, cy, asz); tx += asz + pad * 0.6; }
          else { var isz = rh * 0.42; drawIcon(ctx, d.icon, tx, cy - isz / 2, isz, S.cardStyle === 'solid' ? c2.text : accent); tx += isz + pad * 0.6; }
        }
        // right side: value and change
        var valSize = Math.min(rh * 0.36, 54 * u);
        setFont(ctx, S, valSize, 800);
        var valTxt = fmt(d.v * C.ease(k), S, d.dec > 0 ? d.dec : (S.compact ? null : S.decimals));
        var vw = ctx.measureText(fmt(d.v, S, d.dec > 0 ? d.dec : (S.compact ? null : S.decimals))).width;
        var chgW = 0;
        if (d.chg) {
          var up = isFinite(d.chgV) ? d.chgV >= 0 : !/^[-−]/.test(d.chg);
          var chTxt = (up ? '▲ ' : '▼ ') + d.chg.replace(/^[+\-−]/, '');
          setFont(ctx, S, Math.max(11 * u, rh * 0.15), 700);
          chgW = ctx.measureText(chTxt).width + rh * 0.2;
          var pc = up ? S.upColor : S.downColor;
          pill(C, chTxt, x + cw - pad, cy - rh * 0.13, Math.max(11 * u, rh * 0.15), S.cardStyle === 'solid' ? withAlpha('#ffffff', 0.9) : withAlpha(toHex(pc), 0.14), pc, 'right');
          chgW += pad * 0.6;
        }
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; setFont(ctx, S, valSize, 800); ctx.fillStyle = S.cardStyle === 'solid' ? c2.text : (top ? accent : c2.text);
        ctx.fillText(valTxt, x + cw - pad - chgW, cy + u);
        var nameW = x + cw - pad - chgW - vw - pad - tx;
        var hasCap = d.cap && rh > 70 * u;
        setFont(ctx, S, Math.min(rh * 0.24, 34 * u), 700); ctx.fillStyle = c2.text; ctx.textAlign = 'left';
        ctx.fillText(ellipsis(ctx, d.name, nameW), tx, hasCap || S.showBars ? cy - rh * 0.13 : cy);
        if (hasCap) { setFont(ctx, S, Math.min(rh * 0.15, 22 * u), 500); ctx.fillStyle = c2.muted; ctx.fillText(ellipsis(ctx, d.cap, nameW), tx, cy + rh * 0.16); }
        else if (S.showBars) {
          var bw = Math.max(0, nameW), bh2 = Math.max(4 * u, rh * 0.07), by = cy + rh * 0.14;
          ctx.fillStyle = withAlpha(c2.text, 0.1); rrect(ctx, tx, by, bw, bh2, bh2 / 2); ctx.fill();
          ctx.fillStyle = S.cardStyle === 'solid' ? c2.text : accent; rrect(ctx, tx, by, bw * Math.abs(d.v) / maxV * C.ease(k), bh2, bh2 / 2); ctx.fill();
        }
        ctx.restore();
      });
    }
  };

  /* ---------------- Process / step cards ---------------- */
  TEMPLATES.stepCards = {
    name: 'Step cards',
    description: 'Numbered steps for a process or how-to',
    dataHint: 'Columns: Step title, Description (optional), Icon (icon name, emoji or uploaded image name, optional). Steps are numbered in the order given.',
    settings: [
      { group: 'Steps', key: 'cardStyle', label: 'Card style', type: 'select', def: 'soft', options: CARD_STYLES },
      { group: 'Steps', key: 'stepDirection', label: 'Direction', type: 'select', def: 'auto', options: ['auto', 'across', 'down'] },
      { group: 'Steps', key: 'connector', label: 'Connector', type: 'select', def: 'arrows', options: ['arrows', 'line', 'none'] },
      { group: 'Steps', key: 'colourEach', label: 'Different colour per step', type: 'checkbox', def: true },
      { group: 'Steps', key: 'cardRadius', label: 'Corner radius', type: 'range', def: 20, min: 0, max: 60, step: 1 }
    ],
    draw: function (C, R) {
      var ctx = C.ctx, S = C.S, u = C.u;
      var color = colorer(S);
      var items = cleanRows(C.T).map(function (r, i) { return { title: String(r[0]), text: String(r[1] || ''), icon: String(r[2] || '').trim(), i: i }; });
      if (!items.length) return noData(C, R);
      var n = items.length;
      var across = S.stepDirection === 'across' || (S.stepDirection === 'auto' && R.w >= R.h * 1.1 && n <= 6);
      var link = S.connector === 'none' ? 18 * u : 56 * u;
      var cw, ch;
      if (across) { cw = (R.w - link * (n - 1)) / n; ch = Math.min(R.h, cw * 1.6); }
      else { ch = Math.min(190 * u, (R.h - link * 0.6 * (n - 1)) / n); cw = Math.min(R.w, Math.max(ch * 5, R.w * 0.6)); }
      var oy = across ? R.y + (R.h - ch) / 2 : R.y + (R.h - (n * ch + (n - 1) * link * 0.6)) / 2, ox = across ? R.x : R.x + (R.w - cw) / 2;
      items.forEach(function (it, i) {
        var st = n > 1 ? i / (n - 1) * 0.65 : 0, k = clamp((C.pLinear - st) / 0.35, 0, 1);
        var col = toHex(S.colourEach ? color(it.title, i) : color('', 0));
        var x = across ? ox + i * (cw + link) : ox, y = across ? oy : oy + i * (ch + link * 0.6);
        // connector to previous
        if (i > 0 && S.connector !== 'none' && k > 0) {
          ctx.save(); ctx.globalAlpha = clamp(k * 2, 0, 1);
          ctx.strokeStyle = withAlpha(S.textColor, 0.35); ctx.fillStyle = withAlpha(S.textColor, 0.35); ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
          if (across) {
            var ax0 = x - link + 10 * u, ax1 = x - 10 * u, ay = y + ch / 2;
            ctx.beginPath(); ctx.moveTo(ax0, ay); ctx.lineTo(lerp(ax0, ax1, C.ease(k)), ay); ctx.stroke();
            if (S.connector === 'arrows' && k > 0.6) { ctx.beginPath(); ctx.moveTo(ax1, ay); ctx.lineTo(ax1 - 12 * u, ay - 9 * u); ctx.lineTo(ax1 - 12 * u, ay + 9 * u); ctx.closePath(); ctx.fill(); }
          } else {
            var vx = x + 44 * u, vy0 = y - link * 0.6 + 6 * u, vy1 = y - 6 * u;
            ctx.beginPath(); ctx.moveTo(vx, vy0); ctx.lineTo(vx, lerp(vy0, vy1, C.ease(k))); ctx.stroke();
            if (S.connector === 'arrows' && k > 0.6) { ctx.beginPath(); ctx.moveTo(vx, vy1); ctx.lineTo(vx - 8 * u, vy1 - 10 * u); ctx.lineTo(vx + 8 * u, vy1 - 10 * u); ctx.closePath(); ctx.fill(); }
          }
          ctx.restore();
        }
        if (k <= 0) return;
        var e = EASINGS.snappy(clamp(k * 1.4, 0, 1));
        ctx.save(); ctx.globalAlpha = clamp(k * 3, 0, 1);
        ctx.translate(across ? 0 : (1 - e) * 40 * u, across ? (1 - e) * 40 * u : 0);
        var c2 = cardBg(C, x, y, cw, ch, S.cardStyle, col, S.cardRadius * u);
        var base = across ? Math.min(cw, ch * 0.8) : Math.min(ch * 2.2, cw * 0.4), pad = Math.max(16 * u, base * 0.09);
        var badge = across ? base * 0.26 : Math.min(ch * 0.55, 80 * u);
        var bx = x + pad, by = across ? y + pad : y + (ch - badge) / 2;
        ctx.fillStyle = c2.accent; ctx.beginPath(); ctx.arc(bx + badge / 2, by + badge / 2, badge / 2, 0, Math.PI * 2); ctx.fill();
        setFont(ctx, S, badge * 0.5, 900); ctx.fillStyle = c2.onAccent; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), bx + badge / 2, by + badge / 2 + u);
        if (it.icon) {
          var isz = badge * 0.8;
          drawIcon(ctx, it.icon, across ? x + cw - pad - isz : x + cw - pad - isz, across ? by + (badge - isz) / 2 : y + (ch - isz) / 2, isz, withAlpha(toHex(S.cardStyle === 'solid' ? c2.text : col), 0.85));
        }
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        if (across) {
          var cy = by + badge + pad * 0.7, maxW = cw - pad * 2, bottom = y + ch - pad;
          var tf = fitText(C, it.title, maxW, (bottom - cy) * 0.4, base * 0.1, 13 * u, 800, 1.15);
          setFont(ctx, S, tf.size, 800); ctx.fillStyle = c2.text; tf.lines.forEach(function (l) { ctx.fillText(l, x + pad, cy); cy += tf.size * 1.15; });
          cy += pad * 0.3;
          var bf = fitText(C, it.text, maxW, bottom - cy, base * 0.062, 11 * u, 400, 1.4);
          setFont(ctx, S, bf.size, 400); ctx.fillStyle = c2.muted; bf.lines.forEach(function (l) { ctx.fillText(l, x + pad, cy); cy += bf.size * 1.4; });
        } else {
          var tx = bx + badge + pad * 0.8, mw = x + cw - pad - (it.icon ? badge * 0.8 + pad : 0) - tx;
          var tsz = Math.min(ch * 0.26, 34 * u), dsz = Math.min(ch * 0.18, 24 * u);
          setFont(ctx, S, tsz, 800);
          var hasD = it.text && ch > 70 * u;
          var blockH = tsz * 1.2 + (hasD ? dsz * 1.35 * Math.min(2, Math.max(1, Math.floor((ch - pad - tsz * 1.2) / (dsz * 1.35)))) : 0);
          var ty = y + (ch - blockH) / 2;
          ctx.fillStyle = c2.text; ctx.fillText(ellipsis(ctx, it.title, mw), tx, ty);
          if (hasD) {
            setFont(ctx, S, dsz, 400); ctx.fillStyle = c2.muted;
            var dl = wrap(ctx, it.text, mw), maxL = Math.max(1, Math.min(2, Math.floor((ch - pad - tsz * 1.2) / (dsz * 1.35))));
            if (dl.length > maxL) { dl = dl.slice(0, maxL); dl[maxL - 1] = ellipsis(ctx, dl[maxL - 1] + '…', mw); }
            dl.forEach(function (l, li) { ctx.fillText(l, tx, ty + tsz * 1.2 + li * dsz * 1.35); });
          }
        }
        ctx.restore();
      });
    }
  };

  /* ================================================================== */
  /* Template catalogue: purpose category, data kind, time-animated      */
  /* ================================================================== */
  var CATEGORIES = ['Comparison', 'Change over time', 'Part of a whole', 'Correlation', 'Flows & relationships', 'Maps', 'Key figures', 'Cards', 'Text, events & schedules'];
  var META = {
    columns: ['Comparison', 'quantitative', false], waterfall: ['Comparison', 'quantitative', false], radar: ['Comparison', 'quantitative', false],
    survey: ['Comparison', 'quantitative', false], table: ['Comparison', 'mixed', false],
    barRace: ['Change over time', 'quantitative', true], line: ['Change over time', 'quantitative', true], area: ['Change over time', 'quantitative', true],
    slope: ['Change over time', 'quantitative', false], calendar: ['Change over time', 'quantitative', true],
    donut: ['Part of a whole', 'quantitative', false], treemap: ['Part of a whole', 'quantitative', false], sunburst: ['Part of a whole', 'quantitative', false],
    packedBubbles: ['Part of a whole', 'quantitative', false], marimekko: ['Part of a whole', 'quantitative', false], pictogram: ['Part of a whole', 'quantitative', false],
    parliament: ['Part of a whole', 'quantitative', false],
    scatter: ['Correlation', 'quantitative', true],
    sankey: ['Flows & relationships', 'quantitative', false], chord: ['Flows & relationships', 'quantitative', false],
    arc: ['Flows & relationships', 'qualitative', false], network: ['Flows & relationships', 'qualitative', false],
    choropleth: ['Maps', 'mixed', true], pointMap: ['Maps', 'quantitative', false],
    counters: ['Key figures', 'quantitative', false], gauge: ['Key figures', 'quantitative', false],
    cards: ['Cards', 'qualitative', false], quoteCards: ['Cards', 'qualitative', true], rankCards: ['Cards', 'quantitative', false], stepCards: ['Cards', 'qualitative', false],
    wordCloud: ['Text, events & schedules', 'qualitative', false], timeline: ['Text, events & schedules', 'qualitative', true], gantt: ['Text, events & schedules', 'mixed', true]
  };
  Object.keys(META).forEach(function (k) {
    if (!TEMPLATES[k]) return;
    TEMPLATES[k].category = META[k][0]; TEMPLATES[k].kind = META[k][1]; TEMPLATES[k].timeBased = META[k][2];
  });

  function noData(C, R) {
    var ctx = C.ctx;
    setFont(ctx, C.S, 28 * C.u, 500);
    ctx.fillStyle = withAlpha(C.S.textColor, 0.5);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Add some data in the Data tab to see your chart', R.x + R.w / 2, R.y + R.h / 2);
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                         */
  /* ------------------------------------------------------------------ */

  function settingsSchema(template) {
    var tpl = TEMPLATES[template];
    return COMMON_SETTINGS.concat(tpl ? tpl.settings : []);
  }

  function resolveSettings(project) {
    var S = {};
    settingsSchema(project.template).forEach(function (d) { S[d.key] = d.def; });
    var src = project.settings || {};
    for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined) S[k] = src[k];
    ['decimals', 'textScale', 'duration', 'hold'].forEach(function (k) { S[k] = Number(S[k]); });
    return S;
  }

  function totalTime(project) {
    var S = resolveSettings(project);
    return Math.max(0.5, S.duration || 0) + Math.max(0, S.hold || 0);
  }

  function draw(ctx, w, h, project, t) {
    var S = resolveSettings(project);
    var tpl = TEMPLATES[project.template] || TEMPLATES.barRace;
    var u = Math.min(w, h) / 1080 * (S.textScale || 1);
    var dur = Math.max(0.5, S.duration || 0);
    var pLinear = clamp(t / dur, 0, 1);
    var ease = EASINGS[S.easing] || EASINGS.smooth;

    setImageLibrary(project.images, S.imageShape);
    ctx.save();
    ctx.fillStyle = S.background; ctx.fillRect(0, 0, w, h);
    var bgIm = S.bgImage ? findImage(S.bgImage) : null;
    if (imgReady(bgIm) && S.bgImageOpacity > 0) { ctx.save(); ctx.globalAlpha = S.bgImageOpacity; drawCover(ctx, bgIm, 0, 0, w, h, S.bgImageFit); ctx.restore(); }
    var pad = Math.round(Math.min(w, h) * 0.06);
    var logoIm = S.logo ? findImage(S.logo) : null, logoH = 64 * u * (S.logoSize || 1), logoW = 0;
    if (imgReady(logoIm)) {
      logoW = logoH * logoIm.naturalWidth / logoIm.naturalHeight;
      if (logoW > w * 0.3) { logoW = w * 0.3; logoH = logoW * logoIm.naturalHeight / logoIm.naturalWidth; }
      var lpos = S.logoPosition || 'top right';
      var lx = /left/.test(lpos) ? pad : w - pad - logoW, ly = /top/.test(lpos) ? pad : h - pad - logoH;
      ctx.drawImage(logoIm, lx, ly, logoW, logoH);
    }
    var logoTop = logoW && /top/.test(S.logoPosition || 'top right'), logoLeft = logoW && /left/.test(S.logoPosition || '');
    var y = pad;
    var headAlpha = clamp(t / 0.35, 0, 1);
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.globalAlpha = headAlpha;
    if (S.title) {
      setFont(ctx, S, 54 * u, 700);
      ctx.fillStyle = S.textColor;
      var tx0 = logoTop && logoLeft ? pad + logoW + 24 * u : pad, tw0 = w - pad * 2 - (logoTop ? logoW + 24 * u : 0);
      wrap(ctx, S.title, tw0).forEach(function (l) { ctx.fillText(l, tx0, y); y += 54 * u * 1.18; });
      y += 6 * u;
    }
    if (S.subtitle) {
      setFont(ctx, S, 30 * u, 400);
      ctx.fillStyle = withAlpha(S.textColor, 0.68);
      var sx0 = logoTop && logoLeft ? pad + logoW + 24 * u : pad, sw0 = w - pad * 2 - (logoTop ? logoW + 24 * u : 0);
      wrap(ctx, S.subtitle, sw0).forEach(function (l) { ctx.fillText(l, sx0, y); y += 30 * u * 1.3; });
    }
    if (S.title || S.subtitle) y += 26 * u;
    if (logoTop) y = Math.max(y, pad + logoH + 20 * u);
    var bottom = h - pad;
    if (S.source) {
      setFont(ctx, S, 22 * u, 400);
      ctx.fillStyle = withAlpha(S.textColor, 0.55);
      ctx.textBaseline = 'bottom';
      var bottomLogo = logoW && !logoTop;
      ctx.fillText(ellipsis(ctx, S.source, w - pad * 2 - (bottomLogo ? logoW + 24 * u : 0)), bottomLogo && logoLeft ? pad + logoW + 24 * u : pad, bottom);
      bottom -= 46 * u;
    }
    if (logoW && !logoTop) bottom = Math.min(bottom, h - pad - logoH - 16 * u);
    ctx.globalAlpha = 1;
    var R = { x: pad, y: y, w: w - pad * 2, h: Math.max(10, bottom - y) };
    var C = { ctx: ctx, S: S, u: u, T: project.data || [], t: t, pLinear: pLinear, pEased: ease(pLinear), ease: ease, w: w, h: h };
    ctx.save();
    tpl.draw(C, R);
    ctx.restore();
    ctx.restore();
  }

  /*
   * A self-driving player for a <canvas>: handles devicePixelRatio,
   * resizing, play/pause/seek and looping. Used by the editor preview and
   * by exported HTML files.
   */
  function createPlayer(canvas, getProject, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var t = 0, playing = false, last = 0, raf = 0;
    function render() {
      var P = getProject();
      var w = P.size.w, h = P.size.h;
      var cssW = canvas.clientWidth || w;
      var dpr = Math.min(window.devicePixelRatio || 1, 3);
      var pw = Math.max(1, Math.round(cssW * dpr)), ph = Math.max(1, Math.round(cssW * h / w * dpr));
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      ctx.setTransform(pw / w, 0, 0, ph / h, 0, 0);
      draw(ctx, w, h, P, t);
      if (opts.onTime) opts.onTime(t, totalTime(P));
    }
    function tick(now) {
      if (!playing) return;
      t += Math.min(0.1, (now - last) / 1000); last = now;
      var T = totalTime(getProject());
      if (t >= T) {
        if (opts.loop && opts.loop()) t = 0;
        else { t = T; playing = false; }
      }
      render();
      if (playing) raf = requestAnimationFrame(tick);
      else if (opts.onState) opts.onState(false);
    }
    var api = {
      play: function () {
        if (playing) return;
        if (t >= totalTime(getProject()) - 1e-3) t = 0;
        playing = true; last = performance.now();
        if (opts.onState) opts.onState(true);
        raf = requestAnimationFrame(tick);
      },
      pause: function () { playing = false; cancelAnimationFrame(raf); if (opts.onState) opts.onState(false); },
      toggle: function () { if (playing) api.pause(); else api.play(); },
      seek: function (v) { t = clamp(v, 0, totalTime(getProject())); render(); },
      render: render,
      time: function () { return t; },
      isPlaying: function () { return playing; }
    };
    if (window.ResizeObserver) new ResizeObserver(function () { render(); }).observe(canvas);
    var pend = 0; onImageLoad(function () { if (!pend) pend = requestAnimationFrame(function () { pend = 0; if (!playing) render(); }); });
    return api;
  }

  return {
    version: '1.0.0',
    TEMPLATES: TEMPLATES,
    PALETTES: PALETTES,
    FONTS: FONTS,
    settingsSchema: settingsSchema,
    resolveSettings: resolveSettings,
    totalTime: totalTime,
    draw: draw,
    createPlayer: createPlayer,
    num: num,
    preloadImages: preloadImages,
    onImageLoad: onImageLoad,
    ICON_NAMES: ICON_NAMES,
    CATEGORIES: CATEGORIES,
    drawIcon: drawIcon
  };
}

if (typeof window !== 'undefined') window.Infographic = InfographicRuntime();
