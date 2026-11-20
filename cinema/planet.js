/* An abstract cinema globe. City positions follow approximate geographic coordinates. */
(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mix = (a, b, amount) => a + (b - a) * amount;
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
    y: p.x * Math.sin(angle) + p.y * Math.cos(angle), z: p.z,
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
  const FILM_GOLD = '255,199,92';
  // Approximate city positions. The sculpture has no landmass or borders.
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
      this.frame = 0;
      this.lastTime = 0;
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
      if (this.compact) this.bands = this.bands.slice(0,1);
      this.grain = this.makeGrain();
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

    makeBands() {
      const settings = [
        { color: [197, 36, 91], glint: [249, 103, 145], width: .082, thickness: .018, radius: 1.043, opacity: 1, yaw: -.6, pitch: .42, roll: -.45, phase: .3 },
        { color: [49, 98, 218], glint: [103, 154, 255], width: .052, thickness: .014, radius: 1.007, opacity: .94, yaw: .8, pitch: 1.28, roll: .63, phase: 1.4 },
        { color: [184, 105, 42], glint: [246, 194, 97], width: .029, thickness: .010, radius: 1.025, opacity: .82, yaw: 1.1, pitch: .77, roll: -.92, phase: 2.8 },
      ];
      return settings.map((settings, bandIndex) => {
        const sample = (angle) => {
          const p = norm({ x: Math.cos(angle), y: Math.sin(angle), z: .11 * Math.sin(angle * 2 + settings.phase) });
          const rotated = rotateZ(turn(p, settings.yaw, settings.pitch), settings.roll);
          return { x: rotated.x * settings.radius, y: rotated.y * settings.radius, z: rotated.z * settings.radius };
        };
        const points = Array.from({ length: 169 }, (_, i) => {
          const angle = i / 168 * TAU;
          const center = sample(angle);
          const next = sample(angle + .001);
          const tangent = norm({ x: next.x - center.x, y: next.y - center.y, z: next.z - center.z });
          const side = norm(cross(center, tangent));
          const inward = settings.thickness / settings.radius;
          const edge = (direction, depth = 0) => ({
            x: center.x * (1 - depth) + side.x * settings.width * direction,
            y: center.y * (1 - depth) + side.y * settings.width * direction,
            z: center.z * (1 - depth) + side.z * settings.width * direction,
          });
          return { center, left: edge(-1), right: edge(1), innerLeft: edge(-1, inward), innerRight: edge(1, inward) };
        });
        return { ...settings, bandIndex, points };
      });
    }

    makeGrain() {
      const tile = document.createElement('canvas');
      tile.width = tile.height = 96;
      const context = tile.getContext('2d');
      const pixels = context.createImageData(96, 96);
      let seed = 93831;
      for (let i = 0; i < pixels.data.length; i += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = seed & 255;
        pixels.data[i + 3] = 14;
      }
      context.putImageData(pixels, 0, 0);
      return this.ctx.createPattern(tile, 'repeat');
    }

    makeMarkers() {
      if (this.compact) return;
      for (const node of this.nodes) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'planet-marker';
        button.dataset.id = node.cinema.id;
        button.setAttribute('aria-label', `查看${node.cinema.displayName || node.cinema.city+' '+node.cinema.name}`);
        button.title = node.cinema.displayName || `${node.cinema.city} ${node.cinema.name}`;
        button.style.position = 'absolute';
        button.style.width = '44px';
        button.style.height = '44px';
        button.addEventListener('focus', () => {
          this.setRunning(false);
          this.onInteract();
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
      this.cx = this.width * (this.compact || mobile ? .5 : .40);
      this.cy = this.height * (this.compact ? .5 : mobile ? .43 : .48);
      this.radius = this.compact ? Math.min(this.width,this.height) * .41 : mobile ? Math.min(this.width * .4, this.height * .4) : Math.min(this.width * .28, this.height * .4);
      this.requestFrame();
    }

    select(id, { animate = true } = {}) {
      const node = this.nodes.find((entry) => entry.cinema.id === id);
      if (!node || this.destroyed) return;
      this.activeId = id;
      const targetYaw = Math.atan2(-node.point.x, node.point.z);
      const targetPitch = Math.atan2(node.point.y, Math.hypot(node.point.x, node.point.z));
      // The same front-facing view also has an upside-down orientation.
      // Pick the nearer one so selecting a cinema does not unwind a free spin.
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
      if (this.transition || (this.running && !this.reducedMotion && !this.pointer) || time < this.revealUntil) this.requestFrame();
    }

    project(point) {
      const p = turn(point, this.yaw, this.pitch);
      const scale = 4.8 / (4.8 - p.z);
      return { x: this.cx + p.x * this.radius * scale, y: this.cy + p.y * this.radius * scale, z: p.z, scale };
    }

    render() {
      const ctx = this.ctx;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      const radius = this.radius;
      const sphere = ctx.createRadialGradient(this.cx - radius * .35, this.cy - radius * .4, radius * .08, this.cx, this.cy, radius * 1.04);
      sphere.addColorStop(0, 'rgba(82,125,221,.065)');
      sphere.addColorStop(.55, 'rgba(57,86,174,.035)');
      sphere.addColorStop(1, 'rgba(57,86,174,0)');
      ctx.beginPath();
      ctx.arc(this.cx, this.cy, radius * 1.015, 0, TAU);
      ctx.fillStyle = sphere;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = .13;
      ctx.fillStyle = this.grain;
      ctx.fillRect(this.cx - radius * 1.1, this.cy - radius * 1.1, radius * 2.2, radius * 2.2);
      ctx.restore();

      const items = [];
      for (const band of this.bands) {
        const points = band.points.map((point) => ({
          center: this.project(point.center),
          left: this.project(point.left),
          right: this.project(point.right),
          innerLeft: this.project(point.innerLeft),
          innerRight: this.project(point.innerRight),
        }));
        for (let i = 0; i < points.length - 1; i++) {
          items.push({ kind: 'band', z: (points[i].center.z + points[i + 1].center.z) / 2, a: points[i], b: points[i + 1], band, index: i });
        }
      }
      const accepted = [];
      const projected = this.nodes.map(node => ({node,p:this.project(node.point)})).sort((a,b) => Number(b.node.cinema.id===this.activeId)-Number(a.node.cinema.id===this.activeId)||b.p.z-a.p.z);
      for (const {node,p} of projected) {
        if (p.z < -.12) { node.occluded = true; this.positionMarker(node,p); continue; }
        const selected = node.cinema.id === this.activeId;
        const width = this.compact ? 15 : selected ? 39 : 18;
        const height = width * .72;
        let placed = null;
        for (let attempt = 0; attempt < 33; attempt++) {
          const ring = Math.ceil(attempt / 8);
          const angle = node.index * 2.399963229728653 + attempt * 2.399963229728653;
          const distance = attempt ? ring * (this.compact ? 13 : 25) : 0;
          const candidate = { ...p, x:p.x + Math.cos(angle)*distance, y:p.y + Math.sin(angle)*distance };
          if (Math.hypot(candidate.x-this.cx,candidate.y-this.cy) > this.radius*1.12) continue;
          if (accepted.some(other => Math.abs(other.p.x-candidate.x)<width+other.width+3 && Math.abs(other.p.y-candidate.y)<height+other.height+3)) continue;
          placed = candidate; break;
        }
        node.occluded = !placed;
        if (placed) { accepted.push({p:placed,width,height}); items.push({kind:'screen',z:p.z+.02,node,p:placed}); }
        this.positionMarker(node, placed || p);
      }
      items.sort((a, b) => a.z - b.z);
      let selectedScreen = null;
      for (const item of items) {
        if (item.kind === 'band') this.drawBand(item);
        else if (item.node.cinema.id === this.activeId && item.p.z > -.13) selectedScreen = item;
        else this.drawScreen(item);
      }
      // The current photograph stays readable even where a ribbon crosses its slot.
      if (selectedScreen) this.drawScreen(selectedScreen);
    }

    drawBand({ a, b, band, z, index }) {
      const ctx = this.ctx;
      const front = clamp((z + .20) / .55, 0, 1);
      const alpha = (.025 + front * (.35 + Math.max(0, z) * .31)) * band.opacity;
      const upperLight = clamp(.52 - (a.center.y - this.cy) / (this.radius * 1.9), 0, 1);
      const tint = upperLight * upperLight * .72;
      const color = band.color.map((channel, i) => Math.round(mix(channel, band.glint[i], tint))).join(',');
      const edgeColor = band.glint.join(',');

      // Inner vertices sit below the acetate face, exposing the dark cut edges on a tilt.
      ctx.beginPath();
      quad(ctx, a.left, b.left, b.innerLeft, a.innerLeft);
      quad(ctx, a.right, b.right, b.innerRight, a.innerRight);
      ctx.fillStyle = `rgba(12,7,27,${alpha * .84})`;
      ctx.fill();

      ctx.beginPath();
      quad(ctx, a.left, b.left, b.right, a.right);
      const holes = front > .12 && index % (this.compact ? 9 : 5) === 0;
      if (holes) {
        for (const [from, to] of [[.09, .21], [.79, .91]]) {
          const start = (edge) => between(a[edge], b[edge], .08);
          const end = (edge) => between(a[edge], b[edge], .90);
          quad(ctx, between(start('left'), start('right'), from), between(end('left'), end('right'), from),
            between(end('left'), end('right'), to), between(start('left'), start('right'), to));
        }
      }
      ctx.fillStyle = `rgba(${color},${alpha})`;
      ctx.fill('evenodd');

      ctx.beginPath();
      ctx.moveTo(a.left.x, a.left.y); ctx.lineTo(b.left.x, b.left.y);
      ctx.moveTo(a.right.x, a.right.y); ctx.lineTo(b.right.x, b.right.y);
      ctx.strokeStyle = `rgba(${edgeColor},${alpha * (.47 + upperLight * .48)})`;
      ctx.lineWidth = this.compact ? .6 : .85;
      ctx.stroke();

      if (front > .4 && band.bandIndex === 0 && !this.compact && index % 56 < 29 && index % 7 === 0) {
        const left = between(a.left, a.right, .29);
        const right = between(a.left, a.right, .71);
        ctx.beginPath();
        ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y);
        ctx.strokeStyle = `rgba(${FILM_GOLD},${alpha * .43})`;
        ctx.lineWidth = .75;
        ctx.stroke();
      }
    }

    drawScreen({ node, p }) {
      if (p.z < -.75 || node.occluded) return;
      const ctx = this.ctx;
      const selected = node.cinema.id === this.activeId;
      const depth = clamp((p.z + 1) / 2,0,1);
      const scale = p.scale * (selected ? 1.10 : .72 + depth*.28);
      const width = this.compact ? (selected ? 18 : 12) : selected ? 58 : 26;
      const height = width * .72;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(node.point.x*-.055);ctx.scale(scale,scale);
      const reveal = this.revealUntil > performance.now() && p.z > .12 && !this.compact ? Math.min(1, (this.revealUntil - performance.now()) / 1200) : 0;
      ctx.globalAlpha = selected ? (p.z < 0 ? .3 : 1) : .36+Math.max(0,p.z)*.14+reveal*.16;
      ctx.filter = selected ? 'none' : `grayscale(.85) blur(${p.z < 0 ? .7 : .15}px)`;
      ctx.beginPath();ctx.roundRect(-width/2,-height/2,width,height,this.compact ? 1 : 3);
      ctx.fillStyle='rgba(13,15,19,.72)';
      if(selected){ctx.shadowColor=`rgba(${FILM_GOLD},.50)`;ctx.shadowBlur=this.compact?6:15;}
      ctx.fill();ctx.shadowBlur=0;
      const image = this.images.get(node.cinema.id);
      if(image?.complete && image.naturalWidth){
        ctx.save();ctx.clip();
        const ratio=Math.min((width-2)/image.naturalWidth,(height-2)/image.naturalHeight);
        const imageWidth=image.naturalWidth*ratio,imageHeight=image.naturalHeight*ratio;
        ctx.drawImage(image,-imageWidth/2,-imageHeight/2,imageWidth,imageHeight);
        ctx.restore();
      }
      if(selected){
        ctx.filter='none';ctx.beginPath();ctx.roundRect(-width/2,-height/2,width,height,this.compact?1:3);
        ctx.strokeStyle=`rgba(${FILM_GOLD},.82)`;ctx.lineWidth=.8;ctx.stroke();
      }
      ctx.restore();
    }

    positionMarker(node, p) {
      const button = this.buttons.get(node.cinema.id);
      if (!button) return;
      const visible = p.z > -.13 && !node.occluded;
      button.hidden = !visible;
      button.tabIndex = visible ? 0 : -1;
      button.style.left = `${p.x}px`;
      button.style.top = `${p.y}px`;
      button.style.transform = `translate(-50%, -50%) scale(${clamp(p.scale, .9, 1.12)})`;
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
      this.stage.classList.remove('is-dragging');
    }
  }

  globalThis.CinemaPlanet = CinemaPlanet;
})();
