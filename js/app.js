/* Infographic Studio editor */
(function () {
  'use strict';

  var STORAGE_KEY = 'infographic-studio.project.v1';
  var SIZES = [
    { id: '1920x1080', label: 'Landscape 16:9 (1920×1080)', w: 1920, h: 1080 },
    { id: '1280x720', label: 'HD 16:9 (1280×720)', w: 1280, h: 720 },
    { id: '1080x1080', label: 'Square 1:1 (1080×1080)', w: 1080, h: 1080 },
    { id: '1080x1350', label: 'Portrait 4:5 (1080×1350)', w: 1080, h: 1350 },
    { id: '1080x1920', label: 'Story 9:16 (1080×1920)', w: 1080, h: 1920 },
    { id: '3840x2160', label: '4K 16:9 (3840×2160)', w: 3840, h: 2160 },
    { id: 'custom', label: 'Custom…' }
  ];

  var $ = function (id) { return document.getElementById(id); };
  var project;
  var player;
  var focusCell = { r: 0, c: 0 };

  /* ---------------- Persistence ---------------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var saveTimer = 0;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); }
      catch (e) { if (!autosave.warned) { autosave.warned = true; toast('This project is too big to autosave in the browser (images take space). Use “Save project” to keep it.', 6000); } }
    }, 300);
  }

  function loadInitial() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { var p = JSON.parse(raw); if (p && p.template && p.data) return p; }
    } catch (e) { /* ignore */ }
    var s = InfographicSamples.barRace(); s.isSample = true; return s;
  }

  function setProject(p) {
    project = p;
    project.settings = project.settings || {};
    project.size = project.size || { w: 1920, h: 1080 };
    if (!Infographic.TEMPLATES[project.template]) project.template = 'barRace';
    $('projName').value = project.name || 'Untitled project';
    $('lookSel').value = Infographic.resolveSettings(project).look;
    if (Object.keys(cards).length) markActive(); else renderTemplates();
    renderSize();
    renderSettings();
    renderGrid();
    renderImages();
    fitCanvas();
    player.seek(Infographic.resolveSettings(project).duration * 0.999);
    autosave();
  }

  function changed(opts) {
    opts = opts || {};
    if (opts.data) project.isSample = false;
    autosave();
    player.render();
  }

  /* ---------------- Toast & modal ---------------- */
  var toastTimer = 0;
  function toast(msg, ms) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }

  function modal(title, bodyHTML, actions) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = bodyHTML;
    var a = $('modalActions'); a.innerHTML = '';
    (actions || []).forEach(function (act) {
      var b = document.createElement('button');
      b.textContent = act.label; if (act.cls) b.className = act.cls;
      b.onclick = function () { if (act.onClick() !== false) closeModal(); };
      a.appendChild(b);
    });
    $('modal').hidden = false;
  }
  function closeModal() { $('modal').hidden = true; }

  /* ---------------- Templates ---------------- */
  var cards = {}, pickerState = { filter: 'all', sort: 'purpose', q: '' };
  var KIND_LABEL = { quantitative: 'Numbers', qualitative: 'Words & links', mixed: 'Mixed' };
  var KIND_GROUP = { quantitative: 'Quantitative: numbers and amounts', qualitative: 'Qualitative: words, categories and connections', mixed: 'Mixed: numbers with dates, names or categories' };

  function buildCards() {
    var keys = Object.keys(Infographic.TEMPLATES), queue = [];
    keys.forEach(function (key) {
      var tpl = Infographic.TEMPLATES[key];
      var b = document.createElement('button');
      b.className = 'tpl'; b.title = tpl.description; b.dataset.key = key;
      var c = document.createElement('canvas'); c.width = 400; c.height = 225;
      b.appendChild(c);
      var tags = '<span class="tag ' + tpl.kind + '">' + (KIND_LABEL[tpl.kind] || '') + '</span>' + (tpl.timeBased ? '<span class="tag">▶ over time</span>' : '');
      b.insertAdjacentHTML('beforeend', '<b>' + tpl.name + '</b><div class="tags">' + tags + '</div>');
      b.onclick = function () { switchTemplate(key); };
      cards[key] = b;
      queue.push([key, c]);
    });
    // draw thumbnails progressively so the editor opens instantly
    (function next() {
      var job = queue.shift(); if (!job) return;
      try {
        var sample = InfographicSamples[job[0]]();
        sample.settings.title = ''; sample.settings.subtitle = ''; sample.settings.source = '';
        var S = Infographic.resolveSettings(sample), ctx = job[1].getContext('2d');
        ctx.scale(400 / 640, 225 / 360);
        Infographic.draw(ctx, 640, 360, sample, S.duration * 0.85 + 0.3);
      } catch (e) { console.warn('Thumbnail failed for', job[0], e); }
      setTimeout(next, 0);
    })();
  }

  function matches(tpl) {
    var f = pickerState.filter;
    if (f === 'quantitative' && tpl.kind === 'qualitative') return false;
    if (f === 'qualitative' && tpl.kind === 'quantitative') return false;
    if (f === 'time' && !tpl.timeBased) return false;
    var q = pickerState.q.trim().toLowerCase();
    if (q && (tpl.name + ' ' + tpl.description + ' ' + tpl.category + ' ' + tpl.kind).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }

  function renderTemplates() {
    if (!Object.keys(cards).length) buildCards();
    var list = $('templateList');
    list.innerHTML = '';
    var keys = Object.keys(Infographic.TEMPLATES).filter(function (k) { return matches(Infographic.TEMPLATES[k]); });
    $('tplCount').textContent = '(' + keys.length + ')';
    var groups = [];
    if (pickerState.sort === 'az') {
      keys.sort(function (a, b) { return Infographic.TEMPLATES[a].name.localeCompare(Infographic.TEMPLATES[b].name); });
      groups.push({ name: null, keys: keys });
    } else {
      var order = pickerState.sort === 'kind' ? ['quantitative', 'mixed', 'qualitative'] : Infographic.CATEGORIES;
      order.forEach(function (g) {
        var ks = keys.filter(function (k) { var t = Infographic.TEMPLATES[k]; return (pickerState.sort === 'kind' ? t.kind : t.category) === g; });
        if (ks.length) groups.push({ name: pickerState.sort === 'kind' ? KIND_GROUP[g] : g, keys: ks });
      });
    }
    groups.forEach(function (g) {
      if (g.name) list.insertAdjacentHTML('beforeend', '<h3 class="tplGroup">' + g.name + ' <span>' + g.keys.length + '</span></h3>');
      g.keys.forEach(function (k) { list.appendChild(cards[k]); });
    });
    if (!keys.length) list.innerHTML = '<p class="tplEmpty">No templates match.</p>';
    markActive();
  }

  function markActive() {
    Object.keys(cards).forEach(function (k) { cards[k].classList.toggle('active', k === project.template); });
  }

  function switchTemplate(key) {
    if (key === project.template) return;
    if (project.isSample || !project.data || project.data.length < 2) {
      var s = InfographicSamples[key]();
      s.isSample = true;
      s.size = project.size;
      if (project.images) s.images = project.images;
      LOOK_KEYS.forEach(function (k) { if (project.settings[k] !== undefined) s.settings[k] = project.settings[k]; });
      if ((project.settings.look || 'classic') !== 'classic') THEME_KEYS.forEach(function (k) { delete s.settings[k]; });
      if (!project.isSample) ['palette', 'background', 'textColor', 'font', 'textScale', 'customColors', 'easing'].forEach(function (k) {
        if (project.settings[k] !== undefined) s.settings[k] = project.settings[k];
      });
      setProject(s);
    } else {
      project.template = key;
      setProject(project);
      toast('Kept your data. Use "Load sample data" in the Data tab to see example data for this template.', 4200);
    }
  }

  /* ---------------- Size ---------------- */
  function renderSize() {
    var sel = $('sizeSel');
    if (!sel.options.length) {
      SIZES.forEach(function (s) { var o = document.createElement('option'); o.value = s.id; o.textContent = s.label; sel.appendChild(o); });
    }
    var id = project.size.w + 'x' + project.size.h;
    var known = SIZES.some(function (s) { return s.id === id; });
    sel.value = known ? id : 'custom';
    $('customSize').hidden = known;
    $('cw').value = project.size.w; $('ch').value = project.size.h;
  }

  function setSize(w, h) {
    w = Math.max(64, Math.min(3840, Math.round(w / 2) * 2));
    h = Math.max(64, Math.min(3840, Math.round(h / 2) * 2));
    project.size = { w: w, h: h };
    fitCanvas(); changed();
  }

  /* ---------------- Settings panel ---------------- */
  function renderSettings() {
    var panel = $('settingsPanel');
    panel.innerHTML = '';
    var schema = Infographic.settingsSchema(project.template);
    var S = Infographic.resolveSettings(project);
    var groups = {};
    var order = [];
    var tplGroupNames = Infographic.TEMPLATES[project.template].settings.map(function (d) { return d.group; });
    schema.forEach(function (d) { if (!groups[d.group]) { groups[d.group] = []; order.push(d.group); } groups[d.group].push(d); });
    // show the template-specific group second, after Header
    order.sort(function (a, b) {
      var rank = function (g) { return g === 'Header' ? 0 : tplGroupNames.indexOf(g) >= 0 ? 1 : 2; };
      return rank(a) - rank(b);
    });
    order.forEach(function (g, gi) {
      var det = document.createElement('details');
      if (gi < 3) det.open = true;
      det.innerHTML = '<summary>' + g + '</summary>';
      groups[g].forEach(function (d) { det.appendChild(field(d, S[d.key])); });
      panel.appendChild(det);
    });
    var reset = document.createElement('div');
    reset.className = 'field';
    reset.style.paddingTop = '14px';
    reset.innerHTML = '<button class="ghost danger">Reset style settings</button>';
    reset.querySelector('button').onclick = function () {
      var keep = { title: project.settings.title, subtitle: project.settings.subtitle, source: project.settings.source };
      project.settings = keep; renderSettings(); changed({ thumbs: false });
    };
    panel.appendChild(reset);
  }

  /* Theme colours belong to the look, so clear any old ones when the look changes. */
  var THEME_KEYS = ['background', 'textColor', 'palette', 'fxDepth', 'oceanColor', 'noDataColor', 'landColor', 'mapLow', 'mapHigh', 'headerColor'];
  var LOOK_KEYS = ['look', 'fxIntensity', 'lightSpeed', 'fxParticles'];
  function applyLook(name) {
    project.settings.look = name;
    THEME_KEYS.forEach(function (k) { delete project.settings[k]; });
    $('lookSel').value = name;
    renderSettings(); changed();
  }

  function field(d, value) {
    var wrap = document.createElement('div');
    wrap.className = 'field' + (d.type === 'checkbox' ? ' check' : '');
    var id = 'set_' + d.key;
    var set = function (v) { if (d.key === 'look') { applyLook(v); return; } project.settings[d.key] = v; changed(); };
    if (d.type === 'checkbox') {
      wrap.innerHTML = '<label><input type="checkbox" id="' + id + '"> ' + d.label + '</label>';
      var cb = wrap.querySelector('input'); cb.checked = !!value;
      cb.onchange = function () { set(cb.checked); };
      return wrap;
    }
    var label = '<label for="' + id + '">' + d.label + (d.type === 'range' ? '<span class="val"></span>' : '') + '</label>';
    var input;
    if (d.type === 'image') {
      wrap.innerHTML = label + '<select id="' + id + '"></select>';
      input = wrap.querySelector('select');
      var opts = [['', 'None']].concat(Object.keys(project.images || {}).map(function (n) { return [n, n]; })).concat([['__upload', 'Upload an image…']]);
      opts.forEach(function (o) { var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; input.appendChild(op); });
      input.value = value && (project.images || {})[value] ? value : '';
      input.onchange = function () {
        if (input.value !== '__upload') { set(input.value); return; }
        input.value = value || '';
        pickImages(function (names) { if (names.length) { project.settings[d.key] = names[0]; renderSettings(); changed(); } });
      };
      return wrap;
    }
    if (d.type === 'textarea') { wrap.innerHTML = label + '<textarea id="' + id + '" rows="2"></textarea>'; input = wrap.querySelector('textarea'); input.value = value || ''; input.oninput = function () { set(input.value); }; }
    else if (d.type === 'select') {
      wrap.innerHTML = label + '<select id="' + id + '"></select>';
      input = wrap.querySelector('select');
      d.options.forEach(function (o) { var op = document.createElement('option'); op.value = o; op.textContent = o.charAt(0).toUpperCase() + o.slice(1); input.appendChild(op); });
      input.value = value; input.onchange = function () { set(input.value); };
    } else if (d.type === 'color') {
      wrap.innerHTML = label + '<div class="colorRow"><input type="color" id="' + id + '"><input type="text" spellcheck="false"></div>';
      var col = wrap.querySelector('input[type=color]'), txt = wrap.querySelector('input[type=text]');
      col.value = value; txt.value = value;
      col.oninput = function () { txt.value = col.value; set(col.value); };
      txt.onchange = function () { if (/^#[0-9a-f]{6}$/i.test(txt.value)) { col.value = txt.value; set(txt.value); } };
    } else if (d.type === 'number' || d.type === 'range') {
      wrap.innerHTML = label + '<input type="' + d.type + '" id="' + id + '">';
      input = wrap.querySelector('input');
      ['min', 'max', 'step'].forEach(function (k) { if (d[k] != null) input[k] = d[k]; });
      input.value = value;
      var val = wrap.querySelector('.val');
      if (val) val.textContent = value;
      input.oninput = function () {
        var n = parseFloat(input.value); if (!isFinite(n)) return;
        if (val) val.textContent = n;
        set(n);
        if (d.key === 'duration' || d.key === 'hold') player.seek(player.time());
      };
    } else {
      wrap.innerHTML = label + '<input type="text" id="' + id + '">';
      input = wrap.querySelector('input'); input.value = value || '';
      input.oninput = function () { set(input.value); };
    }
    return wrap;
  }

  /* ---------------- Data grid ---------------- */
  function renderGrid() {
    $('dataHint').textContent = Infographic.TEMPLATES[project.template].dataHint;
    var T = project.data;
    var rows = T.length, cols = T.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    var html = [];
    for (var r = 0; r < rows; r++) {
      html.push('<tr' + (r === 0 ? ' class="head"' : '') + '><th class="rn">' + (r === 0 ? '' : r) + '</th>');
      for (var c = 0; c < cols; c++) {
        var v = T[r][c] == null ? '' : String(T[r][c]);
        html.push('<td><input data-r="' + r + '" data-c="' + c + '" value="' + v.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"></td>');
      }
      html.push('</tr>');
    }
    $('grid').innerHTML = html.join('');
  }

  function cellInput(e) {
    var el = e.target; if (!el.dataset || el.dataset.r == null) return;
    var r = +el.dataset.r, c = +el.dataset.c;
    while (project.data[r].length <= c) project.data[r].push('');
    project.data[r][c] = el.value;
    changed({ data: true });
  }

  function cellPaste(e) {
    var el = e.target; if (!el.dataset || el.dataset.r == null) return;
    var text = (e.clipboardData || window.clipboardData).getData('text');
    if (!/[\t\n]/.test(text)) return; // single value, let the browser handle it
    e.preventDefault();
    var block = InfographicCSV.parse(text, text.indexOf('\t') >= 0 ? '\t' : undefined);
    var r0 = +el.dataset.r, c0 = +el.dataset.c;
    block.forEach(function (row, i) {
      var r = r0 + i;
      while (project.data.length <= r) project.data.push([]);
      row.forEach(function (v, j) { project.data[r][c0 + j] = v; });
    });
    normalise();
    renderGrid(); changed({ data: true });
    toast('Pasted ' + block.length + ' rows');
  }

  function normalise() {
    var w = project.data.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    project.data.forEach(function (r) { for (var i = 0; i < w; i++) if (r[i] == null) r[i] = ''; });
  }

  function setData(rows, msg) {
    if (!rows.length) { toast('No data found'); return; }
    project.data = rows; normalise(); renderGrid(); changed({ data: true });
    toast(msg || ('Loaded ' + (rows.length - 1) + ' rows × ' + rows[0].length + ' columns'));
  }

  /* ---------------- Preview ---------------- */
  function fitCanvas() {
    var wrap = $('canvasWrap'), c = $('preview');
    var aw = wrap.clientWidth - 48, ah = wrap.clientHeight - 48;
    if (aw <= 0 || ah <= 0) return;
    var w = project.size.w, h = project.size.h;
    var cssW = Math.min(aw, ah * w / h);
    c.style.width = Math.floor(cssW) + 'px';
    c.style.height = Math.floor(cssW * h / w) + 'px';
    player.render();
  }

  /* ---------------- Exports ---------------- */
  function exportHtmlDialog() {
    modal('Export standalone HTML',
      '<div class="opt"><span>Play automatically when scrolled into view</span><input type="checkbox" id="xAuto" checked></div>' +
      '<div class="opt"><span>Loop</span><input type="checkbox" id="xLoop"></div>' +
      '<div class="opt"><span>Show play / timeline controls on hover</span><input type="checkbox" id="xCtl" checked></div>' +
      '<p class="note">Creates one self-contained .html file with no external dependencies. Open it in any browser, host it anywhere, or embed it with an &lt;iframe&gt;.</p>',
      [{ label: 'Cancel', cls: 'ghost', onClick: function () {} },
       { label: 'Download HTML', cls: 'primary', onClick: function () {
          InfographicExport.exportHTML(project, { autoplay: $('xAuto').checked, loop: $('xLoop').checked, controls: $('xCtl').checked });
          toast('HTML exported');
        } }]);
  }

  function exportMp4Dialog() {
    var total = Infographic.totalTime(project);
    var hasWebCodecs = 'VideoEncoder' in window;
    modal('Export MP4 video',
      '<div class="opt"><span>Resolution</span><b>' + project.size.w + ' × ' + project.size.h + '</b></div>' +
      '<div class="opt"><span>Length</span><b>' + total.toFixed(1) + ' s</b></div>' +
      '<div class="opt"><span>Frame rate</span><select id="xFps"><option value="30">30 fps</option><option value="60">60 fps</option><option value="25">25 fps (PAL)</option><option value="24">24 fps (film)</option></select></div>' +
      '<div class="opt"><span>Quality</span><select id="xQ"><option value="standard">Standard</option><option value="high">High (bigger file)</option></select></div>' +
      (hasWebCodecs ? '<p class="note">Frames are rendered one by one, so the video is perfectly smooth on any computer.</p>'
        : '<p class="note">This browser lacks WebCodecs, so the video will be recorded in real time (it may be WebM). For best results use Chrome, Edge or a recent Firefox / Safari.</p>'),
      [{ label: 'Cancel', cls: 'ghost', onClick: function () {} },
       { label: 'Render video', cls: 'primary', onClick: function () { runMp4(+$('xFps').value, $('xQ').value); return false; } }]);
  }

  async function runMp4(fps, quality) {
    var signal = { cancelled: false };
    modal('Rendering video…',
      '<div class="progress"><div id="xBar"></div></div><p class="note" id="xPct">Starting…</p>',
      [{ label: 'Cancel', cls: 'ghost', onClick: function () { signal.cancelled = true; } }]);
    player.pause();
    var t0 = performance.now();
    try {
      var snapshot = clone(project);
      var res = await InfographicExport.exportVideo(snapshot, {
        fps: fps, quality: quality, signal: signal,
        onProgress: function (f) {
          var bar = $('xBar'); if (bar) bar.style.width = (f * 100).toFixed(1) + '%';
          var pct = $('xPct'); if (pct) pct.textContent = Math.round(f * 100) + '%';
        }
      });
      closeModal();
      if (res === 'cancelled') { toast('Export cancelled'); return; }
      toast('Video exported (' + res.ext.toUpperCase() + ', ' + (res.size / 1048576).toFixed(1) + ' MB, ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s)', 4500);
    } catch (err) {
      console.error(err);
      modal('Video export failed', '<p>' + String(err && err.message || err) + '</p><p class="note">Try a smaller size, a lower frame rate, or a different browser.</p>',
        [{ label: 'OK', cls: 'primary', onClick: function () {} }]);
    }
  }

  /* ---------------- Files ---------------- */
  /* ---------------- Images ---------------- */
  var MAX_IMAGE = 1400;
  function addImageFiles(files, cb) {
    var list = Array.prototype.filter.call(files, function (f) { return /^image\//.test(f.type); });
    if (!list.length) { if (cb) cb([]); return; }
    Promise.all(list.map(function (f) {
      return new Promise(function (res) {
        var fr = new FileReader();
        fr.onload = function () {
          var src = String(fr.result);
          if (f.type === 'image/svg+xml' || f.type === 'image/gif') return res([f.name, src]);
          var img = new Image();
          img.onload = function () {
            var sc = Math.min(1, MAX_IMAGE / Math.max(img.naturalWidth, img.naturalHeight));
            if (sc === 1 && f.size < 600 * 1024) return res([f.name, src]);
            var c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(img.naturalWidth * sc)); c.height = Math.max(1, Math.round(img.naturalHeight * sc));
            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
            var keepAlpha = /png|webp/.test(f.type);
            res([f.name, c.toDataURL(keepAlpha ? 'image/png' : 'image/jpeg', 0.86)]);
          };
          img.onerror = function () { res(null); };
          img.src = src;
        };
        fr.onerror = function () { res(null); };
        fr.readAsDataURL(f);
      });
    })).then(function (pairs) {
      project.images = project.images || {};
      var names = [];
      pairs.forEach(function (p) { if (p) { project.images[p[0]] = p[1]; names.push(p[0]); } });
      renderImages(); renderSettings(); changed();
      Infographic.preloadImages(project).then(function () { player.render(); });
      toast(names.length === 1 ? 'Added image “' + names[0] + '”' : 'Added ' + names.length + ' images');
      if (cb) cb(names);
    });
  }

  var pickCb = null;
  function pickImages(cb) { pickCb = cb; $('fileImg').click(); }

  function renderImages() {
    var list = $('imageList'); if (!list) return;
    list.innerHTML = '';
    var imgs = project.images || {};
    Object.keys(imgs).forEach(function (name) {
      var el = document.createElement('div');
      el.className = 'imgItem'; el.title = 'Click to copy “' + name + '”';
      el.innerHTML = '<img alt=""><span></span><button class="del" title="Remove image">×</button>';
      el.querySelector('img').src = imgs[name];
      el.querySelector('span').textContent = name;
      el.onclick = function (e) {
        if (e.target.classList.contains('del')) return;
        var done = function () { toast('Copied “' + name + '”. Paste it into a cell.'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(name).then(done, done); else done();
      };
      el.querySelector('.del').onclick = function () {
        delete project.images[name];
        Object.keys(project.settings).forEach(function (k) { if (project.settings[k] === name) project.settings[k] = ''; });
        renderImages(); renderSettings(); changed();
      };
      list.appendChild(el);
    });
  }

  function readFile(file) {
    if (/^image\//.test(file.type)) { addImageFiles([file]); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result);
      if (/\.(json|bloom)$/i.test(file.name) || /^\s*\{/.test(text)) {
        try {
          var p = JSON.parse(text);
          if (!p.template || !p.data) throw new Error('Not a Infographic project');
          setProject(p); toast('Opened ' + file.name);
        } catch (e) { toast('Could not open: ' + e.message); }
      } else {
        setData(InfographicCSV.parse(text));
      }
    };
    reader.readAsText(file);
  }

  /* ---------------- Wiring ---------------- */
  function init() {
    player = Infographic.createPlayer($('preview'), function () { return project; }, {
      loop: function () { return $('loopChk').checked; },
      onTime: function (t, T) {
        if (!scrubbing) $('scrub').value = T ? t / T : 0;
        $('timeLbl').textContent = t.toFixed(1) + 's / ' + T.toFixed(1) + 's';
      },
      onState: function (playing) { $('btnPlay').textContent = playing ? '❚❚' : '▶'; }
    });

    var scrubbing = false;
    $('scrub').addEventListener('input', function () { scrubbing = true; player.pause(); player.seek(+this.value * Infographic.totalTime(project)); });
    $('scrub').addEventListener('change', function () { scrubbing = false; });
    $('btnPlay').onclick = function () { player.toggle(); };
    $('btnRestart').onclick = function () { player.seek(0); player.play(); };

    document.querySelectorAll('.tabs [data-tab]').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('.tabs [data-tab]').forEach(function (x) { x.classList.toggle('active', x === b); });
        $('pane-preview').hidden = b.dataset.tab !== 'preview';
        $('pane-data').hidden = b.dataset.tab !== 'data';
        if (b.dataset.tab === 'preview') fitCanvas(); else player.pause();
      };
    });

    $('tplSearch').oninput = function () { pickerState.q = this.value; renderTemplates(); };
    document.querySelectorAll('#tplFilter button').forEach(function (b) {
      b.onclick = function () {
        pickerState.filter = b.dataset.f;
        document.querySelectorAll('#tplFilter button').forEach(function (x) { x.classList.toggle('on', x === b); });
        renderTemplates();
      };
    });
    $('tplSort').onchange = function () { pickerState.sort = this.value; renderTemplates(); };

    var lightGroup = document.createElement('optgroup'), darkGroup = document.createElement('optgroup');
    lightGroup.label = 'Light'; darkGroup.label = 'Dark';
    Object.keys(Infographic.LOOKS).forEach(function (k) {
      var o = document.createElement('option'); o.value = k; o.textContent = k.charAt(0).toUpperCase() + k.slice(1);
      (k === 'classic' ? $('lookSel') : Infographic.LOOKS[k].dark ? darkGroup : lightGroup).appendChild(o);
    });
    $('lookSel').appendChild(lightGroup); $('lookSel').appendChild(darkGroup);
    $('lookSel').onchange = function () { applyLook(this.value); };

    $('sizeSel').onchange = function () {
      var s = SIZES.find(function (x) { return x.id === $('sizeSel').value; });
      if (s.id === 'custom') { $('customSize').hidden = false; return; }
      $('customSize').hidden = true; setSize(s.w, s.h);
    };
    $('cw').onchange = $('ch').onchange = function () { setSize(+$('cw').value, +$('ch').value); };

    $('projName').oninput = function () { project.name = this.value; autosave(); };

    $('btnNew').onclick = function () {
      modal('New project', '<p>Start a new project from a template? Your current project is not saved to a file unless you choose “Save project” first.</p>',
        [{ label: 'Cancel', cls: 'ghost', onClick: function () {} },
         { label: 'Start new', cls: 'primary', onClick: function () { var s = InfographicSamples[project.template](); s.isSample = true; s.name = 'Untitled project'; setProject(s); } }]);
    };
    $('btnOpen').onclick = function () { $('fileOpen').click(); };
    $('fileOpen').onchange = function () { if (this.files[0]) readFile(this.files[0]); this.value = ''; };
    $('btnSave').onclick = function () {
      var p = clone(project); delete p.isSample; p.appVersion = Infographic.version;
      InfographicExport.download(new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' }), InfographicExport.slug(project.name) + '.infographic.json');
      toast('Project saved');
    };
    $('btnPng').onclick = function () { InfographicExport.exportPNG(project, player.time() > 0 ? player.time() : null).then(function () { toast('PNG of the current frame exported'); }); };
    $('btnHtml').onclick = exportHtmlDialog;
    $('btnMp4').onclick = exportMp4Dialog;

    // Data tools
    var grid = $('grid');
    grid.addEventListener('input', cellInput);
    grid.addEventListener('paste', cellPaste);
    grid.addEventListener('focusin', function (e) { if (e.target.dataset.r != null) focusCell = { r: +e.target.dataset.r, c: +e.target.dataset.c }; });
    grid.addEventListener('keydown', function (e) {
      var el = e.target; if (el.dataset.r == null) return;
      var r = +el.dataset.r, c = +el.dataset.c, nr = r, nc = c;
      if (e.key === 'Enter' || e.key === 'ArrowDown') nr = r + (e.shiftKey && e.key === 'Enter' ? -1 : 1);
      else if (e.key === 'ArrowUp') nr = r - 1;
      else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length) nc = c + 1;
      else if (e.key === 'ArrowLeft' && el.selectionStart === 0) nc = c - 1;
      else return;
      var next = grid.querySelector('input[data-r="' + nr + '"][data-c="' + nc + '"]');
      if (next) { e.preventDefault(); next.focus(); next.select(); }
    });
    $('imgAdd').onclick = function () { pickImages(null); };
    $('fileImg').onchange = function () { var cb = pickCb; pickCb = null; addImageFiles(this.files, cb); this.value = ''; };
    $('dImport').onclick = function () { $('fileCsv').click(); };
    $('fileCsv').onchange = function () { if (this.files[0]) readFile(this.files[0]); this.value = ''; };
    $('dPaste').onclick = function () {
      modal('Paste data', '<textarea id="pasteBox" placeholder="Paste from Excel, Google Sheets or a CSV file. The first row should be the column headers."></textarea>',
        [{ label: 'Cancel', cls: 'ghost', onClick: function () {} },
         { label: 'Use this data', cls: 'primary', onClick: function () { setData(InfographicCSV.parse($('pasteBox').value)); } }]);
      setTimeout(function () { $('pasteBox').focus(); }, 30);
    };
    $('dExport').onclick = function () { InfographicExport.download(new Blob([InfographicCSV.stringify(project.data)], { type: 'text/csv' }), InfographicExport.slug(project.name) + '.csv'); };
    $('dAddRow').onclick = function () { var w = project.data[0].length; project.data.splice(focusCell.r + 1, 0, new Array(w).fill('')); renderGrid(); changed({ data: true }); };
    $('dAddCol').onclick = function () { project.data.forEach(function (r, i) { r.splice(focusCell.c + 1, 0, i === 0 ? 'New column' : ''); }); renderGrid(); changed({ data: true }); };
    $('dDelRow').onclick = function () { if (project.data.length > 1 && focusCell.r > 0) { project.data.splice(focusCell.r, 1); focusCell.r = Math.min(focusCell.r, project.data.length - 1); renderGrid(); changed({ data: true }); } else toast('Click a cell in the row you want to remove'); };
    $('dDelCol').onclick = function () { if (project.data[0].length > 1) { project.data.forEach(function (r) { r.splice(focusCell.c, 1); }); focusCell.c = Math.max(0, focusCell.c - 1); renderGrid(); changed({ data: true }); } };
    $('dTranspose').onclick = function () {
      var T = project.data, out = [];
      for (var c = 0; c < T[0].length; c++) out.push(T.map(function (r) { return r[c]; }));
      setData(out, 'Transposed');
    };
    $('dSample').onclick = function () { var s = InfographicSamples[project.template](); project.data = s.data; project.isSample = true; renderGrid(); changed(); toast('Sample data loaded'); };

    // Drag & drop
    var depth = 0;
    window.addEventListener('dragenter', function (e) { e.preventDefault(); depth++; document.body.classList.add('dragging'); });
    window.addEventListener('dragleave', function () { if (--depth <= 0) { depth = 0; document.body.classList.remove('dragging'); } });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) {
      e.preventDefault(); depth = 0; document.body.classList.remove('dragging');
      var fs = e.dataTransfer.files || [];
      var imgs = Array.prototype.filter.call(fs, function (f) { return /^image\//.test(f.type); });
      if (imgs.length) addImageFiles(imgs);
      Array.prototype.forEach.call(fs, function (f) { if (!/^image\//.test(f.type)) readFile(f); });
    });

    // Keyboard: space toggles play when not typing
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('modal').hidden) closeModal();
      if (e.code === 'Space' && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(document.activeElement.tagName) && $('modal').hidden) { e.preventDefault(); player.toggle(); }
    });

    new ResizeObserver(fitCanvas).observe($('canvasWrap'));
    setProject(loadInitial());
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { player.render(); });
  }

  init();
})();
