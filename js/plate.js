// plate.js: Plate 1 on the homepage. A Gray-Scott reaction-diffusion field
// seeded with the yepgent sprout. WebGPU compute when available, a smaller
// Canvas 2D simulation on the CPU otherwise. It pauses while the plate is off
// screen or the tab is hidden, and with reduced motion it runs only briefly
// after each interaction.

(function () {
  'use strict';
  var frame = document.getElementById('plate');
  var canvas = document.getElementById('rd');
  if (!frame || !canvas) return;

  var W = 480, H = 360;
  var gw = W, gh = H;   // grid the running engine actually simulates
  var stepsEl = document.getElementById('steps');
  var fkEl = document.getElementById('fk');
  var engineEl = document.getElementById('rd-engine');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var F = 0.0545, K = 0.062, steps = 0, brush = null;
  var budget = reduce ? 90 : Infinity;   // frames left to run under reduced motion
  var visible = true, loopFn = null, running = false, reseed = function () {};

  function seedField(w, h) {
    var field = new Float32Array(w * h * 2);
    for (var i = 0; i < w * h; i++) { field[i * 2] = 1; field[i * 2 + 1] = 0; }
    var oc = document.createElement('canvas'); oc.width = w; oc.height = h;
    var g = oc.getContext('2d');
    var sc = (h * 0.5) / 110;
    g.translate(w * 0.5 - 103 * sc, h * 0.8 - 178 * sc); g.scale(sc, sc);
    g.strokeStyle = '#000'; g.fillStyle = '#000'; g.lineCap = 'round'; g.lineWidth = 9;
    g.stroke(new Path2D('M100 178 C 100 150, 100 130, 100 92'));
    g.fill(new Path2D('M100 125 C 75 120, 60 110, 55 95 C 70 93, 90 107, 100 125 Z'));
    g.fill(new Path2D('M100 110 C 125 107, 145 95, 152 75 C 135 73, 112 90, 100 110 Z'));
    var px = g.getImageData(0, 0, w, h).data;
    for (var j = 0; j < w * h; j++) {
      if (px[j * 4 + 3] > 100) { field[j * 2] = 0.3 + Math.random() * 0.05; field[j * 2 + 1] = 0.45 + Math.random() * 0.1; }
    }
    return field;
  }

  function themeColors() {
    var cs = getComputedStyle(document.documentElement);
    var hex = function (v) { v = v.trim().replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(v.slice(i, i + 2), 16) / 255; }); };
    var t = document.documentElement.getAttribute('data-theme');
    var dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    return { paper: hex(cs.getPropertyValue('--sheet')), ink: hex(cs.getPropertyValue('--specimen')), deep: hex(cs.getPropertyValue('--ink')), dark: dark };
  }
  var colors = themeColors();

  function kick(frames) {
    if (reduce && frames) budget = Math.max(budget, frames);
    if (!running && loopFn && visible) { running = true; requestAnimationFrame(loopFn); }
  }
  function shouldStop() { return !visible || (reduce && --budget <= 0); }

  window.addEventListener('themechange', function () { colors = themeColors(); kick(2); });

  function gridPos(e) { var r = frame.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; }
  frame.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    brush = gridPos(e);
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') { frame.setPointerCapture(e.pointerId); frame.classList.add('drawing'); }
    kick(120);
  });
  frame.addEventListener('pointermove', function (e) { if (brush) brush = gridPos(e); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (t) {
    frame.addEventListener(t, function () { brush = null; frame.classList.remove('drawing'); });
  });

  var presets = document.querySelectorAll('.controls button[data-f]');
  presets.forEach(function (b) {
    b.addEventListener('click', function () {
      presets.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      F = +b.getAttribute('data-f'); K = +b.getAttribute('data-k');
      fmt(); kick(240);
    });
  });
  var resetBtn = document.getElementById('reset');
  if (resetBtn) resetBtn.addEventListener('click', function () { reseed(); steps = 0; fmt(); kick(90); });

  function fmt() {
    if (fkEl) fkEl.textContent = 'f ' + F.toFixed(4) + ' · k ' + K.toFixed(4) + ' · ' + gw + '×' + gh + ' cells';
    if (stepsEl) stepsEl.textContent = 'step ' + steps.toLocaleString('en-US');
  }

  // Pause off screen and in background tabs.
  var onScreen = true;
  function update() { visible = onScreen && !document.hidden; if (visible) kick(); }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; update(); }).observe(frame);
  }
  document.addEventListener('visibilitychange', update);

  gpu().catch(function (e) { console.warn('Plate 1: WebGPU unavailable, using the CPU.', e); return false; })
    .then(function (ok) { if (!ok) cpu(); fmt(); kick(); });

  function gpu() {
    if (!navigator.gpu) return Promise.resolve(false);
    return navigator.gpu.requestAdapter().then(function (adapter) {
      if (!adapter) return false;
      return adapter.requestDevice().then(function (device) { return setupGPU(device); });
    });
  }

  function setupGPU(device) {
    var ctx = canvas.getContext('webgpu');
    if (!ctx) return false;
    var format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device: device, format: format, alphaMode: 'opaque' });
    var S = 'struct U { size: vec2f, view: vec2f, f: f32, k: f32, du: f32, dv: f32, brush: vec4f, paper: vec4f, ink: vec4f, deep: vec4f, };';
    var stepCode = S + [
      '@group(0) @binding(0) var<uniform> u: U;',
      '@group(0) @binding(1) var<storage, read> src: array<vec2f>;',
      '@group(0) @binding(2) var<storage, read_write> dst: array<vec2f>;',
      'fn at(x: i32, y: i32) -> vec2f {',
      '  let w = i32(u.size.x); let h = i32(u.size.y);',
      '  return src[((y + h) % h) * w + ((x + w) % w)];',
      '}',
      '@compute @workgroup_size(8, 8) fn main(@builtin(global_invocation_id) id: vec3u) {',
      '  let w = u32(u.size.x); let h = u32(u.size.y);',
      '  if (id.x >= w || id.y >= h) { return; }',
      '  let x = i32(id.x); let y = i32(id.y);',
      '  let c = at(x, y);',
      '  let lap = (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1)) * 0.2',
      '          + (at(x - 1, y - 1) + at(x + 1, y - 1) + at(x - 1, y + 1) + at(x + 1, y + 1)) * 0.05 - c;',
      '  let r = c.x * c.y * c.y;',
      '  var a = c.x + u.du * lap.x - r + u.f * (1.0 - c.x);',
      '  var b = c.y + u.dv * lap.y + r - (u.f + u.k) * c.y;',
      '  if (u.brush.w > 0.5 && distance(vec2f(f32(x), f32(y)), u.brush.xy) < u.brush.z) { a = 0.3; b = 0.5; }',
      '  dst[id.y * w + id.x] = clamp(vec2f(a, b), vec2f(0.0), vec2f(1.0));',
      '}'
    ].join('\n');
    var drawCode = S + [
      '@group(0) @binding(0) var<uniform> u: U;',
      '@group(0) @binding(1) var<storage, read> g: array<vec2f>;',
      'fn v(p: vec2f) -> f32 {',
      '  let w = i32(u.size.x); let h = i32(u.size.y);',
      '  let q = p - vec2f(0.5); let i0 = vec2i(floor(q)); let t = fract(q);',
      '  let x0 = clamp(i0.x, 0, w - 1); let x1 = clamp(i0.x + 1, 0, w - 1);',
      '  let y0 = clamp(i0.y, 0, h - 1); let y1 = clamp(i0.y + 1, 0, h - 1);',
      '  return mix(mix(g[y0 * w + x0].y, g[y0 * w + x1].y, t.x), mix(g[y1 * w + x0].y, g[y1 * w + x1].y, t.x), t.y);',
      '}',
      '@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {',
      '  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));',
      '  return vec4f(p[i], 0.0, 1.0);',
      '}',
      '@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {',
      '  let p = fc.xy / u.view * u.size;',
      '  let c = v(p);',
      '  let gx = v(p + vec2f(0.75, 0.0)) - v(p - vec2f(0.75, 0.0));',
      '  let gy = v(p + vec2f(0.0, 0.75)) - v(p - vec2f(0.0, 0.75));',
      '  let n = normalize(vec3f(-gx * 4.0, -gy * 4.0, 1.0));',
      '  let lit = dot(n, normalize(vec3f(-0.45, -0.55, 0.7)));',
      '  let body = smoothstep(0.14, 0.34, c);',
      '  let rim = smoothstep(0.08, 0.16, c) * (1.0 - smoothstep(0.2, 0.32, c));',
      '  var col: vec3f;',
      '  if (u.paper.w > 0.5) {',
      '    col = mix(u.paper.rgb, u.ink.rgb, body) * (0.82 + 0.28 * lit);',
      '    col += u.ink.rgb * rim * 0.9 + vec3f(0.6, 1.0, 0.8) * pow(max(lit, 0.0), 12.0) * body * 0.35;',
      '  } else {',
      '    col = mix(u.paper.rgb, u.ink.rgb * (0.75 + 0.35 * lit), body);',
      '    col = mix(col, u.deep.rgb, rim * 0.55);',
      '    col += vec3f(1.0) * pow(max(lit, 0.0), 16.0) * body * 0.25;',
      '  }',
      '  return vec4f(col, 1.0);',
      '}'
    ].join('\n');

    device.pushErrorScope('validation');
    var ub = device.createBuffer({ size: 96, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    var bufs = [0, 1].map(function () { return device.createBuffer({ size: W * H * 8, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }); });
    var stepP = device.createComputePipeline({ layout: 'auto', compute: { module: device.createShaderModule({ code: stepCode }), entryPoint: 'main' } });
    var dm = device.createShaderModule({ code: drawCode });
    var drawP = device.createRenderPipeline({ layout: 'auto', vertex: { module: dm, entryPoint: 'vs' }, fragment: { module: dm, entryPoint: 'fs', targets: [{ format: format }] } });
    var stepBG = [0, 1].map(function (i) {
      return device.createBindGroup({ layout: stepP.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ub } }, { binding: 1, resource: { buffer: bufs[i] } }, { binding: 2, resource: { buffer: bufs[1 - i] } }] });
    });
    var drawBG = [0, 1].map(function (i) {
      return device.createBindGroup({ layout: drawP.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ub } }, { binding: 1, resource: { buffer: bufs[i] } }] });
    });
    return device.popErrorScope().then(function (err) {
      if (err) { console.warn('Plate 1: WebGPU setup error:', err.message); return false; }
      var cur = 0;
      reseed = function () { var f = seedField(W, H); device.queue.writeBuffer(bufs[0], 0, f); device.queue.writeBuffer(bufs[1], 0, f); cur = 0; };
      reseed();
      if (engineEl) engineEl.textContent = 'WebGPU compute · 600 steps a second';
      device.lost.then(function (info) { console.warn('Plate 1: GPU device lost:', info.message); loopFn = null; });
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var u = new Float32Array(24);
      var last = performance.now(), debt = 0;
      loopFn = function draw() {
        if (!loopFn) { running = false; return; }
        var cw = Math.max(1, Math.round(canvas.clientWidth * dpr)), ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
        var now = performance.now(); debt += Math.min(now - last, 100) * 0.6; last = now;
        var per = reduce ? 24 : Math.min(48, Math.floor(debt)); debt -= per;
        u.set([W, H, cw, ch, F, K, 1.0, 0.5, brush ? brush[0] : 0, brush ? brush[1] : 0, 7, brush ? 1 : 0,
          colors.paper[0], colors.paper[1], colors.paper[2], colors.dark ? 0 : 1,
          colors.ink[0], colors.ink[1], colors.ink[2], 1,
          colors.deep[0], colors.deep[1], colors.deep[2], 1]);
        device.queue.writeBuffer(ub, 0, u);
        var enc = device.createCommandEncoder();
        var cp = enc.beginComputePass(); cp.setPipeline(stepP);
        for (var i = 0; i < per; i++) { cp.setBindGroup(0, stepBG[cur]); cp.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8)); cur = 1 - cur; }
        cp.end();
        var rp = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', clearValue: [1, 1, 1, 1], storeOp: 'store' }] });
        rp.setPipeline(drawP); rp.setBindGroup(0, drawBG[cur]); rp.draw(3); rp.end();
        device.queue.submit([enc.finish()]);
        steps += per; fmt();
        if (shouldStop()) { running = false; last = performance.now(); debt = 0; return; }
        requestAnimationFrame(draw);
      };
      return true;
    });
  }

  function cpu() {
    var w = 160, h = 120, sx = W / w;
    gw = w; gh = h;
    var c2 = canvas.getContext('2d');
    var img = new ImageData(w, h);
    var oc = document.createElement('canvas'); oc.width = w; oc.height = h;
    var og = oc.getContext('2d');
    var A = seedField(w, h), B = new Float32Array(A.length);
    reseed = function () { A = seedField(w, h); };
    if (engineEl) engineEl.textContent = 'Canvas 2D on the CPU (no WebGPU in this browser)';
    var NB = [[0, -1, 0.2], [0, 1, 0.2], [-1, 0, 0.2], [1, 0, 0.2], [-1, -1, 0.05], [-1, 1, 0.05], [1, -1, 0.05], [1, 1, 0.05]];
    var last = performance.now(), debt = 0;
    loopFn = function draw() {
      var now = performance.now(); debt += Math.min(now - last, 100) * 0.2; last = now;
      var per = reduce ? 6 : Math.min(10, Math.floor(debt)); debt -= per;
      for (var s = 0; s < per; s++) {
        for (var y = 0; y < h; y++) {
          for (var x = 0; x < w; x++) {
            var i = (y * w + x) * 2, la = -A[i], lb = -A[i + 1];
            for (var n = 0; n < 8; n++) {
              var yy = (y + NB[n][0] + h) % h, xx = (x + NB[n][1] + w) % w, j = (yy * w + xx) * 2;
              la += A[j] * NB[n][2]; lb += A[j + 1] * NB[n][2];
            }
            var a = A[i], b = A[i + 1], r = a * b * b;
            var na = a + la - r + F * (1 - a), nb = b + 0.5 * lb + r - (F + K) * b;
            if (brush && Math.hypot(x - brush[0] / sx, y - brush[1] / sx) < 3) { na = 0.3; nb = 0.5; }
            B[i] = Math.min(1, Math.max(0, na)); B[i + 1] = Math.min(1, Math.max(0, nb));
          }
        }
        var tmp = A; A = B; B = tmp;
      }
      var P = colors.paper.map(function (v) { return v * 255; }), I = colors.ink.map(function (v) { return v * 255; });
      for (var k = 0; k < w * h; k++) {
        var t = Math.min(1, Math.max(0, (A[k * 2 + 1] - 0.14) / 0.2));
        img.data[k * 4] = P[0] + (I[0] - P[0]) * t; img.data[k * 4 + 1] = P[1] + (I[1] - P[1]) * t; img.data[k * 4 + 2] = P[2] + (I[2] - P[2]) * t; img.data[k * 4 + 3] = 255;
      }
      og.putImageData(img, 0, 0);
      var cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      c2.imageSmoothingEnabled = true; c2.drawImage(oc, 0, 0, cw, ch);
      steps += per; fmt();
      if (shouldStop()) { running = false; last = performance.now(); debt = 0; return; }
      requestAnimationFrame(draw);
    };
  }
})();
