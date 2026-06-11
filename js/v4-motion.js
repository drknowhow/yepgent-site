/* ============================================================
   v4.1 motion layer — all v4 pages (body.home-v4 family).

   Two independent enhancements, each optional at runtime:

   1. GSAP + ScrollTrigger (esm.sh):
      - homepage (detected by .v4-hero-stage) — full choreography:
        hero intro, scroll-scrubbed hero exit, velocity-reactive
        marquee, per-section entrances superseding the IO fallback.
      - subpages — a light hero intro + scrubbed aurora drift only;
        their own IO reveals keep owning the below-fold sections.
   2. Three.js (esm.sh) — a fixed "memory field": drifting
      particles + faint constellation lines behind the page;
      the camera dollies through the field as you scroll.

   Degradation contract (DESIGN.md):
   - prefers-reduced-motion → neither layer runs; the CSS/IO
     baseline owns the page and the canvas is removed.
   - CDN unreachable → the html.v4-motion failsafe in style.css
     reveals the hero after 1.8s; IO reveals keep working.
   - No WebGL → the GSAP layer still runs; canvas is removed.
   ============================================================ */

const docEl = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isHome = document.body.classList.contains('home-v4');
const canvas = document.getElementById('v4-canvas');

if (reduce || !isHome) {
  docEl.classList.remove('v4-motion');
  if (canvas) canvas.remove();
} else {
  initScroll().catch(() => docEl.classList.remove('v4-motion'));
  initField().catch(() => { if (canvas) canvas.remove(); });
}

/* ============================================================
   GSAP ScrollTrigger choreography
   ============================================================ */
