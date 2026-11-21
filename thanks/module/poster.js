const illustrations = new Map();

function loadIllustration(url) {
  if (!illustrations.has(url)) {
    const image = new Image();
    image.src = url;
    const loaded = image.decode().then(() => image).catch(error => {
      illustrations.delete(url);
      throw error;
    });
    illustrations.set(url, loaded);
  }
  return illustrations.get(url);
}

function paintIllustration(context, image, layer) {
  const { x, y, width, height, color, opacity, angle } = layer;
  if (!width || !height) return;
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const mask = document.createElement('canvas');
  mask.width = Math.ceil(drawWidth * 3);
  mask.height = Math.ceil(drawHeight * 3);
  const ink = mask.getContext('2d');
  ink.drawImage(image, 0, 0, mask.width, mask.height);
  ink.globalCompositeOperation = 'source-in';
  ink.fillStyle = color;
  ink.fillRect(0, 0, mask.width, mask.height);
  context.save();
  context.globalAlpha = opacity;
  context.translate(x, y);
  context.rotate(angle);
  context.drawImage(mask, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  context.restore();
}

// Use the browser's line breaks, including long nicknames and mixed scripts.
function measureText(element, bounds) {
  const node = element.firstChild;
  const range = document.createRange();
  const lines = [];
  let offset = 0;
  const pieces = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter().segment(node.data), piece => piece.segment)
    : Array.from(node.data);
  for (const piece of pieces) {
    range.setStart(node, offset);
    offset += piece.length;
    range.setEnd(node, offset);
    const box = range.getBoundingClientRect();
    if (box.width < .01 && !lines.length) continue;
    const top = box.top - bounds.top;
    const current = lines.at(-1);
    if (current && Math.abs(current.top - top) < 1) current.text += piece;
    else lines.push({ text: piece, x: box.left - bounds.left, top, height: box.height });
  }
  const style = getComputedStyle(element);
  return {
    lines, color: style.color, spacing: style.letterSpacing,
    font: `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
  };
}

export async function renderPoster(card) {
  const bounds = card.getBoundingClientRect();
  if (!bounds.width || !bounds.height) throw new Error('Poster is not visible');
  const scale = 1200 / bounds.width;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = Math.ceil(bounds.height * scale);
  const context = canvas.getContext('2d');
  context.scale(scale, scale);

  const cardStyle = getComputedStyle(card);
  const paper = card.querySelector('.cm-card-paper');
  const paperBox = paper.getBoundingClientRect();
  context.fillStyle = cardStyle.getPropertyValue('--cm-card-magenta');
  context.fillRect(0, 0, bounds.width, canvas.height / scale);
  context.fillStyle = getComputedStyle(paper).backgroundColor;
  const paperRect = [paperBox.left - bounds.left, paperBox.top - bounds.top, paperBox.width, paperBox.height];
  context.fillRect(...paperRect);
  const text = [...card.querySelectorAll('.cm-card-text :is(p,h2,h3)')].map(element => measureText(element, bounds));
  const rules = [...card.querySelectorAll('.cm-card-person,.cm-card-exhibition')].map(element => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const weight = parseFloat(style.borderBottomWidth);
    return { x: box.left - bounds.left, y: box.bottom - bounds.top - weight, width: box.width, weight, color: style.borderBottomColor };
  });
  const layers = [...card.querySelectorAll('.cm-art')].map(element => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const transform = style.transform === 'none' ? null : new DOMMatrix(style.transform);
    return {
      url: element.dataset.asset, color: style.color, inPaper: paper.contains(element),
      x: box.left + box.width / 2 - bounds.left,
      y: box.top + box.height / 2 - bounds.top,
      width: element.offsetWidth, height: element.offsetHeight,
      angle: transform ? Math.atan2(transform.b, transform.a) : 0,
      opacity: Number(style.opacity) * Number(getComputedStyle(element.parentElement).opacity),
    };
  });
  const images = await Promise.all(layers.map(layer => loadIllustration(layer.url)));
  layers.forEach((layer, index) => {
    if (layer.inPaper) {
      context.save();
      context.beginPath();
      context.rect(...paperRect);
      context.clip();
    }
    paintIllustration(context, images[index], layer);
    if (layer.inPaper) context.restore();
  });
  rules.forEach(rule => {
    context.fillStyle = rule.color;
    context.fillRect(rule.x, rule.y, rule.width, rule.weight);
  });
  context.textBaseline = 'middle';
  text.forEach(({ lines, color, font, spacing }) => {
    context.font = font;
    context.fillStyle = color;
    if ('letterSpacing' in context) context.letterSpacing = spacing === 'normal' ? '0px' : spacing;
    lines.forEach(line => context.fillText(line.text, line.x, line.top + line.height / 2));
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode poster')), 'image/png');
  });
}
