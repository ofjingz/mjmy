/**
 * 幕间漫游 · 零依赖离线 QR Code SVG 生成器（QR Model 2, Byte Mode, EC Level M, Auto Version 1–10）
 * 用法：window.MujianQR.toSVG(text, { size: 160, fg: '#1a1a1a', bg: '#ffffff' })
 */
(function (root) {
  'use strict';

  // GF(256) exp/log tables with primitive polynomial 0x11d
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gfMul(a, b) {
    return a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];
  }

  function rsGenerator(degree) {
    var poly = [1];
    for (var i = 0; i < degree; i++) {
      var next = new Array(poly.length + 1).fill(0);
      var factor = EXP[i];
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], factor);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLen) {
    var gen = rsGenerator(ecLen);
    var res = data.concat(new Array(ecLen).fill(0));
    for (var i = 0; i < data.length; i++) {
      var coef = res[i];
      if (coef !== 0) {
        for (var j = 0; j < gen.length; j++) {
          res[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return res.slice(data.length);
  }

  // Version 1..10 EC Level M spec: [totalCodewords, ecPerBlock, blocksG1, dataG1, blocksG2, dataG2, alignCoords]
  var VERSIONS = {
    1:  [26,  10, 1, 16, 0, 0,  []],
    2:  [44,  16, 1, 28, 0, 0,  [6, 18]],
    3:  [70,  26, 1, 44, 0, 0,  [6, 22]],
    4:  [100, 18, 2, 32, 0, 0,  [6, 26]],
    5:  [134, 24, 2, 43, 0, 0,  [6, 30]],
    6:  [172, 16, 4, 27, 0, 0,  [6, 34]],
    7:  [196, 18, 4, 31, 0, 0,  [6, 22, 38]],
    8:  [242, 22, 2, 38, 2, 39, [6, 24, 42]],
    9:  [292, 22, 3, 36, 2, 37, [6, 26, 46]],
    10: [346, 26, 4, 43, 1, 44, [6, 28, 50]]
  };

  function utf8Bytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(++i);
        var cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
        bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      } else {
        bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return bytes;
  }

  function pickVersion(byteLen) {
    for (var v = 1; v <= 10; v++) {
      var spec = VERSIONS[v];
      var dataCap = spec[2] * spec[3] + spec[4] * spec[5];
      var headerBits = 4 + (v <= 9 ? 8 : 16);
      if (headerBits + byteLen * 8 <= dataCap * 8) return v;
    }
    return 10;
  }

  function buildCodewords(bytes, version) {
    var spec = VERSIONS[version];
    var dataCap = spec[2] * spec[3] + spec[4] * spec[5];
    var bits = [];
    function pushBits(val, len) {
      for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
    }
    pushBits(0b0100, 4); // Byte mode
    pushBits(bytes.length, version <= 9 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);
    var maxBits = dataCap * 8;
    var term = Math.min(4, maxBits - bits.length);
    for (var t = 0; t < term; t++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    var data = [];
    for (var b = 0; b < bits.length; b += 8) {
      var byteVal = 0;
      for (var k = 0; k < 8; k++) byteVal = (byteVal << 1) | bits[b + k];
      data.push(byteVal);
    }
    var pads = [0xec, 0x11];
    var pi = 0;
    while (data.length < dataCap) {
      data.push(pads[pi & 1]);
      pi++;
    }

    // Split blocks & compute RS EC
    var ecLen = spec[1];
    var blocks = [];
    var ecs = [];
    var offset = 0;
    var groups = [
      [spec[2], spec[3]],
      [spec[4], spec[5]]
    ];
    for (var g = 0; g < groups.length; g++) {
      for (var bi = 0; bi < groups[g][0]; bi++) {
        var blk = data.slice(offset, offset + groups[g][1]);
        offset += groups[g][1];
        blocks.push(blk);
        ecs.push(rsEncode(blk, ecLen));
      }
    }

    var out = [];
    var maxData = Math.max(spec[3], spec[5]);
    for (var di = 0; di < maxData; di++) {
      for (var j = 0; j < blocks.length; j++) {
        if (di < blocks[j].length) out.push(blocks[j][di]);
      }
    }
    for (var ei = 0; ei < ecLen; ei++) {
      for (var j2 = 0; j2 < ecs.length; j2++) {
        out.push(ecs[j2][ei]);
      }
    }
    return out;
  }

  function formatBits(mask) {
    // EC level M = 00
    var data = (0b00 << 3) | mask;
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >> 9) & 1) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  }

  function versionBits(v) {
    var rem = v;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ (((rem >> 11) & 1) * 0x1f25);
    return (v << 12) | rem;
  }

  function makeMatrix(text) {
    var bytes = utf8Bytes(String(text || ''));
    var version = pickVersion(bytes.length);
    var size = version * 4 + 17;
    var codewords = buildCodewords(bytes, version);

    var mod = [];
    var isFunc = [];
    for (var r = 0; r < size; r++) {
      mod.push(new Uint8Array(size));
      isFunc.push(new Uint8Array(size));
    }

    function setFunc(r, c, dark) {
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      mod[r][c] = dark ? 1 : 0;
      isFunc[r][c] = 1;
    }

    function drawFinder(r0, c0) {
      for (var dr = -1; dr <= 7; dr++) {
        for (var dc = -1; dc <= 7; dc++) {
          var r = r0 + dr, c = c0 + dc;
          if (r < 0 || c < 0 || r >= size || c >= size) continue;
          var dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
          var dark = dist !== 2 && dist !== 4;
          setFunc(r, c, dark);
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Timing patterns
    for (var i = 8; i < size - 8; i++) {
      setFunc(6, i, i % 2 === 0);
      setFunc(i, 6, i % 2 === 0);
    }

    // Alignment patterns
    var coords = VERSIONS[version][6];
    for (var a = 0; a < coords.length; a++) {
      for (var b = 0; b < coords.length; b++) {
        var ar = coords[a], ac = coords[b];
        if ((ar === 6 && ac === 6) || (ar === 6 && ac === size - 7) || (ar === size - 7 && ac === 6)) continue;
        for (var dr2 = -2; dr2 <= 2; dr2++) {
          for (var dc2 = -2; dc2 <= 2; dc2++) {
            var d = Math.max(Math.abs(dr2), Math.abs(dc2));
            setFunc(ar + dr2, ac + dc2, d !== 1);
          }
        }
      }
    }

    // Reserve format & dark module
    for (var f = 0; f <= 8; f++) {
      if (f !== 6) { setFunc(8, f, false); setFunc(f, 8, false); }
    }
    for (var f2 = 0; f2 < 8; f2++) {
      setFunc(8, size - 1 - f2, false);
      setFunc(size - 1 - f2, 8, false);
    }
    setFunc(size - 8, 8, true);

    // Version info for v >= 7
    if (version >= 7) {
      var vbits = versionBits(version);
      for (var vi = 0; vi < 18; vi++) {
        var darkV = ((vbits >> vi) & 1) !== 0;
        var vr = Math.floor(vi / 3);
        var vc = size - 11 + (vi % 3);
        setFunc(vr, vc, darkV);
        setFunc(vc, vr, darkV);
      }
    }

    // Place data bits
    var bitIdx = 0;
    var totalBits = codewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      var upward = ((right + 1) & 2) === 0;
      for (var step = 0; step < size; step++) {
        var row = upward ? size - 1 - step : step;
        for (var dx = 0; dx < 2; dx++) {
          var col = right - dx;
          if (!isFunc[row][col]) {
            var bit = 0;
            if (bitIdx < totalBits) {
              bit = (codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
              bitIdx++;
            }
            mod[row][col] = bit;
          }
        }
      }
    }

    // Apply Mask 0 ((r + c) % 2 === 0) and write format info (reliable & fast)
    var mask = 0;
    for (var mr = 0; mr < size; mr++) {
      for (var mc = 0; mc < size; mc++) {
        if (!isFunc[mr][mc] && ((mr + mc) % 2 === 0)) {
          mod[mr][mc] ^= 1;
        }
      }
    }

    var fbits = formatBits(mask);
    for (var fi = 0; fi < 15; fi++) {
      var fb = (fbits >> fi) & 1;
      // Vertical strip
      if (fi < 6) mod[fi][8] = fb;
      else if (fi < 8) mod[fi + 1][8] = fb;
      else mod[size - 15 + fi][8] = fb;
      // Horizontal strip
      if (fi < 8) mod[8][size - 1 - fi] = fb;
      else if (fi < 9) mod[8][15 - fi] = fb;
      else mod[8][14 - fi] = fb;
    }

    return mod;
  }

  function toSVG(text, opts) {
    opts = opts || {};
    var size = opts.size || 160;
    var fg = opts.fg || '#161618';
    var bg = opts.bg || '#ffffff';
    var quiet = opts.margin !== undefined ? opts.margin : 2;
    var mat = makeMatrix(text);
    var n = mat.length;
    var total = n + quiet * 2;
    var paths = [];
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        if (mat[r][c]) {
          paths.push('M' + (c + quiet) + ',' + (r + quiet) + 'h1v1h-1z');
        }
      }
    }
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" width="' + size + '" height="' + size + '" shape-rendering="crispEdges" role="img" aria-label="二维码">' +
      '<rect width="' + total + '" height="' + total + '" fill="' + bg + '"/>' +
      '<path d="' + paths.join('') + '" fill="' + fg + '"/>' +
      '</svg>'
    );
  }

  root.MujianQR = {
    makeMatrix: makeMatrix,
    toSVG: toSVG
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
