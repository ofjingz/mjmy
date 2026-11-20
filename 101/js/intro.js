(function () {
  'use strict';

  var intro = document.getElementById('filmIntro');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var navigation = performance.getEntriesByType('navigation')[0];
  if (typeof intro.showModal !== 'function' || reducedMotion.matches || location.hash ||
      (navigation && navigation.type === 'back_forward')) return;

  var frames = intro.querySelector('.film-intro__frames');
  var skip = intro.querySelector('.film-intro__skip');
  var readyBy = performance.now() + 900;
  var playbackTimer;
  var closingTimer;

  function closeIntro() {
    clearTimeout(playbackTimer);
    clearTimeout(closingTimer);
    if (intro.open) intro.close();
    document.body.classList.remove('intro-open');
  }

  function fadeOut() {
    if (!intro.open || intro.classList.contains('is-ending')) return;
    intro.classList.add('is-ending');
    closingTimer = setTimeout(closeIntro, 480);
  }

  function startIntro() {
    if (performance.now() > readyBy || reducedMotion.matches || document.hidden ||
        window.scrollY || location.hash || document.activeElement !== document.body) return;

    intro.showModal();
    document.body.classList.add('intro-open');
    // Fallback if an embedded browser suppresses the CSS animation event.
    playbackTimer = setTimeout(fadeOut, 2680);
  }

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
    frames.decode().then(startIntro, function () {});
  } else {
    frames.addEventListener('load', startIntro, { once: true });
  }
})();
