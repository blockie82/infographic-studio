/* Export to standalone HTML, MP4 video and PNG. */
window.InfographicExport = (function () {

  function download(blob, filename) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
  }

  function slug(s) {
    return (String(s || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chart').slice(0, 60);
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  /* ---------------- Standalone HTML ---------------- */
  /* Only embed images the project actually uses (in its data or settings). */
  function usedImages(project) {
    var imgs = project.images || {}, out = {}, names = Object.keys(imgs);
    if (!names.length) return undefined;
    var text = JSON.stringify([project.data, project.settings]).toLowerCase();
    names.forEach(function (n) {
      var k = n.toLowerCase(), base = k.replace(/\.[a-z0-9]+$/, '');
      if (text.indexOf(k) >= 0 || text.indexOf(base) >= 0) out[n] = imgs[n];
    });
    return out;
  }
  var MAP_TEMPLATES = { choropleth: 1, pointMap: 1 };
  function geoScript(project) {
    if (!MAP_TEMPLATES[project.template] || !window.InfographicGeo) return '';
    return '/* World outlines: Natural Earth (public domain) via world-atlas */\nvar InfographicGeo = ' + JSON.stringify(window.InfographicGeo) + ';\n';
  }
  function buildHTML(project, opts) {
    opts = opts || {};
    var S = Infographic.resolveSettings(project);
    var json = JSON.stringify({ template: project.template, size: project.size, data: project.data, settings: project.settings, images: usedImages(project) })
      .replace(/</g, '\\u003c').replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029');
    var title = escHtml(S.title || project.name || 'Chart');
    var ratio = (project.size.h / project.size.w * 100).toFixed(4);
    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
      '<title>' + title + '</title>\n' +
      '<style>\n' +
      'html,body{margin:0;padding:0;background:' + S.background + ';}\n' +
      '.istudio{max-width:' + (opts.maxWidth || project.size.w) + 'px;margin:0 auto;position:relative;font-family:system-ui,sans-serif;}\n' +
      '.istudio canvas{display:block;width:100%;height:auto;aspect-ratio:' + project.size.w + '/' + project.size.h + ';}\n' +
      '.istudio .ctl{display:flex;align-items:center;gap:10px;padding:8px 12px;opacity:.0;transition:opacity .2s;position:absolute;left:0;right:0;bottom:0;background:linear-gradient(transparent,rgba(0,0,0,.35));}\n' +
      '.istudio:hover .ctl,.istudio .ctl:focus-within{opacity:1}\n' +
      '.istudio button{border:0;border-radius:999px;width:34px;height:34px;background:rgba(255,255,255,.92);color:#111;font-size:14px;cursor:pointer;}\n' +
      '.istudio input[type=range]{flex:1;accent-color:#fff;}\n' +
      '</style>\n</head>\n<body>\n' +
      '<div class="istudio" style="--ratio:' + ratio + '%">\n' +
      '  <canvas role="img" aria-label="' + title + '"></canvas>\n' +
      (opts.controls === false ? '' :
        '  <div class="ctl"><button type="button" aria-label="Play or pause">&#9654;</button><input type="range" min="0" max="1" step="0.001" value="0" aria-label="Timeline"></div>\n') +
      '</div>\n' +
      '<script>\n' + geoScript(project) + '/* Infographic Studio runtime v' + Infographic.version + ' */\nvar Infographic = (' + InfographicRuntime.toString() + ')();\n' +
      'var PROJECT = ' + json + ';\n' +
      '(function(){\n' +
      '  var root = document.querySelector(".istudio"), canvas = root.querySelector("canvas");\n' +
      '  var btn = root.querySelector("button"), scrub = root.querySelector("input");\n' +
      '  var loop = ' + (opts.loop ? 'true' : 'false') + ';\n' +
      '  var player = Infographic.createPlayer(canvas, function(){ return PROJECT; }, {\n' +
      '    loop: function(){ return loop; },\n' +
      '    onTime: function(t, T){ if (scrub && !scrub.dragging) scrub.value = T ? t / T : 0; },\n' +
      '    onState: function(p){ if (btn) btn.innerHTML = p ? "&#10074;&#10074;" : "&#9654;"; }\n' +
      '  });\n' +
      '  player.render();\n' +
      '  Infographic.preloadImages(PROJECT).then(function(){ player.render(); });\n' +
      '  if (btn) btn.onclick = function(){ player.toggle(); };\n' +
      '  if (scrub) {\n' +
      '    scrub.oninput = function(){ scrub.dragging = true; player.pause(); player.seek(scrub.value * Infographic.totalTime(PROJECT)); };\n' +
      '    scrub.onchange = function(){ scrub.dragging = false; };\n' +
      '  }\n' +
      '  var started = false;\n' +
      '  function start(){ if (!started) { started = true; player.play(); } }\n' +
      (opts.autoplay === false ? '' :
        '  if ("IntersectionObserver" in window) new IntersectionObserver(function(es){ es.forEach(function(e){ if (e.isIntersecting) start(); }); }, {threshold: 0.4}).observe(canvas); else start();\n') +
      '  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ player.render(); });\n' +
      '})();\n' +
      '</script>\n</body>\n</html>\n';
  }

  function exportHTML(project, opts) {
    var html = buildHTML(project, opts);
    download(new Blob([html], { type: 'text/html' }), slug(project.name) + '.html');
  }

  /* ---------------- PNG ---------------- */
  function exportPNG(project, t) {
    return Infographic.preloadImages(project).then(function () {
      var c = document.createElement('canvas');
      c.width = project.size.w; c.height = project.size.h;
      Infographic.draw(c.getContext('2d'), c.width, c.height, project, t == null ? Infographic.totalTime(project) : t);
      c.toBlob(function (b) { download(b, slug(project.name) + '.png'); }, 'image/png');
    });
  }

  /* ---------------- MP4 ---------------- */
  var AVC_CODECS = ['avc1.640034', 'avc1.640033', 'avc1.640028', 'avc1.4d0034', 'avc1.4d0028', 'avc1.42e034', 'avc1.42e028', 'avc1.42001f'];

  async function pickCodec(w, h, fps, bitrate) {
    if (!('VideoEncoder' in window)) return null;
    for (var i = 0; i < AVC_CODECS.length; i++) {
      var cfg = { codec: AVC_CODECS[i], width: w, height: h, bitrate: bitrate, framerate: fps, avc: { format: 'avc' } };
      try {
        var r = await VideoEncoder.isConfigSupported(cfg);
        if (r.supported) return cfg;
      } catch (e) { /* try next */ }
    }
    return null;
  }

  /*
   * Renders every frame offline (not in real time) and encodes with
   * WebCodecs, so the video is frame-perfect regardless of machine speed.
   * opts: { fps, quality: 'standard'|'high', onProgress(fraction), signal: {cancelled} }
   */
  async function renderMP4(project, opts) {
    opts = opts || {};
    var fps = opts.fps || 30;
    var w = project.size.w & ~1, h = project.size.h & ~1;
    var bpp = opts.quality === 'high' ? 0.2 : 0.11;
    var bitrate = Math.round(Math.min(60e6, Math.max(2e6, w * h * fps * bpp)));
    var cfg = await pickCodec(w, h, fps, bitrate);
    if (!cfg) return null; // caller falls back

    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext('2d', { alpha: false });

    var muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: 'avc', width: w, height: h, frameRate: fps },
      fastStart: 'in-memory'
    });
    var failure = null;
    var encoder = new VideoEncoder({
      output: function (chunk, meta) { muxer.addVideoChunk(chunk, meta); },
      error: function (e) { failure = e; }
    });
    encoder.configure(cfg);

    var total = Infographic.totalTime(project);
    var frames = Math.max(1, Math.ceil(total * fps));
    var frameDur = 1e6 / fps;
    for (var i = 0; i < frames; i++) {
      if (failure) throw failure;
      if (opts.signal && opts.signal.cancelled) { try { encoder.close(); } catch (e) {} return 'cancelled'; }
      Infographic.draw(ctx, w, h, project, i / fps);
      var frame = new VideoFrame(canvas, { timestamp: Math.round(i * frameDur), duration: Math.round(frameDur) });
      encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (encoder.encodeQueueSize > 8) await new Promise(function (r) { setTimeout(r, 4); });
      if (i % 5 === 0) {
        if (opts.onProgress) opts.onProgress(i / frames);
        await new Promise(function (r) { setTimeout(r, 0); });
      }
    }
    await encoder.flush();
    if (failure) throw failure;
    encoder.close();
    muxer.finalize();
    if (opts.onProgress) opts.onProgress(1);
    return new Blob([muxer.target.buffer], { type: 'video/mp4' });
  }

  /* Fallback for browsers without WebCodecs: record in real time. */
  async function recordRealtime(project, opts) {
    var fps = opts.fps || 30;
    var types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    var type = types.find(function (t) { return window.MediaRecorder && MediaRecorder.isTypeSupported(t); });
    if (!type) throw new Error('This browser cannot record video. Please use a recent Chrome, Edge, Firefox or Safari.');
    var canvas = document.createElement('canvas');
    canvas.width = project.size.w; canvas.height = project.size.h;
    var ctx = canvas.getContext('2d');
    var stream = canvas.captureStream(fps);
    var rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12e6 });
    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };
    var total = Infographic.totalTime(project);
    return new Promise(function (resolve) {
      rec.onstop = function () { resolve(new Blob(chunks, { type: type.split(';')[0] })); };
      rec.start(250);
      var t0 = performance.now();
      (function step() {
        var t = (performance.now() - t0) / 1000;
        Infographic.draw(ctx, canvas.width, canvas.height, project, Math.min(t, total));
        if (opts.onProgress) opts.onProgress(Math.min(1, t / total));
        if (opts.signal && opts.signal.cancelled) { rec.stop(); return; }
        if (t < total) requestAnimationFrame(step); else setTimeout(function () { rec.stop(); }, 200);
      })();
    });
  }

  async function exportVideo(project, opts) {
    await Infographic.preloadImages(project);
    var blob = await renderMP4(project, opts);
    if (blob === 'cancelled') return 'cancelled';
    var realtime = false;
    if (!blob) { realtime = true; blob = await recordRealtime(project, opts); }
    if (opts.signal && opts.signal.cancelled) return 'cancelled';
    var ext = blob.type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
    download(blob, slug(project.name) + '.' + ext);
    return { ext: ext, realtime: realtime, size: blob.size };
  }

  return { exportHTML: exportHTML, buildHTML: buildHTML, exportPNG: exportPNG, exportVideo: exportVideo, renderMP4: renderMP4, download: download, slug: slug };
})();
