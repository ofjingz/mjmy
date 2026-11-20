import { contributors, acknowledgments, exhibition } from './data.js';

const styleURL = new URL('./credits.css', import.meta.url).href;
const assetRoot = new URL('./assets/', import.meta.url);
let instanceCount = 0;

export function shuffleNames(names, random = Math.random) {
  const result = [...names];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function create(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** A framework-independent, style-isolated end-credits module. */
export function mountCredits(container, options = {}) {
  if (!(container instanceof Element)) throw new TypeError('mountCredits needs a DOM container');
  const names = [...(options.contributors ?? contributors)];
  const thanks = [...(options.acknowledgments ?? acknowledgments)];
  const content = { ...exhibition, ...options.exhibition };
  if (!names.length || names.some(name => typeof name !== 'string' || !name.trim())) {
    throw new TypeError('contributors must contain non-empty names');
  }
  if (thanks.some(name => typeof name !== 'string' || !name.trim())) {
    throw new TypeError('acknowledgments must contain non-empty names');
  }
  const id = `mujian-credits-${++instanceCount}`;
  const host = create('div', 'mujian-credits');
  const root = host.attachShadow({ mode: 'open' });
  const stylesheet = create('link');
  stylesheet.rel = 'stylesheet';
  stylesheet.href = styleURL;
  root.append(stylesheet);
  container.append(host);

  const shell = create('section', 'cm-shell');
  shell.setAttribute('aria-label', '幕间漫游 共创者与特别鸣谢');
  shell.dataset.section = 'contributors';
  root.append(shell);
  const abort = new AbortController();
  const listen = (target, event, listener, extra = {}) => target.addEventListener(event, listener, { signal: abort.signal, ...extra });
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = options.reducedMotion ?? media.matches;
  let order = shuffleNames(names, options.random);
  let depths = new Map();
  let variations = new Map();
  let section = 'contributors';
  let selectedName = null;
  let selectedButton = null;
  let lanes = [];
  let laneLayout = '';
  let destroyed = false;
  let raf = 0;
  let lastTime = 0;
  let openingTimer = 0;
  let cardActive = false;
  let keyboardMode = false;
  let intersecting = true;
  let speedScale = 1;
  let targetSpeed = 1;
  let litButton = null;
  let thanksEpoch = performance.now();
  let thanksCenters = [];
  let lastLightUpdate = 0;
  let resolveReady;
  const pauses = new Set();

  function assignDepths() {
    const near = Math.round(names.length * .2);
    const mid = Math.round(names.length * .5);
    const deck = shuffleNames([
      ...Array(near).fill('near'),
      ...Array(mid).fill('mid'),
      ...Array(Math.max(0, names.length - near - mid)).fill('far'),
    ], options.random);
    const random = options.random ?? Math.random;
    depths = new Map(order.map((name, index) => [name, deck[index]]));
    variations = new Map(order.map(name => [name, {
      x: (random() - .5) * 11,
      y: (random() - .5) * 30,
      phase: -random() * 12,
    }]));
  }
  assignDepths();

  const emit = (type, detail = {}) => host.dispatchEvent(new CustomEvent(`credits:${type}`, { detail, bubbles: true, composed: true }));
  function motif(name, className, parent, { tint = true } = {}) {
    const image = create('span', `cm-art ${className}`);
    image.setAttribute('aria-hidden', 'true');
    const url = new URL(`${name}.svg`, assetRoot).href;
    if (tint) image.style.setProperty('--art', `url("${url}")`);
    else {
      const img = create('img');
      img.src = url;
      img.alt = '';
      image.append(img);
    }
    parent.append(image);
    return image;
  }

  const atmosphere = create('div', 'cm-atmosphere');
  atmosphere.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 3; index++) atmosphere.append(create('span', `cm-atmosphere-blob cm-atmosphere-blob-${index + 1}`));
  atmosphere.append(create('span', 'cm-grain'));
  shell.append(atmosphere);
  const backdrop = create('div', 'cm-collage');
  backdrop.setAttribute('aria-hidden', 'true');
  motif('moon', 'cm-bg-moon', backdrop);
  motif('pickaxe', 'cm-bg-pickaxe', backdrop);
  motif('tree', 'cm-bg-tree', backdrop);
  motif('head', 'cm-bg-head', backdrop);
  motif('hand', 'cm-bg-hand', backdrop);
  shell.append(backdrop);

  const header = create('header', 'cm-header');
  const brand = create('div', 'cm-brand');
  brand.setAttribute('role', 'img');
  brand.setAttribute('aria-label', '幕间漫游 Roaming in the movie');
  motif('orbit-logo', 'cm-orbit-logo', brand);
  const title = create('span', 'cm-title', '幕间漫游');
  brand.append(title);
  header.append(brand);
  const navigation = create('nav', 'cm-nav');
  navigation.setAttribute('aria-label', '片尾章节');
  const contributorsTab = create('button', 'cm-tab', '共创者');
  const thanksTab = create('button', 'cm-tab', '特别鸣谢');
  contributorsTab.type = thanksTab.type = 'button';
  contributorsTab.setAttribute('aria-controls', `${id}-contributors`);
  thanksTab.setAttribute('aria-controls', `${id}-thanks`);
  contributorsTab.setAttribute('aria-pressed', 'true');
  thanksTab.setAttribute('aria-pressed', 'false');
  navigation.append(contributorsTab, thanksTab);
  header.append(navigation);
  shell.append(header);

  const contributorSection = create('section', 'cm-contributors');
  contributorSection.id = `${id}-contributors`;
  contributorSection.setAttribute('aria-label', '共创者');
  const nameBeam = create('span', 'cm-name-beam');
  nameBeam.setAttribute('aria-hidden', 'true');
  contributorSection.append(nameBeam);
  const flow = create('div', 'cm-flow');
  flow.setAttribute('aria-label', '共创者姓名');
  contributorSection.append(flow);
  shell.append(contributorSection);

  const thanksSection = create('section', 'cm-thanks');
  thanksSection.id = `${id}-thanks`;
  thanksSection.setAttribute('aria-labelledby', `${id}-thanks-title`);
  thanksSection.hidden = true;
  const thanksHeading = create('div', 'cm-thanks-heading');
  motif('lamp', 'cm-thanks-lamp', thanksHeading);
  const thanksTitle = create('h1', 'cm-thanks-title', '特别鸣谢');
  thanksTitle.id = `${id}-thanks-title`;
  thanksHeading.append(thanksTitle);
  thanksSection.append(thanksHeading);
  const thanksPaper = create('div', 'cm-thanks-paper');
  const thanksList = create('ol', 'cm-thanks-list');
  const roamingBeams = [create('span', 'cm-roaming-beam'), create('span', 'cm-roaming-beam')];
  roamingBeams.forEach(beam => { beam.setAttribute('aria-hidden', 'true'); thanksPaper.append(beam); });
  const thanksItems = thanks.map((name, index) => {
    const item = create('li', 'cm-thanks-name');
    item.style.setProperty('--thanks-row', Math.floor(index / 4));
    item.style.setProperty('--thanks-column', index % 4);
    item.style.setProperty('--thanks-delay', `${Math.floor(index / 4) * .12}s`);
    item.append(create('span', 'cm-thanks-name-text', name));
    thanksList.append(item);
    return item;
  });
  thanksPaper.append(thanksList);
  const thanksArt = create('div', 'cm-thanks-art');
  thanksArt.setAttribute('aria-hidden', 'true');
  motif('typewriter', 'cm-thanks-typewriter', thanksArt);
  motif('sprig', 'cm-thanks-sprig', thanksArt);
  motif('moon', 'cm-thanks-moon', thanksArt);
  motif('tree', 'cm-thanks-tree', thanksArt);
  thanksPaper.append(thanksArt);
  thanksSection.append(thanksPaper);
  shell.append(thanksSection);

  const dialog = create('dialog', 'cm-dialog');
  dialog.setAttribute('aria-labelledby', `${id}-card-name`);
  dialog.setAttribute('aria-describedby', `${id}-card-title`);
  const card = create('article', 'cm-card');
  const cardHeader = create('header', 'cm-card-header');
  const cardBrand = create('div', 'cm-card-brand');
  cardBrand.setAttribute('role', 'img');
  cardBrand.setAttribute('aria-label', '幕间漫游');
  motif('orbit-logo', 'cm-card-logo', cardBrand);
  cardHeader.append(cardBrand);
  const closeButton = create('button', 'cm-close', '关闭');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', '关闭个人展览卡');
  cardHeader.append(closeButton);
  card.append(cardHeader);
  const paper = create('div', 'cm-card-paper');
  const cardArt = create('div', 'cm-card-art');
  cardArt.setAttribute('aria-hidden', 'true');
  motif('hand-bone', 'cm-card-bone', cardArt);
  motif('tree', 'cm-card-tree', cardArt);
  motif('drum', 'cm-card-drum', cardArt);
  motif('sprig', 'cm-card-sprig', cardArt);
  motif('pickaxe', 'cm-card-pickaxe', cardArt);
  motif('moon', 'cm-card-moon', cardArt);
  motif('typewriter', 'cm-card-typewriter', cardArt);
  motif('hand', 'cm-card-hand', cardArt);
  motif('head', 'cm-card-head', cardArt);
  motif('figure', 'cm-card-figure', cardArt);
  paper.append(cardArt);
  const lampLight = create('span', 'cm-card-lamp-light');
  lampLight.setAttribute('aria-hidden', 'true');
  paper.append(lampLight);
  motif('lamp', 'cm-card-lamp', paper);
  const cardText = create('div', 'cm-card-text');
  const nameGroup = create('div', 'cm-card-person');
  nameGroup.append(create('p', 'cm-card-label', '共创者'));
  const cardName = create('h2', 'cm-card-name');
  cardName.id = `${id}-card-name`;
  nameGroup.append(cardName);
  const titleGroup = create('div', 'cm-card-exhibition');
  titleGroup.id = `${id}-card-title`;
  titleGroup.append(create('p', 'cm-card-label', '公益展览'), create('h3', 'cm-exhibition-title', content.title), create('p', 'cm-exhibition-subtitle', content.subtitle));
  const exhibitionDate = create('div', 'cm-card-date');
  exhibitionDate.append(create('p', 'cm-card-label', '展览时间'), create('p', 'cm-date-value', content.exhibitionTime));
  cardText.append(nameGroup, titleGroup, exhibitionDate);
  paper.append(cardText);
  card.append(paper);
  const cardFooter = create('footer', 'cm-card-footer');
  motif('footer-credits', 'cm-footer-credits', cardFooter);
  motif('footer-logos', 'cm-footer-logos', cardFooter);
  card.append(cardFooter);
  dialog.append(card);
  shell.append(dialog);

  function isPaused() {
    return pauses.size > 0 || section !== 'contributors' || reduced || !intersecting || document.hidden;
  }

  function canAnimate() { return !destroyed && !reduced && intersecting && !document.hidden; }

  function positionNameLight() {
    if (!litButton?.isConnected) return;
    const box = litButton.getBoundingClientRect();
    const frame = contributorSection.getBoundingClientRect();
    nameBeam.style.setProperty('--beam-x', `${box.left + box.width / 2 - frame.left}px`);
    nameBeam.style.setProperty('--beam-y', `${box.top + box.height / 2 - frame.top}px`);
  }

  function lightName(button) {
    if (litButton !== button) litButton?.classList.remove('is-lit');
    litButton = button;
    litButton?.classList.add('is-lit');
    shell.dataset.spotlight = String(Boolean(button));
    if (button) positionNameLight();
  }

  function measureThanks() {
    if (destroyed || section !== 'thanks') return;
    const frame = thanksPaper.getBoundingClientRect();
    if (!frame.width || !frame.height) return;
    thanksCenters = thanksItems.map(item => {
      const rect = item.getBoundingClientRect();
      return { x: (rect.left + rect.width / 2 - frame.left) / frame.width * 100, y: (rect.top + rect.height / 2 - frame.top) / frame.height * 100 };
    });
  }

  function roamLights(time) {
    const seconds = (time - thanksEpoch) / 1000;
    const positions = [
      { x: 50 + 35 * Math.sin(seconds * .17 - 1.2), y: 48 + 32 * Math.sin(seconds * .23 + .7) },
      { x: 50 + 31 * Math.sin(seconds * .13 + 1.8), y: 48 + 29 * Math.sin(seconds * .19 + 3.1) },
    ];
    roamingBeams.forEach((beam, index) => {
      beam.style.setProperty('--roam-x', `${positions[index].x}%`);
      beam.style.setProperty('--roam-y', `${positions[index].y}%`);
    });
    if (time - lastLightUpdate > 80) {
      if (!thanksCenters.length) measureThanks();
      thanksItems.forEach((item, index) => {
        const center = thanksCenters[index];
        if (!center) return;
        const intensity = Math.max(...positions.map(position => Math.exp(-(((center.x - position.x) / 25) ** 2 + ((center.y - position.y) / 24) ** 2) * 1.7)));
        item.style.setProperty('--lit', intensity.toFixed(3));
      });
      lastLightUpdate = time;
    }
  }

  function tick(time) {
    if (!canAnimate()) { raf = 0; lastTime = 0; return; }
    const elapsed = lastTime ? Math.min(time - lastTime, 50) / 1000 : 0;
    lastTime = time;
    speedScale += (targetSpeed - speedScale) * (1 - Math.exp(-elapsed / .23));
    if (Math.abs(speedScale - targetSpeed) < .002) speedScale = targetSpeed;
    if (section === 'thanks') roamLights(time);
    else {
      if (speedScale > .001) lanes.forEach(lane => {
        lane.offset += elapsed * lane.speed * lane.sign * speedScale;
        // Keep the real focused/selected copy in place while easing to a stop.
        // Period normalization is visually safe again after interaction ends.
        if (targetSpeed > 0) lane.offset = (lane.offset % lane.size + lane.size) % lane.size;
        applyPosition(lane);
      });
      positionNameLight();
    }
    if (section === 'thanks' || speedScale > .001 || targetSpeed > 0) raf = requestAnimationFrame(tick);
    else { raf = 0; lastTime = 0; }
  }

  function syncMotion() {
    targetSpeed = isPaused() ? 0 : 1;
    if (!canAnimate()) {
      cancelAnimationFrame(raf);
      raf = 0;
      lastTime = 0;
      speedScale = 0;
    } else if (!raf && (section === 'thanks' || speedScale > .001 || targetSpeed > 0)) raf = requestAnimationFrame(tick);
    shell.dataset.paused = String(isPaused());
  }

  function applyPosition(lane) {
    const position = lane.offset - lane.size;
    lane.track.style.transform = lane.vertical ? `translate3d(0,${position}px,0)` : `translate3d(${position}px,0,0)`;
  }

  function measureLanes() {
    lanes.forEach(lane => {
      const previous = lane.size;
      lane.size = Math.max(1, lane.vertical ? lane.group.offsetHeight : lane.group.offsetWidth);
      lane.offset = previous ? lane.offset / previous * lane.size : lane.size * lane.phase;
      const extent = lane.vertical ? lane.element.clientHeight : lane.element.clientWidth;
      const copies = Math.max(2, Math.ceil(extent / lane.size) + 2);
      while (lane.track.children.length > copies) lane.track.lastElementChild.remove();
      while (lane.track.children.length < copies) {
        const duplicate = lane.group.cloneNode(true);
        duplicate.setAttribute('aria-hidden', 'true');
        duplicate.querySelectorAll('button').forEach(button => { button.tabIndex = -1; });
        lane.track.append(duplicate);
      }
      applyPosition(lane);
    });
    syncMotion();
  }

  function nameButton(name, duplicate = false) {
    const button = create('button', 'cm-name');
    button.append(create('span', 'cm-name-text', name));
    button.type = 'button';
    button.dataset.name = name;
    button.dataset.depth = depths.get(name) ?? 'mid';
    const variation = variations.get(name);
    button.style.setProperty('--name-drift-x', `${variation?.x ?? 0}px`);
    button.style.setProperty('--name-drift-y', `${variation?.y ?? 0}px`);
    button.style.setProperty('--name-phase', `${variation?.phase ?? 0}s`);
    button.setAttribute('aria-label', `查看${name}的展览卡`);
    if (duplicate) button.tabIndex = -1;
    if (Array.from(name).length > 7) button.classList.add('cm-name-long');
    return button;
  }

  function buildFlow(force = false) {
    const width = shell.clientWidth;
    const vertical = width < 760;
    const count = vertical ? 3 : 6;
    const key = `${vertical}-${count}-${reduced}`;
    if (!force && key === laneLayout) { measureLanes(); return; }
    laneLayout = key;
    pauses.delete('hover');
    pauses.delete('press');
    pauses.delete('focus');
    lightName(null);
    flow.replaceChildren();
    lanes = [];
    shell.dataset.direction = vertical ? 'vertical' : 'horizontal';
    shell.dataset.reducedMotion = String(reduced);
    if (reduced) {
      const staticList = create('div', 'cm-static-list');
      order.forEach(name => staticList.append(nameButton(name)));
      flow.append(staticList);
      syncMotion();
      return;
    }
    flow.style.setProperty('--lanes', count);
    const laneDepths = vertical ? ['near', 'mid', 'far'] : ['near', 'mid', 'far', 'mid', 'far', 'mid'];
    for (let index = 0; index < count; index++) {
      const lane = create('div', 'cm-lane');
      const depth = laneDepths[index];
      lane.dataset.depth = depth;
      const track = create('div', 'cm-track');
      const group = create('div', 'cm-group');
      const duplicate = create('div', 'cm-group');
      duplicate.setAttribute('aria-hidden', 'true');
      const peers = laneDepths.map((value, position) => value === depth ? position : -1).filter(position => position !== -1);
      const position = peers.indexOf(index);
      order.filter(name => depths.get(name) === depth).filter((_, nameIndex) => nameIndex % peers.length === position).forEach(name => {
        group.append(nameButton(name));
        duplicate.append(nameButton(name, true));
      });
      track.append(group, duplicate);
      lane.append(track);
      flow.append(lane);
      const speed = { near: 20, mid: 13, far: 8 }[depth] * (1 + index * .025);
      lanes.push({ element: lane, track, group, vertical, size: 0, offset: 0, phase: (0.12 + index * .17) % 1, speed, sign: vertical || index % 2 === 0 ? 1 : -1 });
    }
    measureLanes();
    if (cardActive && selectedName) {
      selectedButton = [...flow.querySelectorAll('.cm-name')].find(button => button.dataset.name === selectedName && button.tabIndex !== -1);
      selectedButton?.classList.add('is-selected');
      lightName(selectedButton);
    }
  }

  function pause(reason = 'api') { pauses.add(reason); syncMotion(); }
  function resume(reason = 'api') { pauses.delete(reason); syncMotion(); }

  function revealFocused(button) {
    const lane = lanes.find(item => item.element.contains(button));
    if (!lane) return;
    const box = button.getBoundingClientRect();
    const bounds = lane.element.getBoundingClientRect();
    if (lane.vertical ? box.top < bounds.top || box.bottom > bounds.bottom : box.left < bounds.left || box.right > bounds.right) {
      const delta = lane.vertical ? (bounds.top + bounds.height / 2) - (box.top + box.height / 2) : (bounds.left + bounds.width / 2) - (box.left + box.width / 2);
      // While keyboard focus holds the lane still, reveal the actual focusable
      // first-copy button. Normalizing here would reveal its aria-hidden twin.
      lane.offset += delta;
      applyPosition(lane);
    }
  }

  function closeCard() {
    clearTimeout(openingTimer);
    openingTimer = 0;
    if (dialog.open) dialog.close();
    else finishClose();
  }

  function finishClose() {
    if (destroyed || openingTimer || dialog.open || !cardActive) return;
    cardActive = false;
    shell.dataset.cardOpen = 'false';
    shell.dataset.cardVisible = 'false';
    root.querySelectorAll('.cm-name.is-selected').forEach(button => button.classList.remove('is-selected'));
    lightName(null);
    resume('card');
    if (keyboardMode && selectedButton) {
      revealFocused(selectedButton);
      selectedButton.focus({ preventScroll: true });
      lightName(selectedButton);
    }
    if (!keyboardMode) resume('focus');
    emit('close', { name: selectedName });
  }

  function openContributor(name, button = null) {
    if (destroyed || !names.includes(name)) return false;
    clearTimeout(openingTimer);
    root.querySelectorAll('.cm-name.is-selected').forEach(item => item.classList.remove('is-selected'));
    selectedName = name;
    cardActive = true;
    selectedButton = button ?? [...flow.querySelectorAll('.cm-name')].find(item => item.dataset.name === name && item.tabIndex !== -1);
    selectedButton?.classList.add('is-selected');
    lightName(selectedButton);
    cardName.textContent = name;
    cardName.dataset.length = String(Array.from(name).length);
    nameGroup.classList.toggle('cm-card-person-long', Array.from(name).length > 7);
    cardName.style.setProperty('--name-scale', Array.from(name).length > 7 ? '7.3cqw' : Array.from(name).length > 4 ? '10cqw' : '13cqw');
    pause('card');
    shell.dataset.cardOpen = 'true';
    emit('select', { name });
    openingTimer = window.setTimeout(() => {
      openingTimer = 0;
      if (!destroyed && !dialog.open) {
        dialog.showModal();
        shell.dataset.cardVisible = 'true';
        closeButton.focus({ preventScroll: true });
      }
    }, reduced ? 0 : 360);
    return true;
  }

  function showSection(next) {
    if (destroyed || !['contributors', 'thanks'].includes(next) || next === section) return;
    closeCard();
    pauses.delete('hover');
    pauses.delete('focus');
    lightName(null);
    section = next;
    shell.dataset.section = next;
    contributorSection.hidden = next !== 'contributors';
    thanksSection.hidden = next !== 'thanks';
    contributorsTab.setAttribute('aria-pressed', String(next === 'contributors'));
    thanksTab.setAttribute('aria-pressed', String(next === 'thanks'));
    if (next === 'contributors') {
      order = shuffleNames(names, options.random);
      assignDepths();
      buildFlow(true);
    } else {
      thanksEpoch = performance.now();
      lastLightUpdate = 0;
      thanksCenters = [];
      measureThanks();
      if (!reduced) roamLights(thanksEpoch);
    }
    syncMotion();
    emit('sectionchange', { section: next });
  }

  listen(contributorsTab, 'click', () => showSection('contributors'));
  listen(thanksTab, 'click', () => showSection('thanks'));
  listen(closeButton, 'click', closeCard);
  listen(dialog, 'close', finishClose);
  listen(dialog, 'click', event => { if (event.target === dialog) closeCard(); });
  listen(flow, 'pointerdown', event => {
    keyboardMode = false;
    const button = event.target.closest('.cm-name');
    if (button) {
      pause('press');
      lightName(button);
      // Loop copies remain pointer targets but never steal accessible focus.
      if (button.closest('[aria-hidden="true"]')) event.preventDefault();
    }
  });
  listen(window, 'pointerup', () => resume('press'));
  listen(window, 'pointercancel', () => {
    resume('press');
    if (!cardActive && !pauses.has('hover') && !pauses.has('focus')) lightName(null);
  });
  listen(flow, 'click', event => {
    const button = event.target.closest('.cm-name');
    if (button) openContributor(button.dataset.name, button);
  });
  listen(flow, 'pointerover', event => {
    const button = event.target.closest('.cm-name');
    if (event.pointerType === 'mouse' && button) { lightName(button); pause('hover'); }
  });
  listen(flow, 'pointerout', event => {
    if (!event.relatedTarget?.closest?.('.cm-name')) {
      resume('hover');
      if (!cardActive && !pauses.has('focus') && !pauses.has('press')) lightName(null);
    }
  });
  listen(root, 'keydown', event => {
    if (event.key === 'Tab' || event.key.startsWith('Arrow')) keyboardMode = true;
    if (event.key === 'Escape' && openingTimer) closeCard();
  });
  listen(flow, 'focusin', event => {
    if (keyboardMode && event.target.matches('.cm-name')) {
      pause('focus');
      revealFocused(event.target);
      lightName(event.target);
    }
  });
  listen(flow, 'focusout', event => {
    if (!flow.contains(event.relatedTarget)) {
      resume('focus');
      if (!cardActive && !pauses.has('hover')) lightName(null);
    }
  });
  listen(document, 'visibilitychange', syncMotion);
  const changeMotion = () => {
    reduced = options.reducedMotion ?? media.matches;
    buildFlow(true);
  };
  media.addEventListener('change', changeMotion);
  const resize = new ResizeObserver(() => {
    if (!destroyed) {
      if (section === 'contributors') buildFlow();
      else measureThanks();
    }
  });
  resize.observe(shell);
  const visibility = new IntersectionObserver(entries => {
    intersecting = entries[0]?.isIntersecting ?? true;
    syncMotion();
  });
  visibility.observe(host);
  const ready = new Promise(resolve => {
    resolveReady = resolve;
    const finish = () => {
      if (destroyed) return resolve();
      buildFlow(true);
      emit('ready', { contributors: names.length, acknowledgments: thanks.length });
      resolve();
    };
    stylesheet.addEventListener('load', finish, { once: true });
    stylesheet.addEventListener('error', finish, { once: true });
  });
  document.fonts?.ready.then(() => { if (!destroyed) { measureLanes(); measureThanks(); } });
  const api = {
    host, ready, showSection, openContributor, closeCard,
    pause: () => pause(),
    resume: () => resume(),
    reshuffle() { if (!destroyed) { order = shuffleNames(names, options.random); assignDepths(); buildFlow(true); } },
    getState: () => ({ section, selectedName, cardOpen: dialog.open, paused: isPaused(), reducedMotion: reduced, direction: shell.dataset.direction, order: [...order], contributors: names.length, acknowledgments: thanks.length }),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(openingTimer);
      cancelAnimationFrame(raf);
      if (dialog.open) dialog.close();
      abort.abort();
      resize.disconnect();
      visibility.disconnect();
      media.removeEventListener('change', changeMotion);
      host.remove();
      lanes = [];
      thanksCenters = [];
      resolveReady?.();
    },
  };
  return api;
}
