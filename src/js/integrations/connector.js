// Color Chaos - input sources.
//
// One swappable source at a time:
//   hub  - connect to the Tikora relay (live)
//   demo - nothing live; the simulator drives it
//   off  - nothing (clean, e.g. a real live run with no simulation)
//   auto - hub if reachable, otherwise demo (used at boot)
//
// The manual "simulate" and "auto-simulate" always work, in any source, so the
// game can be tested even while the hub is connected.

function loadScriptOnce(src, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-cc="${src}"]`);
    if (existing && existing.dataset.loaded === '1') return resolve();

    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.dataset.cc = src;

    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error('hub-client load timeout'));
    }, timeoutMs);

    s.onload = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      s.dataset.loaded = '1';
      resolve();
    };
    s.onerror = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(new Error('hub-client load failed'));
    };
    document.head.appendChild(s);
  });
}

const DEMO_NAMES = ['ayla', 'mert', 'sara', 'juan', 'lin', 'omar', 'zoe', 'kenji', 'mia', 'raj'];

export function createSourceManager({ config, capabilities, handlers, samples, nextSample, intervalMs = 3000 }) {
  const onChat = handlers.onChat || (() => {});
  const onEffect = handlers.onEffect || (() => {});
  const onStatus = handlers.onStatus || (() => {});

  let requested = 'auto';
  let active = 'off';
  let hub = null;
  let simTimer = null;
  let autoSim = false;

  const randomSample = () => {
    if (typeof nextSample === 'function') {
      const s = nextSample();
      if (s) return s;
    }
    const list = samples && samples.length ? samples : ['1 red'];
    return list[Math.floor(Math.random() * list.length)];
  };
  const randomUser = () => DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)] + (10 + Math.floor(Math.random() * 89));

  function emitChat(text, user) {
    onChat({ type: 'chat', username: user, message: text });
  }
  function simulateNow() {
    emitChat(randomSample(), randomUser());
  }

  function stopAutoSim() {
    if (simTimer) {
      clearInterval(simTimer);
      simTimer = null;
    }
  }
  function applyAutoSim() {
    stopAutoSim();
    if (autoSim && active !== 'hub') simTimer = setInterval(simulateNow, intervalMs);
  }

  async function openHub() {
    const base = String(config.hubUrl).replace(/\/+$/, '');
    const scriptUrl = base + '/hub-client.js';
    const wsUrl = base.replace(/^http/, 'ws') + '/';
    try {
      if (typeof window.connectHub !== 'function') await loadScriptOnce(scriptUrl);
    } catch {
      return null;
    }
    if (typeof window.connectHub !== 'function') return null;
    return window.connectHub({
      url: wsUrl,
      gameSlug: config.gameSlug,
      apiKey: config.apiKey,
      capabilities,
      onChat,
      onEffect,
      onStatus,
      onError: () => {},
    });
  }

  function closeHub() {
    if (hub) {
      try {
        hub.close();
      } catch {
        /* ignore */
      }
      hub = null;
    }
  }

  async function apply() {
    closeHub();
    stopAutoSim();
    let error = false;

    if (requested === 'hub' || requested === 'auto') {
      const h = await openHub();
      if (h) {
        hub = h;
        active = 'hub';
      } else {
        active = requested === 'auto' ? 'demo' : 'off';
        error = true;
      }
    } else if (requested === 'demo') {
      active = 'demo';
    } else {
      active = 'off';
    }

    applyAutoSim();
    onStatus({ kind: active, requested, error });
  }

  return {
    get active() {
      return active;
    },
    get requested() {
      return requested;
    },
    get autoSim() {
      return autoSim;
    },
    isHub: () => active === 'hub',
    async start() {
      await apply();
    },
    async setMode(mode) {
      requested = mode;
      await apply();
    },
    setAutoSim(on) {
      autoSim = !!on;
      applyAutoSim();
    },
    simulateNow,
    reportState: (d) => {
      if (hub) hub.reportState(d);
    },
    ackEffect: (id, r) => {
      if (hub) hub.ackEffect(id, r);
    },
    destroy() {
      closeHub();
      stopAutoSim();
    },
  };
}
