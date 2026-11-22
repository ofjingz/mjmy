(function () {
  'use strict';

  var root = document.documentElement;
  var intro = document.getElementById('filmIntro');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var navigation = performance.getEntriesByType('navigation')[0];

  function releaseCurtain() {
    root.classList.remove('has-film-intro');
  }

  if (!intro || typeof intro.showModal !== 'function' || reducedMotion.matches || location.hash ||
      (navigation && navigation.type === 'back_forward')) {
    releaseCurtain();
    return;
  }

  var frames = intro.querySelector('.film-intro__frames');
  var skip = intro.querySelector('.film-intro__skip');
  var loadTimer;
  var playbackTimer;
  var closingTimer;
  var started = false;

  function closeIntro() {
    clearTimeout(loadTimer);
    clearTimeout(playbackTimer);
    clearTimeout(closingTimer);
    releaseCurtain();
    if (intro.open) intro.close();
    intro.classList.remove('is-playing', 'is-ending');
    document.body.classList.remove('intro-open');
  }

  function fadeOut() {
    if (!intro.open || intro.classList.contains('is-ending')) return;
    // Reveal the page underneath the opaque dialog just before fading it out.
    releaseCurtain();
    intro.classList.add('is-ending');
    closingTimer = setTimeout(closeIntro, 480);
  }

  function beginPlayback() {
    if (started || !intro.open || reducedMotion.matches || document.hidden) return;
    started = true;
    clearTimeout(loadTimer);
    intro.classList.add('is-playing');
    // Fallback if an embedded browser suppresses the CSS animation event.
    playbackTimer = setTimeout(fadeOut, 2580);
  }

  // Open the opaque intro modal immediately so body content never flashes first.
  root.classList.add('has-film-intro');
  intro.showModal();
  document.body.classList.add('intro-open');
  loadTimer = setTimeout(fadeOut, 2600);

  skip.addEventListener('click', closeIntro);
  intro.addEventListener('cancel', function (event) {
    event.preventDefault();
    closeIntro();
  });
  intro.addEventListener('transitionend', function (event) {
    if (event.target === intro && event.propertyName === 'opacity') closeIntro();
  });
  frames.addEventListener('animationend', fadeOut);
  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', function (event) {
      if (event.matches) closeIntro();
    });
  }
  window.addEventListener('pagehide', closeIntro);

  frames.src = frames.dataset.src;
  if (typeof frames.decode === 'function') {
    frames.decode().then(beginPlayback, closeIntro);
  } else {
    frames.addEventListener('load', beginPlayback, { once: true });
    frames.addEventListener('error', closeIntro, { once: true });
  }
})();
