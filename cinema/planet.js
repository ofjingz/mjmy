/* An abstract darkroom cinema globe inspired by Varda's 101 Nights & silver-gelatin photograms.
   City positions follow approximate geographic coordinates (strictly no maps, coastlines, or borders). */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const SEGMENTS = 192;
  const CAMERA_DIST = 4.8;
  const LIMB_SCALE = CAMERA_DIST / Math.sqrt(CAMERA_DIST * CAMERA_DIST - 1);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
  const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const mixRGB = (a, b, t) => [
    Math.round(mix(a[0], b[0], t)),
    Math.round(mix(a[1], b[1], t)),
    Math.round(mix(a[2], b[2], t)),
  ];
  const hash = (n) => {
    let x = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  const norm = (p) => {
    const length = Math.hypot(p.x, p.y, p.z) || 1;
    return { x: p.x / length, y: p.y / length, z: p.z / length };
  };
  const cross = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
  const turn = (p, yaw, pitch) => {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x = p.x * cy + p.z * sy;
    const z = -p.x * sy + p.z * cy;
    return { x, y: p.y * cp - z * sp, z: p.y * sp + z * cp };
  };
  const rotateZ = (p, angle) => ({
    x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
    y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
    z: p.z,
  });
  const angularDelta = (from, to) => ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
  const between = (a, b, t) => ({ x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) });
  const quad = (ctx, a, b, c, d) => {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
  };
  const sampleStrip = (a, b, t, v) => {
    const lx = mix(a.left.x, b.left.x, t);
    const ly = mix(a.left.y, b.left.y, t);
    const rx = mix(a.right.x, b.right.x, t);
    const ry = mix(a.right.y, b.right.y, t);
    return { x: mix(lx, rx, v), y: mix(ly, ry, v) };
  };
  const traceHole = (ctx, a, b, t0, t1, v0, v1, roundStart, roundEnd) => {
    const p0 = sampleStrip(a, b, t0, v0);
    const p1 = sampleStrip(a, b, t1, v0);
    const p2 = sampleStrip(a, b, t1, v1);
    const p3 = sampleStrip(a, b, t0, v1);
    const r = 0.30;
    const s01 = roundStart ? between(p0, p1, r) : p0;
    const e01 = roundEnd ? between(p1, p0, r) : p1;
    const s12 = roundEnd ? between(p1, p2, r) : p1;
    const e12 = roundEnd ? between(p2, p1, r) : p2;
    const s23 = roundEnd ? between(p2, p3, r) : p2;
    const e23 = roundStart ? between(p3, p2, r) : p3;
    const s30 = roundStart ? between(p3, p0, r) : p3;
    const e30 = roundStart ? between(p0, p3, r) : p0;
    ctx.moveTo(s01.x, s01.y);
    ctx.lineTo(e01.x, e01.y);
    if (roundEnd) ctx.quadraticCurveTo(p1.x, p1.y, s12.x, s12.y);
    ctx.lineTo(e12.x, e12.y);
    if (roundEnd) ctx.quadraticCurveTo(p2.x, p2.y, s23.x, s23.y);
    ctx.lineTo(e23.x, e23.y);
    if (roundStart) ctx.quadraticCurveTo(p3.x, p3.y, s30.x, s30.y);
    ctx.lineTo(e30.x, e30.y);
    if (roundStart) ctx.quadraticCurveTo(p0.x, p0.y, s01.x, s01.y);
    ctx.closePath();
  };
  const collectHoles = (fStart, fEnd, period, halfWidth) => {
    const holes = [];
    const offset = period * 0.5;
    const firstK = Math.floor((fStart - offset + halfWidth) / period);
    for (let k = firstK; k <= firstK + 1; k++) {
      const center = k * period + offset;
      const h0 = Math.max(fStart, center - halfWidth);
      const h1 = Math.min(fEnd, center + halfWidth);
      if (h1 - h0 > 0.04) {
        holes.push({
          t0: h0 - fStart,
          t1: h1 - fStart,
          roundStart: (center - halfWidth) >= fStart - 0.001,
          roundEnd: (center + halfWidth) <= fEnd + 0.001,
        });
      }
    }
    return holes;
  };

  const FILM_GOLD = '246,204,126';
  const HOVER_SILVER = '164,208,255';
  const ANCHOR_WARM = '252,216,158';

  // Approximate city positions. Strictly no landmass, coastlines, or borders.
  const CITY_POSITION = {
    '卢塞恩': [47.1, 8.3], '阿姆斯特丹': [52.4, 4.9], '都柏林': [53.3, -6.3],
    '洛杉矶': [34.1, -118.2], '堪培拉': [-35.3, 149.1], '墨尔本': [-37.8, 145.0],
    '悉尼': [-33.9, 151.2], '巴黎': [48.9, 2.3], '金边': [11.6, 104.9],
    '长春': [43.9, 125.3], '台北': [25.0, 121.5],
  };
  const cityPoint = (lat, lon) => {
    const a = lat * Math.PI / 180, b = lon * Math.PI / 180;
    return { x: Math.cos(a) * Math.sin(b), y: Math.sin(a), z: Math.cos(a) * Math.cos(b) };
  };

  class CinemaPlanet {
    constructor({ canvas, markers, cinemas = [], onSelect = () => {}, onInteract = () => {}, reducedMotion, compact = false } = {}) {
      if (!canvas || !markers) throw new Error('CinemaPlanet requires canvas and markers.');
      this.canvas = canvas;
      this.markers = markers;
      this.stage = canvas.parentElement;
      this.ctx = canvas.getContext('2d', { alpha: true });
      if (!this.ctx) throw new Error('Canvas 2D is unavailable.');
      this.compact = compact;
      this.cinemas = cinemas;
      this.onSelect = onSelect;
      this.onInteract = onInteract;
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.followsMotionQuery = reducedMotion === undefined;
      this.reducedMotion = reducedMotion === undefined ? this.motionQuery.matches : Boolean(reducedMotion);
      this.active = true;
      this.running = true;
      this.destroyed = false;
      this.yaw = -.35;
      this.pitch = -.10;
      this.activeId = cinemas[0]?.id ?? null;
      this.hoveredId = null;
      this.frame = 0;
      this.lastTime = 0;
      this.filmTime = 0;
      this.pointer = null;
      this.transition = null;
      this.focusYaw = this.yaw;
      this.revealUntil = 0;
      this.suppressClickUntil = 0;
      this.buttons = new Map();
      this.images = new Map();
      const cityCounts = new Map();
      for (const cinema of cinemas) cityCounts.set(cinema.city, (cityCounts.get(cinema.city) || 0) + 1);
      const citySeen = new Map();
      this.nodes = cinemas.map((cinema, index) => {
        const coordinates = CITY_POSITION[cinema.city];
        const slot = citySeen.get(cinema.city) || 0;
        citySeen.set(cinema.city, slot + 1);
        const offset = slot - (cityCounts.get(cinema.city) - 1) / 2;
        if (coordinates) {
          const [lat, lon] = coordinates;
          return { cinema, index, point: cityPoint(lat + offset * 6, lon + offset * 9) };
        }
        const y = cinemas.length < 2 ? .08 : .76 - index / (cinemas.length - 1) * 1.52;
        const angle = index * 2.399963229728653 + .42;
        const radius = Math.sqrt(1 - y * y);
        return { cinema, index, point: { x: Math.sin(angle) * radius, y, z: Math.cos(angle) * radius } };
      });
      this.bands = this.makeBands();
      if (this.compact) this.bands = this.bands.slice(0, 1);
      this.cinemaStars = this.makeCinemaStars(this.compact ? 64 : 175);
      this.colorWash = this.makeColorWash();
      this.grainPatterns = this.makeGrainPatterns();
      this.makeMarkers();
      this.loadThumbnails();
      this.bindEvents();
      this.canvas.style.touchAction = 'none';
      this.resize();
      this.observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null;
      this.observer?.observe(this.stage);
      this.tick = this.tick.bind(this);
      this.requestFrame();
    }

    makeCinemaStars(count) {
      const stars = [];
      for (let i = 0; i < count; i++) {
        const u = hash(701 + i * 5) * 2 - 1;
        const theta = hash(701 + i * 5 + 1) * TAU;
        const sq = Math.sqrt(Math.max(0, 1 - u * u));
        const kind = hash(701 + i * 5 + 2);
        const depth = 0.84 + hash(701 + i * 5 + 3) * 0.14;
        stars.push({
          point: { x: sq * Math.cos(theta) * depth, y: u * depth, z: sq * Math.sin(theta) * depth },
          size: kind > 0.87 ? 2.0 : kind > 0.56 ? 1.2 : 0.72,
          glow: kind > 0.87,
          tone: kind > 0.60 ? 'gold' : kind > 0.30 ? 'rose' : 'ice',
          phase: hash(701 + i * 9) * TAU,
        });
      }
      return stars;
    }

    makeColorWash() {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const blobs = [
        { x: 0.24, y: 0.30, rad: 0.48, col: '62,126,242', a: 0.42 },
        { x: 0.72, y: 0.68, rad: 0.50, col: '224,72,132', a: 0.44 },
        { x: 0.36, y: 0.76, rad: 0.42, col: '224,72,132', a: 0.28 },
        { x: 0.68, y: 0.24, rad: 0.40, col: '246,198,108', a: 0.34 },
        { x: 0.50, y: 0.48, rad: 0.38, col: '62,126,242', a: 0.26 },
      ];
      for (let i = 0; i < blobs.length; i++) {
        const b = blobs[i];
        const gx = b.x * size;
        const gy = b.y * size;
        const gr = b.rad * size;
        const g = ctx.createRadialGradient(gx, gy, 2, gx, gy, gr);
        g.addColorStop(0, `rgba(${b.col},${b.a})`);
        g.addColorStop(0.55, `rgba(${b.col},${(b.a * 0.42).toFixed(3)})`);
        g.addColorStop(1, `rgba(${b.col},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
      }
      const m = document.createElement('canvas');
      m.width = m.height = 64;
      const mctx = m.getContext('2d');
      const img = mctx.createImageData(64, 64);
      for (let i = 0; i < 64 * 64; i++) {
        const v = hash(i * 17 + 101);
        img.data[i * 4] = 225;
        img.data[i * 4 + 1] = 232;
        img.data[i * 4 + 2] = 250;
        img.data[i * 4 + 3] = Math.round(v * 56);
      }
      mctx.putImageData(img, 0, 0);
      ctx.save();
      ctx.filter = 'blur(10px)';
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.54;
      ctx.drawImage(m, 0, 0, size, size);
      ctx.restore();
      return canvas;
    }

    makeGrainPatterns() {
      const frames = [];
      const size = 160;
      for (let f = 0; f < 4; f++) {
        const tile = document.createElement('canvas');
        tile.width = tile.height = size;
        const context = tile.getContext('2d');
        const pixels = context.createImageData(size, size);
        for (let i = 0; i < size * size; i++) {
          const n = hash((i + f * 41231) * 13);
          const n2 = hash((i + f * 17321) * 29);
          const bright = n > 0.50;
          const lum = bright ? 238 : 16;
          const alpha = n > 0.87 ? 98 : n < 0.14 ? 72 : 28;
          pixels.data[i * 4] = bright && n2 > 0.7 ? 255 : lum;
          pixels.data[i * 4 + 1] = bright && n2 > 0.7 ? 228 : lum;
          pixels.data[i * 4 + 2] = bright && n2 > 0.7 ? 210 : Math.min(255, lum + 18);
          pixels.data[i * 4 + 3] = alpha;
        }
        context.putImageData(pixels, 0, 0);
        frames.push(this.ctx.createPattern(tile, 'repeat'));
      }
      return frames;
    }

    makeBands() {
      // Direction A (101 Nights Velvet Rose + Starry Cobalt + Projector Warm Gold),
      // with crisp luminous backlit WHITE sprocket perforations (zero black dots!).
      const settings = [
        {
          kind: 'hero35',
          radius: 1.055,
          width: 0.044,
          fill: [188, 46, 104],      // velvet rose celluloid
          rim: [252, 152, 196],      // rose-pearl backlit edge
          glint: [255, 224, 174],    // warm gold-pearl glint
          divider: [248, 206, 146],  // warm gold frame line
          holeLight: [255, 246, 250],// crisp luminous white perforations
          windowAlpha: 0.24,
          railExtraAlpha: 0.16,
          railWidth: 0.24,
          holeRange: [0.06, 0.175],
          perfPeriod: 2,
          perfHalfWidth: 0.26,
          framePeriod: 8,
          rimStrength: 1.05,
          speed: 0.56,
          shimmerSpeed: 0.48,
          yaw: -0.58,
          pitch: 0.42,
          roll: -0.44,
          phase: 0.3,
          wave: 0.065,
        },
        {
          kind: 'secondary16',
          radius: 1.14,
          width: 0.023,
          fill: [46, 108, 228],      // starry cobalt celluloid
          rim: [148, 202, 255],      // ice-cobalt edge
          glint: [224, 240, 255],    // moonlight white glint
          divider: [196, 226, 255],
          holeLight: [240, 248, 255],// crisp luminous ice-white perforations
          windowAlpha: 0.19,
          railExtraAlpha: 0.14,
          railWidth: 0.23,
          holeRange: [0.055, 0.165],
          perfPeriod: 2,
          perfHalfWidth: 0.24,
          framePeriod: 6,
          rimStrength: 0.92,
          speed: -0.40,
          shimmerSpeed: 0.36,
          yaw: 0.84,
          pitch: 1.24,
          roll: 0.62,
          phase: 1.4,
          wave: 0.058,
        },
        {
          kind: 'optical',
          radius: 1.22,
          width: 0.0085,
          fill: [245, 194, 96],      // projector warm gold
          rim: [255, 228, 162],
          glint: [255, 244, 214],
          divider: [255, 240, 196],
          tickPeriod: 4,
          majorTickPeriod: 16,
          rimStrength: 1.0,
          speed: 0.78,
          shimmerSpeed: 0.62,
          yaw: 1.12,
          pitch: 0.76,
          roll: -0.90,
          phase: 2.8,
          wave: 0.048,
        },
      ];
      return settings.map((band, bandIndex) => {
        const sample = (angle) => {
          const p = norm({ x: Math.cos(angle), y: Math.sin(angle), z: band.wave * Math.sin(angle * 2 + band.phase) });
          const rotated = rotateZ(turn(p, band.yaw, band.pitch), band.roll);
          return { x: rotated.x * band.radius, y: rotated.y * band.radius, z: rotated.z * band.radius };
        };
        const points = Array.from({ length: SEGMENTS + 1 }, (_, i) => {
          const angle = (i / SEGMENTS) * TAU;
          const center = sample(angle);
          const next = sample(angle + 0.001);
          const tangent = norm({ x: next.x - center.x, y: next.y - center.y, z: next.z - center.z });
          const side = norm(cross(center, tangent));
          const edge = (direction) => ({
            x: center.x + side.x * band.width * direction,
            y: center.y + side.y * band.width * direction,
            z: center.z + side.z * band.width * direction,
          });
          return { center, left: edge(-1), right: edge(1) };
        });
        return { ...band, bandIndex, points };
      });
    }

    makeMarkers() {
      if (this.compact) return;
      for (const node of this.nodes) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'planet-marker';
        button.dataset.id = node.cinema.id;
        button.setAttribute('aria-label', `查看${node.cinema.displayName || node.cinema.city + ' ' + node.cinema.name}`);
        button.title = node.cinema.displayName || `${node.cinema.city} ${node.cinema.name}`;
        button.style.position = 'absolute';
        button.style.width = '54px';
        button.style.height = '46px';
        button.addEventListener('pointerenter', () => {
          if (this.pointer?.moved) return;
          this.hoveredId = node.cinema.id;
          this.requestFrame();
        });
        button.addEventListener('pointerleave', () => {
          if (this.hoveredId === node.cinema.id) {
            this.hoveredId = null;
            this.requestFrame();
          }
        });
        button.addEventListener('focus', () => {
          this.hoveredId = node.cinema.id;
          this.setRunning(false);
          this.onInteract();
          this.requestFrame();
        });
        button.addEventListener('blur', () => {
          if (this.hoveredId === node.cinema.id) {
            this.hoveredId = null;
            this.requestFrame();
          }
        });
        button.addEventListener('click', (event) => {
          if (performance.now() < this.suppressClickUntil) {
            event.preventDefault();
            return;
          }
          this.onSelect(node.cinema.id);
        });
        this.markers.append(button);
        this.buttons.set(node.cinema.id, button);
      }
    }

    loadThumbnails() {
      for (const cinema of this.cinemas) {
        const source = cinema.images?.[0]?.thumb;
        if (!source) continue;
        let url;
        try { url = new URL(source, document.baseURI); } catch { continue; }
        if (url.origin !== location.origin && url.protocol !== 'data:' && url.protocol !== 'blob:') continue;
        const image = new Image();
        image.decoding = 'async';
        image.onload = () => { if (!this.destroyed) { this.images.set(cinema.id, image); this.requestFrame(); } };
        image.onerror = () => {};
        image.src = source;
        this.images.set(cinema.id, image);
      }
    }

    bindEvents() {
      this.events = new AbortController();
      const options = { signal: this.events.signal };
      this.stage.addEventListener('pointerdown', (event) => {
        if (this.compact || !this.active || this.pointer || event.button !== 0) return;
        const control = event.target.closest?.('button, a, input, select, textarea');
        if (control && !control.classList.contains('planet-marker')) return;
        this.pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: this.yaw, pitch: this.pitch, moved: false };
      }, options);
      window.addEventListener('pointermove', (event) => {
        const pointer = this.pointer;
        if (!pointer || pointer.id !== event.pointerId) return;
        const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
        if (!pointer.moved && Math.hypot(dx, dy) <= 6) return;
        if (!pointer.moved) {
          pointer.moved = true;
          this.transition = null;
          this.running = false;
          this.hoveredId = null;
          this.stage.classList.add('is-dragging');
          try { this.stage.setPointerCapture(event.pointerId); } catch {}
          this.onInteract();
        }
        event.preventDefault();
        this.yaw = pointer.yaw + dx * .007;
        this.pitch = pointer.pitch + dy * .005;
        this.requestFrame();
      }, { ...options, passive: false });
      const release = (event) => {
        if (!this.pointer || this.pointer.id !== event.pointerId) return;
        if (this.pointer.moved) this.suppressClickUntil = performance.now() + 350;
        this.pointer = null;
        this.stage.classList.remove('is-dragging');
        try { this.stage.releasePointerCapture(event.pointerId); } catch {}
        this.requestFrame();
      };
      window.addEventListener('pointerup', release, options);
      window.addEventListener('pointercancel', release, options);
      window.addEventListener('resize', () => this.resize(), options);
      document.addEventListener('visibilitychange', () => {
        this.lastTime = 0;
        if (document.hidden) { this.clearInteraction(); this.cancelFrame(); } else this.requestFrame();
      }, options);
      if (this.followsMotionQuery) this.motionQuery.addEventListener('change', (event) => {
        this.reducedMotion = event.matches;
        if (event.matches && this.transition) {
          this.yaw = this.transition.yaw;
          this.pitch = this.transition.pitch;
          this.transition = null;
        }
        this.requestFrame();
      }, options);
    }

    resize() {
      if (this.destroyed) return;
      const rect = this.stage.getBoundingClientRect();
      this.width = Math.max(1, rect.width);
      this.height = Math.max(1, rect.height);
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;
      const mobile = this.width < 700;
      this.cx = this.width * (this.compact || mobile ? .5 : .395);
      this.cy = this.height * (this.compact ? .5 : mobile ? .46 : .485);
      this.radius = this.compact
        ? Math.min(this.width, this.height) * .39
        : mobile
          ? Math.min(this.width * .36, this.height * .36)
          : Math.min(this.width * .255, this.height * .36);
      this.requestFrame();
    }

    select(id, { animate = true } = {}) {
      const node = this.nodes.find((entry) => entry.cinema.id === id);
      if (!node || this.destroyed) return;
      this.activeId = id;
      const targetYaw = Math.atan2(-node.point.x, node.point.z);
      const targetPitch = Math.atan2(node.point.y, Math.hypot(node.point.x, node.point.z));
      const views = [
        { yaw: targetYaw, pitch: targetPitch },
        { yaw: targetYaw + Math.PI, pitch: Math.PI - targetPitch },
      ].map((view) => ({
        yaw: this.yaw + angularDelta(this.yaw, view.yaw),
        pitch: this.pitch + angularDelta(this.pitch, view.pitch),
      }));
      const { yaw, pitch } = views.sort((a, b) =>
        Math.hypot(a.yaw - this.yaw, a.pitch - this.pitch) - Math.hypot(b.yaw - this.yaw, b.pitch - this.pitch)
      )[0];
      this.focusYaw = yaw;
      if (animate && !this.reducedMotion && this.active) {
        this.transition = { fromYaw: this.yaw, fromPitch: this.pitch, yaw, pitch, started: performance.now() };
      } else {
        this.yaw = yaw;
        this.pitch = pitch;
        this.transition = null;
      }
      this.requestFrame();
    }

    setRunning(value) {
      this.running = Boolean(value);
      if (value) this.focusYaw = this.yaw;
      this.lastTime = 0;
      this.requestFrame();
    }

    revealNearby() {
      if (this.compact || this.reducedMotion) return;
      this.revealUntil = performance.now() + 1600;
      this.requestFrame();
    }

    setActive(value) {
      this.active = Boolean(value);
      this.lastTime = 0;
      if (this.active) this.requestFrame(); else { this.clearInteraction(); this.cancelFrame(); }
    }

    clearInteraction() {
      if (this.pointer) {
        try { this.stage.releasePointerCapture(this.pointer.id); } catch {}
      }
      this.pointer = null;
      this.hoveredId = null;
      this.stage.classList.remove('is-dragging');
    }

    requestFrame() {
      if (this.frame || this.destroyed || !this.active || document.hidden) return;
      this.frame = requestAnimationFrame((time) => this.tick(time));
    }

    cancelFrame() {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
    }

    tick(time) {
      this.frame = 0;
      if (this.destroyed || !this.active || document.hidden) return;
      const delta = this.lastTime ? Math.min((time - this.lastTime) / 1000, .05) : 0;
      this.lastTime = time;
      if (!this.reducedMotion) {
        this.filmTime += delta;
      }
      if (this.transition) {
        const progress = clamp((time - this.transition.started) / 920, 0, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        this.yaw = mix(this.transition.fromYaw, this.transition.yaw, ease);
        this.pitch = mix(this.transition.fromPitch, this.transition.pitch, ease);
        if (progress === 1) this.transition = null;
      } else if (this.running && !this.reducedMotion && !this.pointer) {
        this.yaw = this.focusYaw + (this.compact ? .12 : .085) * Math.sin(time / 3600);
      }
      this.render();
      if (this.transition || !this.reducedMotion || time < this.revealUntil) this.requestFrame();
    }

    project(point) {
      const p = turn(point, this.yaw, this.pitch);
      const scale = CAMERA_DIST / (CAMERA_DIST - p.z);
      return { x: this.cx + p.x * this.radius * scale, y: this.cy + p.y * this.radius * scale, z: p.z, scale };
    }

    drawAura(ctx) {
      const limbR = this.radius * LIMB_SCALE;
      const aura1 = ctx.createRadialGradient(this.cx - limbR * 0.24, this.cy - limbR * 0.22, limbR * 0.18, this.cx, this.cy, limbR * 1.46);
      aura1.addColorStop(0, 'rgba(42, 108, 232, 0.22)');
      aura1.addColorStop(0.54, 'rgba(208, 58, 122, 0.14)');
      aura1.addColorStop(1, 'rgba(8, 12, 26, 0)');
      ctx.fillStyle = aura1;
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, limbR * 1.46, 0, TAU);
      ctx.fill();

      const aura2 = ctx.createRadialGradient(this.cx + limbR * 0.34, this.cy + limbR * 0.36, limbR * 0.08, this.cx + limbR * 0.22, this.cy + limbR * 0.24, limbR * 1.14);
      aura2.addColorStop(0, 'rgba(208, 58, 122, 0.15)');
      aura2.addColorStop(0.5, 'rgba(245, 199, 101, 0.07)');
      aura2.addColorStop(1, 'rgba(8, 12, 26, 0)');
      ctx.fillStyle = aura2;
      ctx.beginPath();
      ctx.arc(this.cx + limbR * 0.22, this.cy + limbR * 0.24, limbR * 1.14, 0, TAU);
      ctx.fill();
    }

    drawSphere(ctx) {
      const limbR = this.radius * LIMB_SCALE;

      ctx.save();
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, limbR, 0, TAU);
      ctx.clip();

      // Direction A hollow translucent silver-gelatin Fresnel glass orb with 101 Nights palette (zero meridians).
      const fresnel = ctx.createRadialGradient(
        this.cx - limbR * 0.08,
        this.cy - limbR * 0.10,
        limbR * 0.10,
        this.cx,
        this.cy,
        limbR
      );
      fresnel.addColorStop(0.00, 'rgba(11, 24, 58, 0.56)');
      fresnel.addColorStop(0.42, 'rgba(24, 56, 124, 0.40)');
      fresnel.addColorStop(0.72, 'rgba(84, 134, 224, 0.44)');
      fresnel.addColorStop(0.88, 'rgba(218, 106, 158, 0.62)');
      fresnel.addColorStop(0.96, 'rgba(246, 206, 152, 0.76)');
      fresnel.addColorStop(1.00, 'rgba(255, 234, 212, 0.88)');
      ctx.fillStyle = fresnel;
      ctx.fillRect(this.cx - limbR, this.cy - limbR, limbR * 2, limbR * 2);

      // Directional starry cobalt & velvet rose darkroom washes + organic rotating developer cloud texture.
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const cobalt = ctx.createRadialGradient(this.cx - limbR * 0.56, this.cy - limbR * 0.18, 4, this.cx - limbR * 0.42, this.cy - limbR * 0.10, limbR * 0.92);
      cobalt.addColorStop(0, 'rgba(54, 124, 248, 0.34)');
      cobalt.addColorStop(1, 'rgba(40, 100, 230, 0)');
      ctx.fillStyle = cobalt;
      ctx.fillRect(this.cx - limbR, this.cy - limbR, limbR * 2, limbR * 2);

      const rose = ctx.createRadialGradient(this.cx + limbR * 0.52, this.cy + limbR * 0.46, 4, this.cx + limbR * 0.42, this.cy + limbR * 0.38, limbR * 0.96);
      rose.addColorStop(0, 'rgba(226, 72, 136, 0.38)');
      rose.addColorStop(1, 'rgba(220, 60, 120, 0)');
      ctx.fillStyle = rose;
      ctx.fillRect(this.cx - limbR, this.cy - limbR, limbR * 2, limbR * 2);

      ctx.globalAlpha = 0.62;
      const shiftX = (((this.yaw / TAU) % 1) + 1) % 1 * limbR * 2.2;
      ctx.drawImage(this.colorWash, this.cx - limbR * 1.2 + shiftX - limbR * 2.2, this.cy - limbR * 1.15, limbR * 2.3, limbR * 2.3);
      ctx.drawImage(this.colorWash, this.cx - limbR * 1.2 + shiftX, this.cy - limbR * 1.15, limbR * 2.3, limbR * 2.3);

      // Warm projector-beam skylight bloom at upper crown.
      const crown = ctx.createRadialGradient(this.cx - limbR * 0.14, this.cy - limbR * 0.72, 2, this.cx - limbR * 0.10, this.cy - limbR * 0.56, limbR * 0.76);
      crown.addColorStop(0, 'rgba(255, 226, 174, 0.48)');
      crown.addColorStop(0.45, 'rgba(128, 178, 255, 0.20)');
      crown.addColorStop(1, 'rgba(255, 224, 180, 0)');
      ctx.fillStyle = crown;
      ctx.fillRect(this.cx - limbR, this.cy - limbR, limbR * 2, limbR * 2);
      ctx.restore();

      // Sparkling cinema starlights scattered delicately inside the Earth.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const star of this.cinemaStars) {
        const q = this.project(star.point);
        if (q.z < -0.15) continue;
        const front = clamp((q.z + 0.15) / 1.15, 0, 1);
        const twinkle = this.reducedMotion ? 0.85 : (0.58 + 0.42 * Math.sin(this.filmTime * 2.1 + star.phase));
        const alpha = clamp((0.18 + 0.76 * front) * twinkle, 0, 0.95);
        const rgb = star.tone === 'gold' ? '255,218,138' : star.tone === 'rose' ? '252,148,194' : '198,226,255';
        if (star.glow && !this.compact) {
          const haloR = star.size * 5.0;
          const g = ctx.createRadialGradient(q.x, q.y, 0.4, q.x, q.y, haloR);
          g.addColorStop(0, `rgba(${rgb},${(alpha * 0.62).toFixed(3)})`);
          g.addColorStop(0.45, `rgba(${rgb},${(alpha * 0.18).toFixed(3)})`);
          g.addColorStop(1, `rgba(${rgb},0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(q.x, q.y, haloR, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(q.x, q.y, star.size * (this.compact ? 0.55 : 0.74), 0, TAU);
        ctx.fill();
      }
      ctx.restore();

      // Animated 35mm silver-halide film grain inside the Earth.
      const grainIndex = this.reducedMotion ? 0 : Math.floor(this.filmTime * 9.5) % this.grainPatterns.length;
      const grainPattern = this.grainPatterns[grainIndex];
      if (grainPattern) {
        ctx.save();
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.62;
        ctx.fillStyle = grainPattern;
        ctx.fillRect(this.cx - limbR, this.cy - limbR, limbR * 2, limbR * 2);
        ctx.restore();
      }
      ctx.restore();

      // Luminous tri-color rim stroke (warm gold -> cobalt -> velvet rose).
      ctx.save();
      const rimGrad = ctx.createLinearGradient(
        this.cx - limbR * 0.80,
        this.cy - limbR,
        this.cx + limbR * 0.80,
        this.cy + limbR
      );
      rimGrad.addColorStop(0, 'rgba(252, 216, 156, 0.84)');
      rimGrad.addColorStop(0.5, 'rgba(130, 184, 255, 0.72)');
      rimGrad.addColorStop(1, 'rgba(238, 102, 158, 0.80)');
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, limbR, 0, TAU);
      ctx.strokeStyle = rimGrad;
      ctx.lineWidth = this.compact ? 1.0 : 1.45;
      ctx.stroke();
      ctx.restore();
    }

    render() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);

      // 1. Atmospheric tri-tone nebula aura behind everything.
      this.drawAura(ctx);

      const backBands = [];
      const frontItems = [];

      for (const band of this.bands) {
        const points = band.points.map((point) => ({
          center: this.project(point.center),
          left: this.project(point.left),
          right: this.project(point.right),
        }));
        const phase = ((this.filmTime * band.speed) % SEGMENTS + SEGMENTS) % SEGMENTS;
        for (let i = 0; i < points.length - 1; i++) {
          const seg = {
            kind: 'band',
            z: (points[i].center.z + points[i + 1].center.z) * 0.5,
            a: points[i],
            b: points[i + 1],
            band,
            index: i,
            phase,
          };
          if (seg.z < 0) backBands.push(seg);
          else frontItems.push(seg);
        }
      }

      // Compute cinema screen placements and focus clearance BEFORE drawing ribbons.
      const accepted = [];
      const projected = this.nodes
        .map((node) => ({ node, p: this.project(node.point) }))
        .sort((a, b) => Number(b.node.cinema.id === this.activeId) - Number(a.node.cinema.id === this.activeId) || b.p.z - a.p.z);

      let activeClearance = null;
      let hoverClearance = null;

      for (const { node, p } of projected) {
        if (p.z < -.12) {
          node.occluded = true;
          this.positionMarker(node, p);
          continue;
        }
        const selected = node.cinema.id === this.activeId;
        const width = this.compact ? 18 : selected ? 48 : 25;
        const height = width * .72;
        let placed = null;
        for (let attempt = 0; attempt < 33; attempt++) {
          const ring = Math.ceil(attempt / 8);
          const angle = node.index * 2.399963229728653 + attempt * 2.399963229728653;
          const distance = attempt ? ring * (this.compact ? 15 : 31) : 0;
          const candidate = { ...p, x: p.x + Math.cos(angle) * distance, y: p.y + Math.sin(angle) * distance };
          if (Math.hypot(candidate.x - this.cx, candidate.y - this.cy) > this.radius * 1.15) continue;
          if (accepted.some((other) => Math.abs(other.p.x - candidate.x) < width + other.width + 4 && Math.abs(other.p.y - candidate.y) < height + other.height + 4)) continue;
          placed = candidate;
          break;
        }
        node.occluded = !placed;
        if (placed) {
          accepted.push({ p: placed, width, height });
          frontItems.push({ kind: 'screen', z: p.z + .04, node, p: placed, surface: p });
          if (selected && p.z > -.13) {
            const scale = p.scale * 1.10;
            const drawW = (this.compact ? 24 : 76) * scale;
            const drawH = drawW * .72;
            activeClearance = { x: placed.x, y: placed.y, rx: drawW * 0.85 + 22, ry: drawH * 0.92 + 22 };
          } else if (!this.compact && node.cinema.id === this.hoveredId && p.z > -.13) {
            const depth = clamp((p.z + 1) / 2, 0, 1);
            const scale = p.scale * (.88 + depth * .22);
            const drawW = 44 * scale;
            const drawH = drawW * .72;
            hoverClearance = { x: placed.x, y: placed.y, rx: drawW * 0.85 + 16, ry: drawH * 0.92 + 16 };
          }
        }
        this.positionMarker(node, placed || p);
      }

      this.activeClearance = activeClearance;
      this.hoverClearance = hoverClearance;

      // 2. Draw back-half of ribbons (passing cleanly BEHIND the Earth).
      backBands.sort((a, b) => a.z - b.z);
      for (const seg of backBands) this.drawBand(seg);

      // 3. Draw the luminous translucent 101 Nights Earth sphere.
      this.drawSphere(ctx);

      // 4. Draw front-half of ribbons & enlarged cinema thumbnails.
      frontItems.sort((a, b) => a.z - b.z);
      let selectedScreen = null;
      let hoveredScreen = null;
      for (const item of frontItems) {
        if (item.kind === 'band') {
          this.drawBand(item);
        } else if (item.node.cinema.id === this.activeId && item.p.z > -.13) {
          selectedScreen = item;
        } else if (!this.compact && item.node.cinema.id === this.hoveredId && item.p.z > -.13) {
          hoveredScreen = item;
        } else {
          this.drawScreen(item);
        }
      }
      if (hoveredScreen) this.drawScreen(hoveredScreen);
      if (selectedScreen) this.drawScreen(selectedScreen);
    }

    computeClearance(midX, midY, z) {
      const frontMask = smoothstep(-0.14, 0.26, z);
      if (frontMask <= 0) return 1;
      let mult = 1;
      if (this.activeClearance) {
        const { x, y, rx, ry } = this.activeClearance;
        const d = Math.hypot((midX - x) / rx, (midY - y) / ry);
        const keep = 0.16 + 0.84 * smoothstep(0.60, 1.42, d);
        mult = Math.min(mult, 1 - frontMask * (1 - keep));
      }
      if (this.hoverClearance) {
        const { x, y, rx, ry } = this.hoverClearance;
        const d = Math.hypot((midX - x) / rx, (midY - y) / ry);
        const keep = 0.44 + 0.56 * smoothstep(0.62, 1.35, d);
        mult = Math.min(mult, 1 - frontMask * (1 - keep));
      }
      return mult;
    }

    drawBand({ a, b, band, z, index, phase }) {
      const ctx = this.ctx;
      const midX = (a.center.x + b.center.x) * 0.5;
      const midY = (a.center.y + b.center.y) * 0.5;
      const isFront = z >= 0;
      const front = isFront
        ? 0.34 + 0.66 * Math.pow(clamp(z / band.radius, 0, 1), 0.82)
        : 0.10 + 0.24 * clamp(1 + z / band.radius, 0, 1);
      const clearance = isFront ? this.computeClearance(midX, midY, z) : 1;

      const upperLight = clamp(
        0.56 - (midY - this.cy) / (this.radius * 2.0) - (midX - this.cx) / (this.radius * 3.8),
        0,
        1
      );
      const facing = clamp(Math.abs(z / band.radius), 0, 1);
      const grazing = Math.pow(1 - facing, 1.35);
      const shimmerWave = 0.5 + 0.5 * Math.sin(index * 0.16 - this.filmTime * band.shimmerSpeed + band.phase * 2);
      const shimmer = (0.76 + 0.34 * shimmerWave) * (isFront ? 1 : 0.6);

      const fStart = index - phase;
      const fEnd = index + 1 - phase;

      if (band.kind === 'optical') {
        this.drawOpticalTrail(ctx, a, b, band, index, front, isFront, upperLight, grazing, shimmer, clearance, fStart, fEnd);
        return;
      }

      const winAlpha = (0.04 + front * band.windowAlpha) * shimmer * clearance;
      const railAlpha = (0.02 + front * band.railExtraAlpha) * shimmer * clearance;
      const railW = band.railWidth;

      // 1. Translucent color-tinted celluloid strip body.
      ctx.beginPath();
      quad(ctx, a.left, b.left, b.right, a.right);
      ctx.fillStyle = `rgba(${band.fill.join(',')}, ${clamp(winAlpha, 0, 0.52).toFixed(4)})`;
      ctx.fill();

      // 2. Slightly richer outer sprocket rails framing the airier center picture window.
      const aL = between(a.left, a.right, railW);
      const bL = between(b.left, b.right, railW);
      const aR = between(a.left, a.right, 1 - railW);
      const bR = between(b.left, b.right, 1 - railW);
      ctx.beginPath();
      quad(ctx, a.left, b.left, bL, aL);
      quad(ctx, aR, bR, b.right, a.right);
      ctx.fillStyle = `rgba(${band.fill.join(',')}, ${clamp(railAlpha, 0, 0.36).toFixed(4)})`;
      ctx.fill();

      // 3. Luminous backlit WHITE sprocket perforations (projector light shining through the film holes!).
      if (isFront && front > 0.30 && (!this.compact || index % 2 === 0)) {
        const holes = collectHoles(fStart, fEnd, band.perfPeriod, band.perfHalfWidth);
        if (holes.length) {
          const [hIn, hOut] = band.holeRange;
          const holeAlpha = clamp((0.36 + front * 0.44 + upperLight * 0.14) * clearance, 0, 0.88);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.beginPath();
          for (const h of holes) {
            traceHole(ctx, a, b, h.t0, h.t1, hIn, hOut, h.roundStart, h.roundEnd);
            traceHole(ctx, a, b, h.t0, h.t1, 1 - hOut, 1 - hIn, h.roundStart, h.roundEnd);
          }
          ctx.fillStyle = `rgba(${band.holeLight.join(',')}, ${holeAlpha.toFixed(4)})`;
          ctx.fill();
          ctx.restore();
        }
      }

      // 4. Delicate aligned frame divider hairlines.
      if (isFront && front > 0.34 && !this.compact) {
        const divK = Math.ceil(fStart / band.framePeriod);
        const fDiv = divK * band.framePeriod;
        if (fDiv >= fStart && fDiv < fEnd) {
          const t = fDiv - fStart;
          const p0 = sampleStrip(a, b, t, railW + 0.03);
          const p1 = sampleStrip(a, b, t, 1 - railW - 0.03);
          const divAlpha = clamp((0.20 + front * 0.28 + upperLight * 0.14) * clearance, 0, 0.72);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `rgba(${band.divider.join(',')}, ${divAlpha.toFixed(4)})`;
          ctx.lineWidth = band.bandIndex === 0 ? 0.75 : 0.55;
          ctx.stroke();
        }
      }

      // 5. Grazing luminous rim-light edges (backlit acetate sheen).
      const edgeMix = clamp(upperLight * 0.45 + grazing * 0.35, 0, 1);
      const edgeColor = mixRGB(band.rim, band.glint, edgeMix).join(',');
      const rimAlpha = clamp(
        (0.06 + front * (0.36 + upperLight * 0.24 + grazing * 0.26)) * band.rimStrength * shimmer * clearance,
        0,
        0.92
      );
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(a.left.x, a.left.y); ctx.lineTo(b.left.x, b.left.y);
      ctx.moveTo(a.right.x, a.right.y); ctx.lineTo(b.right.x, b.right.y);
      if (isFront && !this.compact) {
        ctx.strokeStyle = `rgba(${edgeColor}, ${(rimAlpha * 0.24).toFixed(4)})`;
        ctx.lineWidth = band.bandIndex === 0 ? 2.2 : 1.5;
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${edgeColor}, ${rimAlpha.toFixed(4)})`;
      ctx.lineWidth = this.compact ? 0.65 : band.bandIndex === 0 ? 1.0 : 0.75;
      ctx.stroke();
      ctx.restore();
    }

    drawOpticalTrail(ctx, a, b, band, index, front, isFront, upperLight, grazing, shimmer, clearance, fStart, fEnd) {
      const tintShift = 0.5 + 0.5 * Math.sin(index * 0.085 - this.filmTime * 0.32);
      const filamentColor = mixRGB(band.rim, band.glint, tintShift * 0.6).join(',');

      const washAlpha = (0.014 + front * 0.065) * clearance;
      ctx.beginPath();
      quad(ctx, a.left, b.left, b.right, a.right);
      ctx.fillStyle = `rgba(${band.fill.join(',')}, ${washAlpha.toFixed(4)})`;
      ctx.fill();

      const coreAlpha = clamp(
        (0.05 + front * (0.40 + upperLight * 0.22 + grazing * 0.22)) * band.rimStrength * shimmer * clearance,
        0,
        0.90
      );
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(a.center.x, a.center.y);
      ctx.lineTo(b.center.x, b.center.y);
      if (isFront) {
        ctx.strokeStyle = `rgba(${band.fill.join(',')}, ${(coreAlpha * 0.28).toFixed(4)})`;
        ctx.lineWidth = 2.3;
        ctx.stroke();
      }
      ctx.strokeStyle = `rgba(${filamentColor}, ${coreAlpha.toFixed(4)})`;
      ctx.lineWidth = 0.95;
      ctx.stroke();

      if (isFront && front > 0.28) {
        const tickK = Math.ceil(fStart / band.tickPeriod);
        const fTick = tickK * band.tickPeriod;
        if (fTick >= fStart && fTick < fEnd) {
          const t = fTick - fStart;
          const isMajor = ((tickK % (band.majorTickPeriod / band.tickPeriod)) + 4) % 4 === 0;
          const span = isMajor ? 0.62 : 0.16;
          const p0 = sampleStrip(a, b, t, -span);
          const p1 = sampleStrip(a, b, t, 1 + span);
          const tickAlpha = (isMajor ? 0.48 : 0.22) * front * clearance;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `rgba(${band.divider.join(',')}, ${clamp(tickAlpha, 0, 0.82).toFixed(4)})`;
          ctx.lineWidth = isMajor ? 0.95 : 0.6;
          ctx.stroke();
          if (isMajor) {
            const c = sampleStrip(a, b, t, 0.5);
            ctx.fillStyle = `rgba(255, 246, 224, ${clamp(tickAlpha * 1.4, 0, 0.92).toFixed(4)})`;
            ctx.beginPath();
            ctx.arc(c.x, c.y, 1.85, 0, TAU);
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    drawAnchor(ctx, surface, placed, width, height, scale, selected, hovered) {
      if (this.compact) return;
      const dist = Math.hypot(placed.x - surface.x, placed.y - surface.y);
      const halfW = width * scale * 0.5;
      const halfH = height * scale * 0.5;
      const covered = Math.abs(placed.x - surface.x) < halfW + 3 && Math.abs(placed.y - surface.y) < halfH + 3;

      const dotColor = selected ? FILM_GOLD : hovered ? HOVER_SILVER : ANCHOR_WARM;
      const dotAlpha = selected ? 0.95 : hovered ? 0.90 : clamp(0.42 + Math.max(0, surface.z) * 0.36, 0.30, 0.78);

      ctx.save();
      if (!covered && dist > 4) {
        const ux = (placed.x - surface.x) / dist;
        const uy = (placed.y - surface.y) / dist;
        const endDist = Math.max(2, dist - Math.min(halfW, halfH) * 0.82);
        const ex = surface.x + ux * endDist;
        const ey = surface.y + uy * endDist;
        const lineGrad = ctx.createLinearGradient(surface.x, surface.y, ex, ey);
        lineGrad.addColorStop(0, `rgba(${dotColor}, ${(dotAlpha * 0.78).toFixed(4)})`);
        lineGrad.addColorStop(1, `rgba(${dotColor}, ${(dotAlpha * 0.16).toFixed(4)})`);
        ctx.beginPath();
        ctx.moveTo(surface.x, surface.y);
        ctx.lineTo(ex, ey);
        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = selected || hovered ? 0.9 : 0.65;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(surface.x, surface.y, selected ? 2.4 : hovered ? 2.0 : 1.55, 0, TAU);
        ctx.fillStyle = `rgba(${dotColor}, ${dotAlpha.toFixed(4)})`;
        ctx.fill();
        if (selected || hovered) {
          ctx.beginPath();
          ctx.arc(surface.x, surface.y, selected ? 5.0 : 4.2, 0, TAU);
          ctx.strokeStyle = `rgba(${dotColor}, ${(dotAlpha * 0.40).toFixed(4)})`;
          ctx.lineWidth = 0.75;
          ctx.stroke();
        }
      } else {
        const tickTopY = placed.y + halfH + 2;
        const pinY = tickTopY + (selected ? 6.5 : 5.0);
        ctx.beginPath();
        ctx.moveTo(placed.x, tickTopY);
        ctx.lineTo(placed.x, pinY - 1.4);
        ctx.strokeStyle = `rgba(${dotColor}, ${(dotAlpha * 0.52).toFixed(4)})`;
        ctx.lineWidth = 0.68;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(placed.x, pinY, selected ? 2.2 : hovered ? 1.85 : 1.45, 0, TAU);
        ctx.fillStyle = `rgba(${dotColor}, ${(dotAlpha * 0.92).toFixed(4)})`;
        ctx.fill();
      }
      ctx.restore();
    }

    drawScreen({ node, p, surface }) {
      if (p.z < -.75 || node.occluded) return;
      const ctx = this.ctx;
      const selected = node.cinema.id === this.activeId;
      const hovered = !selected && node.cinema.id === this.hoveredId && !this.compact;
      const depth = clamp((p.z + 1) / 2, 0, 1);
      // Enlarged cinema photo markers for clear legibility against the vibrant 101 Nights globe.
      const scale = p.scale * (selected ? 1.10 : hovered ? .88 + depth * .22 : .78 + depth * .26);
      const width = this.compact ? (selected ? 24 : 16) : selected ? 76 : hovered ? 44 : 36;
      const height = width * .72;

      if (surface) {
        this.drawAnchor(ctx, surface, p, width, height, scale, selected, hovered);
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(node.point.x * -.05);
      ctx.scale(scale, scale);

      const reveal = this.revealUntil > performance.now() && p.z > .12 && !this.compact
        ? Math.min(1, (this.revealUntil - performance.now()) / 1200)
        : 0;
      ctx.globalAlpha = selected
        ? (p.z < 0 ? .36 : 1)
        : hovered
          ? clamp(.90 + Math.max(0, p.z) * .10, .86, 1)
          : clamp(.56 + Math.max(0, p.z) * .24 + reveal * .18, .48, .88);
      ctx.filter = selected
        ? 'none'
        : hovered
          ? 'grayscale(.10) brightness(1.08)'
          : `grayscale(.45) blur(${p.z < 0 ? .5 : 0}px)`;

      const corner = this.compact ? 1.5 : 3.5;
      ctx.beginPath();
      ctx.roundRect(-width / 2, -height / 2, width, height, corner);
      ctx.fillStyle = 'rgba(12, 16, 28, .82)';
      if (selected) {
        ctx.shadowColor = `rgba(${FILM_GOLD}, .58)`;
        ctx.shadowBlur = this.compact ? 8 : 18;
      } else if (hovered) {
        ctx.shadowColor = `rgba(${HOVER_SILVER}, .50)`;
        ctx.shadowBlur = 13;
      } else {
        ctx.shadowColor = 'rgba(6, 10, 24, .52)';
        ctx.shadowBlur = 7;
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      const image = this.images.get(node.cinema.id);
      if (image?.complete && image.naturalWidth) {
        ctx.save();
        ctx.clip();
        const ratio = Math.min((width - 2) / image.naturalWidth, (height - 2) / image.naturalHeight);
        const imageWidth = image.naturalWidth * ratio;
        const imageHeight = image.naturalHeight * ratio;
        ctx.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
        ctx.restore();
      }

      ctx.filter = 'none';
      ctx.beginPath();
      ctx.roundRect(-width / 2, -height / 2, width, height, corner);
      if (selected) {
        ctx.strokeStyle = `rgba(${FILM_GOLD}, .94)`;
        ctx.lineWidth = 1.05;
        ctx.stroke();
      } else if (hovered) {
        ctx.strokeStyle = `rgba(${HOVER_SILVER}, .95)`;
        ctx.lineWidth = 1.15;
        ctx.stroke();
      } else if (!this.compact) {
        ctx.strokeStyle = 'rgba(232, 238, 252, .36)';
        ctx.lineWidth = .68;
        ctx.stroke();
      }
      ctx.restore();
    }

    positionMarker(node, p) {
      const button = this.buttons.get(node.cinema.id);
      if (!button) return;
      const visible = p.z > -.13 && !node.occluded;
      if (!visible && this.hoveredId === node.cinema.id) this.hoveredId = null;
      button.hidden = !visible;
      button.tabIndex = visible ? 0 : -1;
      button.style.left = `${p.x}px`;
      button.style.top = `${p.y}px`;
      button.style.transform = `translate(-50%, -50%) scale(${clamp(p.scale, .9, 1.14)})`;
      button.style.zIndex = String(Math.round((p.z + 1) * 50));
      button.style.opacity = String(clamp(.5 + p.z * .65, .35, 1));
      const selected = node.cinema.id === this.activeId;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.clearInteraction();
      this.cancelFrame();
      this.events.abort();
      this.observer?.disconnect();
      for (const button of this.buttons.values()) button.remove();
      for (const image of this.images.values()) { image.onload = null; image.onerror = null; }
      this.buttons.clear();
      this.images.clear();
      this.pointer = null;
      this.hoveredId = null;
      this.stage.classList.remove('is-dragging');
    }
  }

  globalThis.CinemaPlanet = CinemaPlanet;
})();
