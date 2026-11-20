/**
 * 幕间漫游 · 暗房光束氛围画布
 * - opening 模式：配合显影序列的淡蓝感应光晕
 * - hall 模式：冷蓝环境光晕，随指针轻柔漫游
 */
(function (root) {
  'use strict';

  function createAtmosphere(canvas, opts) {
    opts = opts || {};
    var onLight = typeof opts.onLight === 'function' ? opts.onLight : function () {};
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d', { alpha: true }) : null;
    if (!ctx) {
      return {
        setPointer: function () {},
        burst: function () {},
        setMode: function () {},
        setReducedMotion: function () {},
        destroy: function () {}
      };
    }

    var width = 1;
    var height = 1;
    var dpr = 1;
    var frame = 0;
    var lastTime = 0;
    var time = 0;
    var destroyed = false;
    var mode = 'opening'; // 'opening' | 'hall' | 'quiet'
    var reduced = !!opts.reducedMotion;
    var rect = canvas.getBoundingClientRect();
    var pointer = { x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5, amount: 0, targetAmount: 0 };
    var blooms = [];

    function glow(x, y, radius, opacity, rgb) {
      if (opacity <= 0 || radius <= 0) return;
      var light = ctx.createRadialGradient(x, y, 0, x, y, radius);
      light.addColorStop(0, 'rgba(' + rgb + ',' + opacity + ')');
      light.addColorStop(0.45, 'rgba(' + rgb + ',' + (opacity * 0.28) + ')');
      light.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, width, height);
    }

    function draw(dt) {
      ctx.clearRect(0, 0, width, height);
      if (mode === 'quiet') return;

      var ease = reduced ? 1 : 1 - Math.exp(-dt * 5.2);
      pointer.x += (pointer.targetX - pointer.x) * ease;
      pointer.y += (pointer.targetY - pointer.y) * ease;
      pointer.amount += (pointer.targetAmount - pointer.amount) * ease;

      var pointed = pointer.amount > 0.04;
      var minDim = Math.min(width, height);

      if (mode === 'opening') {
        var ox = pointer.x * width;
        var oy = pointer.y * height;
        var oradius = minDim * 0.23;
        var opower = pointed ? pointer.amount : 0;
        glow(ox, oy, oradius, 0.10 * opower, '104,160,231');
        onLight(ox + rect.left, oy + rect.top, oradius, opower * 2);

        for (var i = blooms.length - 1; i >= 0; i--) {
          var b = blooms[i];
          b.age += dt;
          if (b.age >= 2.8) {
            blooms.splice(i, 1);
            continue;
          }
          glow(b.x, b.y, minDim * 0.18, 0.12 * Math.sin(Math.PI * b.age / 2.8), '104,160,231');
        }
      } else if (mode === 'hall') {
        // 展厅漫游模式：低强度冷蓝环境光
        var hx = pointed ? pointer.x * width : width * (0.5 + 0.26 * Math.sin(time * 0.11));
        var hy = pointed ? pointer.y * height : height * (0.48 + 0.22 * Math.cos(time * 0.15 + 0.4));
        var hradius = Math.max(240, minDim * 0.34);
        var hpower = pointed ? pointer.amount : (reduced ? 0.28 : 0.42);
        glow(hx, hy, hradius, 0.085 * hpower, '6,69,162');
        if (pointed) {
          glow(hx, hy, minDim * 0.52, 0.036 * pointer.amount, '104,160,231');
        }
        onLight(hx + rect.left, hy + rect.top, hradius * 0.88, hpower * 1.45);

        for (var j = blooms.length - 1; j >= 0; j--) {
          var hb = blooms[j];
          hb.age += dt;
          if (hb.age >= 1.8) {
            blooms.splice(j, 1);
            continue;
          }
          glow(hb.x, hb.y, minDim * 0.2, 0.09 * Math.sin(Math.PI * hb.age / 1.8), '6,69,162');
        }
      }
    }

    function tick(now) {
      frame = 0;
      if (destroyed || document.hidden || reduced || mode === 'quiet') return;
      var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.05) : 1 / 60;
      lastTime = now;
      time += dt;
      draw(dt);
      frame = requestAnimationFrame(tick);
    }

    function ensureFrame() {
      if (destroyed || document.hidden) return;
      if (mode === 'quiet') {
        cancelAnimationFrame(frame);
        frame = 0;
        ctx.clearRect(0, 0, width, height);
        return;
      }
      if (reduced) {
        draw(0);
      } else if (!frame) {
        lastTime = 0;
        frame = requestAnimationFrame(tick);
      }
    }

    function resize() {
      if (destroyed) return;
      rect = canvas.getBoundingClientRect();
      var nextW = Math.max(1, Math.min(rect.width || window.innerWidth || 1, window.innerWidth || rect.width || 1));
      var nextH = Math.max(1, Math.min(rect.height || window.innerHeight || 1, window.innerHeight || rect.height || 1));
      var nextDpr = Math.min(window.devicePixelRatio || 1, nextW < 700 ? 1.5 : 1.75);
      var targetW = Math.round(nextW * nextDpr);
      var targetH = Math.round(nextH * nextDpr);
      width = nextW;
      height = nextH;
      dpr = nextDpr;
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ensureFrame();
    }

    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
      } else {
        resize();
      }
    }

    var observeTarget = canvas.parentElement || document.documentElement;
    var observer = typeof ResizeObserver === 'function' && observeTarget ? new ResizeObserver(resize) : null;
    if (observer) observer.observe(observeTarget);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    if (typeof queueMicrotask === 'function') queueMicrotask(resize);
    else setTimeout(resize, 0);

    return {
      setPointer: function (x, y, active) {
        var isActive = active !== false;
        if (isActive && width > 0 && height > 0) {
          pointer.targetX = Math.max(0, Math.min(1, (x - rect.left) / width));
          pointer.targetY = Math.max(0, Math.min(1, (y - rect.top) / height));
        }
        pointer.targetAmount = isActive ? 1 : 0;
        ensureFrame();
      },
      burst: function (x, y) {
        if (!reduced && !document.hidden && mode !== 'quiet') {
          blooms.push({ x: x - rect.left, y: y - rect.top, age: 0.12 });
          if (blooms.length > 8) blooms.shift();
        }
        ensureFrame();
      },
      setMode: function (nextMode) {
        mode = nextMode || 'opening';
        blooms.length = 0;
        ensureFrame();
      },
      setReducedMotion: function (value) {
        reduced = !!value;
        blooms.length = 0;
        cancelAnimationFrame(frame);
        frame = 0;
        ensureFrame();
      },
      destroy: function () {
        destroyed = true;
        cancelAnimationFrame(frame);
        if (observer) observer.disconnect();
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', onVisibility);
        ctx.clearRect(0, 0, width, height);
      }
    };
  }

  root.MujianAtmosphere = {
    create: createAtmosphere
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
