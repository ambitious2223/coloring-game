// Color Chaos - hub connector.
// Tries the Tikora hub first (loads /hub-client.js served by the hub, then
// connectHub). If the hub is unreachable, falls back to an offline mock so the
// game is always demoable/testable.

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

export async function connectConnector({ config, capabilities, onChat, onEffect, onStatus, samples }) {
  const base = String(config.hubUrl).replace(/\/+$/, '');
  const scriptUrl = base + '/hub-client.js';
  const wsUrl = base.replace(/^http/, 'ws') + '/';

  try {
    if (typeof window.connectHub !== 'function') await loadScriptOnce(scriptUrl);
    if (typeof window.connectHub === 'function') {
      const hub = window.connectHub({
        url: wsUrl,
        gameSlug: config.gameSlug,
        apiKey: config.apiKey,
        capabilities,
        onChat,
        onEffect,
        onStatus,
        onError: () => {},
      });
      return {
        kind: 'hub',
        hub,
        reportState: (d) => hub.reportState(d),
        ackEffect: (id, r) => hub.ackEffect(id, r),
        close: () => hub.close(),
      };
    }
  } catch {
    /* fall through to the mock */
  }

  return createMock({ onChat, onStatus, samples });
}

function createMock({ onChat, onStatus, samples }) {
  const names = ['ayla', 'mert', 'sara', 'juan', 'lin', 'omar', 'zoe', 'kenji', 'mia', 'raj'];
  let closed = false;

  const timer = setInterval(() => {
    if (closed) return;
    const list = samples && samples.length ? samples : ['1 red'];
    const text = list[Math.floor(Math.random() * list.length)];
    const user = names[Math.floor(Math.random() * names.length)] + (10 + Math.floor(Math.random() * 89));
    onChat && onChat({ type: 'chat', username: user, message: text });
  }, 3000);

  onStatus && onStatus({ kind: 'mock', running: true });

  return {
    kind: 'mock',
    hub: null,
    submit(text, user) {
      onChat && onChat({ type: 'chat', username: user || 'host', message: text });
    },
    reportState: () => {},
    ackEffect: () => {},
    close() {
      closed = true;
      clearInterval(timer);
    },
  };
}