async function initScroll() {
  let gsap, ScrollTrigger;
  try {
    const [g, s] = await Promise.all([
      import('https://esm.sh/gsap@3.13.0'),
      import('https://esm.sh/gsap@3.13.0/ScrollTrigger'),
    ]);
    gsap = g.gsap || g.default;
    ScrollTrigger = s.ScrollTrigger || s.default;
    gsap.registerPlugin(ScrollTrigger);
  } catch (err) {
    docEl.classList.remove('v4-motion');
    return;
  }

  const ease = 'power3.out';
  const homeStage = document.querySelector('.v4-hero-stage'); /* homepage marker */

  window.addEventListener('load', () => ScrollTrigger.refresh());

  /* ---- Subpages: staggered hero intro + scrubbed aurora drift.
     Their IO reveals keep owning the rest of the page, so no
     gsap-on takeover here. ---- */
  if (!homeStage) {
    docEl.classList.remove('v4-motion');
    const hero = document.querySelector('[class*="v4-hero"]');
    if (!hero) return;
    let targets = Array.from(hero.children).filter((el) => !el.classList.contains('aurora'));
    if (targets.length === 1 && targets[0].children.length > 1) {
      targets = Array.from(targets[0].children);
    }
    /* Skip elements the page hides by design (status/error panes its own
       JS reveals later) — a from() tween would pin them at opacity 0. */
    targets = targets.filter((el) => {
      const cs = getComputedStyle(el);
      return !el.hidden && cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
    });
    if (targets.length) {
      gsap.from(targets, { y: 26, autoAlpha: 0, duration: 0.9, ease, stagger: 0.09, delay: 0.08 });
    }
    const aurora = hero.querySelector('.aurora');
    if (aurora) {
      gsap.to(aurora, {
        yPercent: 12, scale: 1.05, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
      });
    }
    return;
  }

  /* GSAP now owns reveals + marquee — style.css neutralizes the CSS
     transitions/keyframes under body.gsap-on so they can't fight the
     inline styles GSAP writes every frame. */
  document.body.classList.add('gsap-on');
  docEl.classList.remove('v4-motion');

  /* ---- Hero intro ---- */
  gsap.timeline({ defaults: { ease, duration: 0.9 } })
    .from('.v4-announce',        { y: -16, autoAlpha: 0, duration: 0.7 }, 0.05)
    .from('.v4-eyebrow',         { y: 22, autoAlpha: 0 }, 0.2)
    .from('.v4-display',         { y: 44, autoAlpha: 0, duration: 1.1 }, 0.3)
    .from('.v4-lede',            { y: 26, autoAlpha: 0 }, 0.5)
    .from('.v4-cta-row .v4-cta', { y: 20, autoAlpha: 0, stagger: 0.09 }, 0.62)
    .from('.v4-hero-meta > div', { y: 16, autoAlpha: 0, stagger: 0.07, duration: 0.7 }, 0.78)
    .from('.v4-scroll-cue',      { autoAlpha: 0, duration: 0.6 }, 1.05);

  /* ---- Hero exit (scrubbed) — stage drifts up + dims, aurora sinks ---- */
  gsap.to('.v4-hero-stage', {
    yPercent: -9, autoAlpha: 0.25, ease: 'none',
    scrollTrigger: { trigger: '.v4-hero', start: 'top top', end: 'bottom 25%', scrub: true },
  });
  gsap.to('.v4-hero .aurora', {
    yPercent: 14, scale: 1.06, ease: 'none',
    scrollTrigger: { trigger: '.v4-hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  /* ---- Marquee — GSAP loop whose speed + skew react to scroll velocity ---- */
  const tracks = [];
  gsap.utils.toArray('.v4-marquee .mq-row').forEach((row) => {
    const track = row.querySelector('.mq-track');
    if (!track) return;
    const rev = row.classList.contains('mq-rev');
    if (rev) gsap.set(track, { xPercent: -50 });
    const loop = gsap.to(track, {
      xPercent: rev ? 0 : -50,
      duration: rev ? 44 : 36,
      ease: 'none',
      repeat: -1,
    });
    tracks.push({ loop, dir: rev ? -1 : 1, setSkew: gsap.quickSetter(track, 'skewX', 'deg') });
  });

  if (tracks.length) {
    let speed = 1, targetSpeed = 1, skew = 0, targetSkew = 0;
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate(self) {
        const v = self.getVelocity();
        targetSpeed = gsap.utils.clamp(1, 4.5, 1 + Math.abs(v) / 800);
        targetSkew = gsap.utils.clamp(-5, 5, v / 400);
      },
    });
    gsap.ticker.add(() => {
      speed += (targetSpeed - speed) * 0.06;
      targetSpeed += (1 - targetSpeed) * 0.035;   /* settle back to 1× */
      skew += (targetSkew - skew) * 0.1;
      targetSkew *= 0.9;                          /* settle back to 0° */
      tracks.forEach((t) => { t.loop.timeScale(speed); t.setSkew(skew * t.dir); });
    });
  }

  gsap.from('.v4-marquee', {
    autoAlpha: 0, y: 24, duration: 0.9, ease,
    scrollTrigger: { trigger: '.v4-marquee', start: 'top 92%', once: true },
  });

  /* ---- Section entrances (play once) ---- */
  const reveal = (targets, trigger, vars = {}) => gsap.from(targets, {
    y: 36, autoAlpha: 0, duration: 0.9, ease, stagger: 0.1,
    ...vars,
    scrollTrigger: { trigger, start: 'top 82%', once: true, ...(vars.scrollTrigger || {}) },
  });

  /* Capabilities — pinned column settles in, cards rise one by one */
  reveal(['.cap-pin .v4-kicker', '.cap-pin .v4-h2', '.cap-pin .v4-dek', '.cap-pin .v4-term'], '.v4-cap');
  gsap.utils.toArray('.cap-card').forEach((card) => {
    gsap.from(card, {
      y: 48, autoAlpha: 0, duration: 0.85, ease,
      scrollTrigger: { trigger: card, start: 'top 88%', once: true },
    });
  });

  /* Diptych — quote + prose, with a slow parallax on the big quote mark */
  reveal(['.dip-quote .v4-kicker', '.dip-quote blockquote'], '.v4-diptych');
  reveal(['.dip-prose .v4-h2', '.dip-prose p'], '.v4-diptych', { stagger: 0.08 });
  gsap.to('.dip-quote .quote-mark', {
    yPercent: 36, ease: 'none',
    scrollTrigger: { trigger: '.v4-diptych', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  /* API — head copy, then the code card lifts in */
  reveal(['.v4-api-head .v4-kicker', '.v4-api-head .v4-h2', '.v4-api-head .v4-dek'], '.v4-api');
  gsap.from('.api-card', {
    y: 44, autoAlpha: 0, scale: 0.985, duration: 1, ease,
    scrollTrigger: { trigger: '.api-card', start: 'top 86%', once: true },
  });

  /* Subscribe / privacy / colophon */
  gsap.from('.sub-card', {
    y: 40, autoAlpha: 0, scale: 0.975, duration: 1, ease,
    scrollTrigger: { trigger: '.v4-subscribe', start: 'top 82%', once: true },
  });
  reveal(['.priv-grid header', '.priv-cols p'], '.v4-privacy');
  reveal('.v4-colophon', '.v4-colophon', { y: 18 });
}

/* ============================================================
   Three.js memory field
   ============================================================ */
async function initField() {
  if (!canvas) return;
  const THREE = await import('https://esm.sh/three@0.170.0');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, powerPreference: 'low-power',
    });
  } catch (err) {
    canvas.remove();
    return;
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lightMq = window.matchMedia('(prefers-color-scheme: light)');
  const fineMq = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* Brand palettes (DESIGN.md tokens). Mostly dim neutrals with a green
     sprinkle so the accent stays well under the ≤12%-of-surface budget. */
  const PALETTES = {
    dark: {
      greens: [0x1db981, 0x2fd497, 0x7cf5c4],
      neutral: 0x4a5468,
      fog: 0x0e0f12,
      line: 0x1db981,
      pointOpacity: 0.8,
      lineOpacity: 0.1,
      blending: THREE.AdditiveBlending,
    },
    light: {
      greens: [0x0a8a5a, 0x0c7d54, 0x2aa97c],
      neutral: 0x9aa39e,
      fog: 0xfafafa,
      line: 0x0a8a5a,
      pointOpacity: 0.5,
      lineOpacity: 0.14,
      blending: THREE.NormalBlending,
    },
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 140);
  camera.position.set(0, 0, 46);

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.setSize(innerWidth, innerHeight, false);

  /* Soft round sprite for the particles */
  const sprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  /* Particle field — count scales with viewport area */
  const COUNT = Math.round(clamp((innerWidth * innerHeight) / 1600, 380, 1400));
  const SPREAD_X = 50, SPREAD_Y = 32, Z_MIN = -34, Z_MAX = 36;

  const base = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT);
  const speedArr = new Float32Array(COUNT);
  const amp = new Float32Array(COUNT);
  const isGreen = new Uint8Array(COUNT);
  const shade = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    base[i * 3] = (Math.random() - 0.5) * 2 * SPREAD_X;
    base[i * 3 + 1] = (Math.random() - 0.5) * 2 * SPREAD_Y;
    base[i * 3 + 2] = Z_MIN + Math.random() * (Z_MAX - Z_MIN);
    phase[i] = Math.random() * Math.PI * 2;
    speedArr[i] = 0.12 + Math.random() * 0.3;
    amp[i] = 0.5 + Math.random() * 1.3;
    isGreen[i] = Math.random() < 0.32 ? 1 : 0;
    shade[i] = 0.55 + Math.random() * 0.45;
  }

  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(new Float32Array(base), 3);
  posAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  const colAttr = new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3);
  geo.setAttribute('color', colAttr);

  const pointsMat = new THREE.PointsMaterial({
    size: 1.15,
    map: sprite,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, pointsMat);

  /* Constellation lines — static nearby pairs, endpoints follow the drift */
  const MAX_SEGS = 220, LINK_DIST = 8, SCAN = Math.min(COUNT, 500);
  const pairs = [];
  for (let a = 0; a < SCAN && pairs.length < MAX_SEGS; a++) {
    for (let b = a + 1; b < SCAN && pairs.length < MAX_SEGS; b++) {
      const dx = base[a * 3] - base[b * 3];
      const dy = base[a * 3 + 1] - base[b * 3 + 1];
      const dz = base[a * 3 + 2] - base[b * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < LINK_DIST * LINK_DIST) pairs.push(a, b);
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new THREE.BufferAttribute(new Float32Array(pairs.length * 3), 3);
  linePos.setUsage(THREE.DynamicDrawUsage);
  lineGeo.setAttribute('position', linePos);
  const lineMat = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
  const lines = new THREE.LineSegments(lineGeo, lineMat);

  const field = new THREE.Group();
  field.add(points, lines);
  scene.add(field);

  function applyTheme() {
    const p = lightMq.matches ? PALETTES.light : PALETTES.dark;
    const tmp = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      tmp.setHex(isGreen[i] ? p.greens[i % p.greens.length] : p.neutral);
      tmp.multiplyScalar(shade[i]);
      colAttr.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    colAttr.needsUpdate = true;
    pointsMat.opacity = p.pointOpacity;
    pointsMat.blending = p.blending;
    pointsMat.needsUpdate = true;
    lineMat.color.setHex(p.line);
    lineMat.opacity = p.lineOpacity;
    lineMat.blending = p.blending;
    lineMat.needsUpdate = true;
    scene.fog = new THREE.FogExp2(p.fog, 0.016);
  }
  applyTheme();
  lightMq.addEventListener('change', applyTheme);

  /* Pointer parallax (fine pointers only) + smoothed scroll dolly */
  let ptrX = 0, ptrY = 0, smX = 0, smY = 0, smP = 0;
  if (fineMq.matches) {
    window.addEventListener('pointermove', (e) => {
      ptrX = (e.clientX / innerWidth) * 2 - 1;
      ptrY = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  const clock = new THREE.Clock();
  let live = false;

  function tick() {
    const t = clock.getElapsedTime();
    const pos = posAttr.array;

    for (let i = 0; i < COUNT; i++) {
      const s = speedArr[i], ph = phase[i], a = amp[i], j = i * 3;
      pos[j] = base[j] + Math.sin(t * s + ph) * a;
      pos[j + 1] = base[j + 1] + Math.cos(t * s * 0.83 + ph * 1.4) * a * 0.8;
      pos[j + 2] = base[j + 2] + Math.sin(t * s * 0.6 + ph * 2.1) * a * 0.5;
    }
    posAttr.needsUpdate = true;

    const lp = linePos.array;
    for (let k = 0; k < pairs.length; k++) {
      const src = pairs[k] * 3, dst = k * 3;
      lp[dst] = pos[src];
      lp[dst + 1] = pos[src + 1];
      lp[dst + 2] = pos[src + 2];
    }
    linePos.needsUpdate = true;

    /* Scroll progress drives the dolly; everything eases toward target */
    const max = Math.max(1, docEl.scrollHeight - innerHeight);
    const p = clamp(window.scrollY / max, 0, 1);
    smP += (p - smP) * 0.045;
    smX += (ptrX - smX) * 0.04;
    smY += (ptrY - smY) * 0.04;

    camera.position.z = 46 - smP * 30;
    camera.position.y = -smP * 5;
    camera.position.x = smX * 2.2;
    camera.lookAt(0, -smP * 5, camera.position.z - 20);

    field.rotation.y = t * 0.018 + smX * 0.05;
    field.rotation.x = smY * 0.045;
    field.rotation.z = smP * 0.22;

    renderer.render(scene, camera);
    if (!live) { live = true; canvas.classList.add('is-live'); }
  }

  renderer.setAnimationLoop(tick);
  document.addEventListener('visibilitychange', () => {
    renderer.setAnimationLoop(document.hidden ? null : tick);
  });

  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
  });
}
