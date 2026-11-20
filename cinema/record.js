(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.CinemaRecord = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var DEFAULT_KEY = 'mujian.cinema-visit.v1';
  var own = Object.prototype.hasOwnProperty;
  var fallbackSequence = 0;

  function safeId(value) {
    return typeof value === 'string' && value.length > 0 &&
      value !== '__proto__' && value !== 'constructor' && value !== 'prototype';
  }

  function dateString(value) {
    if (value === null || value === undefined || value === '') return null;
    var date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function defaultId() {
    try {
      if (root.crypto && typeof root.crypto.randomUUID === 'function') {
        return root.crypto.randomUUID();
      }
    } catch (_) {}
    fallbackSequence += 1;
    return 'visit-' + Date.now().toString(36) + '-' + fallbackSequence + '-' +
      Math.random().toString(36).slice(2);
  }

  function copyChoices(choices) {
    var result = {};
    Object.keys(choices).forEach(function (id) {
      if (!safeId(id)) return;
      result[id] = { visited: choices[id].visited, wishlist: choices[id].wishlist };
    });
    return result;
  }

  function createStore(options) {
    options = options || {};
    var key = typeof options.key === 'string' && options.key ? options.key : DEFAULT_KEY;
    var clock = typeof options.now === 'function' ? options.now : function () { return new Date(); };
    var idFactory = typeof options.makeId === 'function' ? options.makeId : defaultId;
    var storage = null;
    var persistent = false;
    var state;

    try {
      storage = own.call(options, 'storage') ? options.storage : root.localStorage;
      persistent = !!storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function';
    } catch (_) {}

    function timestamp() {
      try { return dateString(clock()) || new Date().toISOString(); }
      catch (_) { return new Date().toISOString(); }
    }

    function nextId(previousId) {
      var candidate;
      try { candidate = idFactory(); } catch (_) {}
      return safeId(candidate) && candidate !== previousId ? candidate : defaultId();
    }

    function fresh(previousId) {
      var time = timestamp();
      return {
        version: 1,
        visitId: nextId(previousId),
        startedAt: time,
        updatedAt: time,
        choices: Object.create(null)
      };
    }

    function restore(value) {
      if (!value || typeof value !== 'object' || value.version !== 1 ||
          !safeId(value.visitId) || !dateString(value.startedAt) || !dateString(value.updatedAt) ||
          !value.choices || typeof value.choices !== 'object' || Array.isArray(value.choices)) return null;
      var choices = Object.create(null);
      Object.keys(value.choices).forEach(function (id) {
        if (!safeId(id)) return;
        var choice = value.choices[id];
        if (!choice || typeof choice !== 'object' || Array.isArray(choice)) return;
        var visited = own.call(choice, 'visited') && choice.visited === true;
        var wishlist = own.call(choice, 'wishlist') && choice.wishlist === true;
        if (visited || wishlist) choices[id] = { visited: visited, wishlist: wishlist };
      });
      return {
        version: 1,
        visitId: value.visitId,
        startedAt: dateString(value.startedAt),
        updatedAt: dateString(value.updatedAt),
        choices: choices
      };
    }

    function getState() {
      return {
        version: 1,
        visitId: state.visitId,
        startedAt: state.startedAt,
        updatedAt: state.updatedAt,
        choices: copyChoices(state.choices),
        persistent: persistent
      };
    }

    function persist() {
      if (!persistent) return;
      try { storage.setItem(key, JSON.stringify(getState())); }
      catch (_) { persistent = false; storage = null; }
    }

    if (persistent) {
      try {
        var saved = storage.getItem(key);
        if (saved) {
          try { state = restore(JSON.parse(saved)); } catch (_) {}
        }
      } catch (_) { persistent = false; storage = null; }
    }
    if (!state) state = fresh();
    persist();

    function toggle(cinemaId, kind) {
      if (!safeId(cinemaId) || (kind !== 'visited' && kind !== 'wishlist')) return getState();
      var previous = state.choices[cinemaId];
      var choice = previous ? { visited: previous.visited, wishlist: previous.wishlist } :
        { visited: false, wishlist: false };
      choice[kind] = !choice[kind];
      if (choice.visited || choice.wishlist) state.choices[cinemaId] = choice;
      else delete state.choices[cinemaId];
      state.updatedAt = timestamp();
      persist();
      return getState();
    }

    function summary(cinemas) {
      var visited = [];
      var wishlist = [];
      var known = new Set();
      var uniqueCount = 0;
      (Array.isArray(cinemas) ? cinemas : []).forEach(function (cinema) {
        if (!cinema || !safeId(cinema.id) || known.has(cinema.id)) return;
        known.add(cinema.id);
        var choice = state.choices[cinema.id];
        if (!choice || (!choice.visited && !choice.wishlist)) return;
        var item = {
          id: cinema.id,
          name: typeof cinema.name === 'string' && cinema.name ? cinema.name : cinema.id,
          city: typeof cinema.city === 'string' ? cinema.city : ''
        };
        if (choice.visited) visited.push({ id: item.id, name: item.name, city: item.city });
        if (choice.wishlist) wishlist.push({ id: item.id, name: item.name, city: item.city });
        uniqueCount += 1;
      });
      return {
        visited: visited,
        wishlist: wishlist,
        uniqueCount: uniqueCount,
        visitedCount: visited.length,
        wishlistCount: wishlist.length
      };
    }

    function snapshot(cinemas) {
      var current = summary(cinemas);
      return {
        version: 1,
        visitId: state.visitId,
        startedAt: state.startedAt,
        generatedAt: timestamp(),
        visited: current.visited,
        wishlist: current.wishlist,
        counts: { visited: current.visitedCount, wishlist: current.wishlistCount, unique: current.uniqueCount }
      };
    }

    function reset() {
      state = fresh(state.visitId);
      persist();
      return getState();
    }

    return Object.freeze({ getState: getState, toggle: toggle, summary: summary, snapshot: snapshot, reset: reset });
  }

  return Object.freeze({ createStore: createStore });
});
