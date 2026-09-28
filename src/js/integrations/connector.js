// Color Chaos - input sources.
//
// One swappable source at a time:
//   hub    - connect to the Tikora relay (live; chat + routed effects)
//   bridge - connect DIRECTLY to a local TikFinity-style bridge WebSocket
//            (backup for detecting interactions when the hub isn't supplying them)
//   both   - hub + bridge at once (chat de-duplicated; effects still come from the hub)
//   demo   - nothing live; the simulator drives it
//   off    - nothing (clean, e.g. a real live run with no simulation)
//   auto   - hub if reachable, otherwise demo (used at boot)
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

// ---- TikFinity-style bridge normalisation (mirrors the hub's relay) ----
function pickBridgeUser(data) {
  const u = data.user && typeof data.user === 'object' ? data.user : data;
  const username = u.uniqueId || u.username || u.nickname || data.uniqueId || data.username || '';
  const name = u.nickname || u.nickName || data.nickname || data.name || username || 'Viewer';
  const userId = u.userId || u.id || data.userId || username;
  const avatar =
    u.profilePictureUrl ||
    u.avatar ||
    data.profilePictureUrl ||
    data.avatar ||
    (u.profilePicture && u.profilePicture.url && u.profilePicture.url[0]) ||
    '';
  return { userId: String(userId || ''), username: String(username || ''), name: String(name || ''), avatar: String(avatar || '') };
}

export function normalizeBridgeMessage(raw) {
  let msg;
  try {
    msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!msg || typeof msg !== 'object') return null;
  const eventName = String(msg.event || msg.type || msg.eventName || '').toLowerCase();
  const data = msg.data && typeof msg.data === 'object' ? msg.data : msg;
  const user = pickBridgeUser(data);

  if (eventName === 'chat' || eventName === 'comment') {
    const message = data.comment || data.message || data.text || '';
    if (!message) return null;
    return { ...user, type: 'chat', message };
  }
  if (eventName === 'gift') {
    return {
      ...user,
      type: 'gift',
      giftId: data.giftId,
      giftName: data.giftName || '',
      count: Number(data.repeatCount || data.count || 1) || 1,
      coins: Number(data.diamondCount || data.coins || 0) || 0,
    };
  }
  if (eventName === 'like' || eventName === 'likes') return { ...user, type: 'like' };
  if (eventName === 'follow' || eventName === 'share' || eventName === 'subscribe') return { ...user, type: eventName };
  if (eventName === 'member' || eventName === 'join') return { ...user, type: 'member' };
  return null;
}

export function createSourceManager({ config, capabilities, handlers, samples, nextSample, intervalMs = 3000 }) {
  const onChat = handlers.onChat || (() => {});
  const onEffect = handlers.onEffect || (() => {});
  const onStatus = handlers.onStatus || (() => {});

  let requested = 'auto';
  let active = 'off';
  let hub = null;
  let bridge = null;
  let simTimer = null;
  let autoSim = false;
  let bridgeState = 'disabled'; // disabled | connecting | connected | error
  const recentChat = new Map(); // dedupe key -> ts (only used in "both")

  const randomSample = () => {
    if (typeof nextSample === 'function') {
      const s = nextSample();
      if (s) return s;
    }
    const list = samples && samples.length ? samples : ['1 red'];
    return list[Math.floor(Math.random() * list.length)];
  };
  const randomUser = () => DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)] + (10 + Math.floor(Math.random() * 89));

  // De-duplicate chat arriving from BOTH the hub and the bridge.
  function deliverChat(ev) {
    if (active === 'both') {
      const key = `${ev.userId || ev.username || ''}|${ev.message || ev.comment || ''}`;
      const now = Date.now();
      for (const [k, t] of recentChat) if (now - t > 4000) recentChat.delete(k);
      if (recentChat.has(key)) return;
      recentChat.set(key, now);
    }
    onChat(ev);
  }

  function emitChat(text, user) {
    deliverChat({ type: 'chat', userId: user, username: user, name: user, message: text });
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
    // The simulator belongs to Demo only - Off (and Hub/Bridge) stay silent.
    if (autoSim && active === 'demo') simTimer = setInterval(simulateNow, intervalMs);
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
      onChat: deliverChat,
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

  function openBridge() {
    const url = String(config.bridgeUrl || 'ws://127.0.0.1:21213/');
    let closed = false;
    let ws = null;
    let timer = null;
    function schedule() {
      if (closed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(connect, 3000);
    }
    function connect() {
      if (closed) return;
      bridgeState = 'connecting';
      onStatus({ kind: active, requested, bridge: bridgeState });
      try {
        ws = new WebSocket(url);
      } catch {
        bridgeState = 'error';
        schedule();
        return;
      }
      ws.onopen = () => {
        bridgeState = 'connected';
        onStatus({ kind: active, requested, bridge: bridgeState });
      };
      ws.onmessage = (e) => {
        const ev = normalizeBridgeMessage(e.data);
        if (!ev) return;
        if (ev.type === 'chat') deliverChat(ev);
      };
      ws.onclose = () => {
        ws = null;
        bridgeState = 'error';
        onStatus({ kind: active, requested, bridge: bridgeState });
        schedule();
      };
      ws.onerror = () => {
        /* onclose follows */
      };
    }
    connect();
    return {
      close() {
        closed = true;
        if (timer) clearTimeout(timer);
        if (ws) {
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          ws = null;
        }
      },
    };
  }

  function closeBridge() {
    if (bridge) {
      try {
        bridge.close();
      } catch {
        /* ignore */
      }
      bridge = null;
    }
    bridgeState = 'disabled';
  }

  async function apply() {
    closeHub();
    closeBridge();
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
    } else if (requested === 'bridge') {
      active = 'bridge';
      bridge = openBridge();
    } else if (requested === 'both') {
      const h = await openHub();
      hub = h || null;
      active = 'both';
      bridge = openBridge();
    } else if (requested === 'demo') {
      active = 'demo';
    } else {
      active = 'off';
    }

    applyAutoSim();
    onStatus({ kind: active, requested, error, bridge: bridgeState });
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
    get bridge() {
      return bridgeState;
    },
    isHub: () => active === 'hub' || active === 'both',
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
      closeBridge();
      stopAutoSim();
    },
  };
}
