// Color Chaos - entry point. Wires config + i18n + engine + UI + input source,
// plus the two game modes: Free (comment region+color) and Turns (relay).
import { config, canvasBase } from './config.js';
import { createI18n } from './i18n/index.js';
import { buildPalette } from './core/palette.js';
import { parseChat } from './core/parser.js';
import { createRateLimiter } from './core/rate-limit.js';
import { createEngine } from './core/engine.js';
import { buildSections } from './core/sections.js';
import { createQueue } from './core/queue.js';
import { createTurnEngine } from './core/turn-engine.js';
import { premiumPaint, premiumDefs } from './core/fills.js';
import { commandFromPayload } from './core/commands.js';
import { createBoard } from './ui/board.js';
import { createPaletteBar } from './ui/palette-bar.js';
import { createTicker } from './ui/ticker.js';
import { wireControlPanel } from './ui/control-panel.js';
import { createSourceManager } from './integrations/connector.js';

// Effects this game understands - keep in sync with tikora.manifest.json.
const CAPABILITIES = {
  effects: [
    { key: 'premium_color', label: 'Premium color' },
    { key: 'multi_fill', label: 'Multi-fill' },
    { key: 'clear_region', label: 'Clear one region' },
    { key: 'wipe_canvas', label: 'Wipe the whole canvas' },
    { key: 'overwrite', label: 'Recolor a locked region' },
    { key: 'lock_region', label: 'Protect a region' },
    { key: 'rename_region', label: 'Name a region' },
    { key: 'rainbow_sweep', label: 'Rainbow sweep' },
    { key: 'priority_join', label: 'Priority sign-up' },
    { key: 'name_artwork', label: 'Name the artwork' },
    { key: 'sign_artwork', label: 'Sign the artwork' },
  ],
};

const REASON_KEY = {
  'unknown-region': 'reasonUnknown',
  'bad-color': 'reasonBadColor',
  locked: 'reasonLocked',
  cooldown: 'reasonCooldown',
  cap: 'reasonCap',
};

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const norm = (s) =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').toLowerCase().trim();

const i18n = createI18n(config.lang);
document.documentElement.lang = i18n.lang;
document.documentElement.dir = i18n.dir;

function setText(id, key) {
  const el = document.getElementById(id);
  if (el) el.textContent = i18n.t(key);
}

async function boot() {
  // --- static text ---
  setText('tTitle', 'title');
  setText('tSubtitle', 'subtitle');
  setText('tProgress', 'progress');
  setText('tPalette', 'palette');
  setText('tHint', 'hint');
  setText('tControls', 'controls');
  setText('tSource', 'source');
  setText('tAutoSim', 'autoSim');
  setText('tMode', 'mode');
  setText('tGameMode', 'gameMode');
  setText('tSignupMode', 'signupMode');
  setText('tSkipSeconds', 'skipSeconds');
  setText('tPerTurn', 'regionsPerTurn');
  setText('tRegion', 'region');
  setText('tColor', 'color');
  setText('tUser', 'user');
  setText('testBanner', 'testMode');
  setText('liveHintText', 'exitLive');
  document.getElementById('btnControls').textContent = i18n.t('controls');
  document.getElementById('ctlSimulate').textContent = i18n.t('simulateViewer');
  document.getElementById('ctlReset').textContent = i18n.t('resetCanvas');
  document.getElementById('ctlSend').textContent = i18n.t('send');
  document.getElementById('ctlOpenSignup').textContent = i18n.t('openSignup');
  document.getElementById('ctlStart').textContent = i18n.t('startRelay');
  document.getElementById('ctlSkip').textContent = i18n.t('skipTurn');
  document.getElementById('ctlEnd').textContent = i18n.t('endRelay');

  const srcSel = document.getElementById('ctlSource');
  srcSel.options[0].textContent = i18n.t('sourceHub');
  srcSel.options[1].textContent = i18n.t('sourceBridge');
  srcSel.options[2].textContent = i18n.t('sourceBoth');
  srcSel.options[3].textContent = i18n.t('sourceDemo');
  srcSel.options[4].textContent = i18n.t('sourceOff');
  const modeSel = document.getElementById('ctlMode');
  modeSel.options[0].textContent = i18n.t('lock');
  modeSel.options[1].textContent = i18n.t('chaos');
  const gmSel = document.getElementById('ctlGameMode');
  gmSel.options[0].textContent = i18n.t('modeFree');
  gmSel.options[1].textContent = i18n.t('modeTurns');
  const suSel = document.getElementById('ctlSignupMode');
  suSel.options[0].textContent = i18n.t('signupFree');
  suSel.options[1].textContent = i18n.t('signupGift');

  // --- canvas ---
  let meta;
  let svgText;
  try {
    const [metaRes, svgRes] = await Promise.all([
      fetch(canvasBase + 'canvas.json'),
      fetch(canvasBase + 'canvas.svg'),
    ]);
    if (!metaRes.ok || !svgRes.ok) throw new Error('canvas not found');
    meta = await metaRes.json();
    svgText = await svgRes.text();
  } catch (e) {
    document.getElementById('board').innerHTML =
      `<div class="cc-error">Could not load canvas "${config.canvas}".<br>${e.message}</div>`;
    return;
  }

  const palette = buildPalette(meta.palette);
  const colorIndex = i18n.colorIndex(palette);
  const engine = createEngine({
    regionNumbers: meta.regions.map((r) => r.number),
    paletteSize: palette.length,
    mode: 'lock',
  });
  const limiter = createRateLimiter({ cooldownMs: 4000, shareCap: 0 });

  // --- state ---
  let selectedColor = 1;
  let lastEventAt = 0;
  let live = false;
  let sourceManager = null;
  let gameMode = config.gameMode === 'turns' ? 'turns' : 'free'; // 'free' | 'turns'
  let signupMode = 'free'; // 'free' | 'gift'
  let perTurn = 1;
  let skipSeconds = 20;
  let autoSimOn = true;
  let turnTimer = null;
  let turnDeadline = 0;
  let artworkTitle = '';
  const signatures = [];
  let lastTurnUserId = '';

  const queue = createQueue();
  let sections = buildSections(meta.regions, perTurn);
  let turnEngine = createTurnEngine({ sections, queue });

  const overlayEl = document.getElementById('stageOverlay');

  const board = createBoard({
    mount: document.getElementById('board'),
    svgText,
    meta,
    palette,
    extraDefs: premiumDefs(),
    onRegionClick: (n) => handleRegionClick(n),
  });

  const paletteBar = createPaletteBar({
    root: document.getElementById('paletteBar'),
    palette,
    i18n,
    onPick: (c) => {
      selectedColor = c.index;
      paletteBar.highlight(c.index);
      document.getElementById('ctlColor').value = String(c.index);
    },
  });

  const ticker = createTicker({ root: document.getElementById('ticker'), i18n });

  const colorSel = document.getElementById('ctlColor');
  colorSel.innerHTML = palette
    .map((c) => `<option value="${c.index}">${c.index} - ${i18n.t(c.nameKey)}</option>`)
    .join('');
  if (colorSel.options.length) {
    colorSel.value = String(selectedColor);
    paletteBar.highlight(selectedColor);
  }

  const regionEl = document.getElementById('ctlRegion');
  regionEl.max = String(engine.total());

  // ---------- shared helpers ----------
  function updateProgress() {
    const p = engine.progress();
    document.getElementById('progressText').textContent = `${p.colored} / ${p.total}`;
    document.getElementById('progressBar').style.width = `${p.total ? (p.colored / p.total) * 100 : 0}%`;
  }

  function reportState() {
    if (!sourceManager) return;
    const rel = turnEngine.progress();
    sourceManager.reportState({
      ready: true,
      phase: live ? 'live' : 'setup',
      canvas: config.canvas,
      gameMode,
      relay: { state: turnEngine.state, done: rel.done, total: rel.total, players: queue.size() },
    });
  }

  function textOf(ev) {
    return ev.message != null ? ev.message : ev.comment != null ? ev.comment : ev.text || '';
  }
  function userOf(ev) {
    return {
      userId: String(ev.userId || ev.username || ev.name || ''),
      name: ev.name || ev.username || 'Viewer',
      avatar: ev.avatar || '',
    };
  }
  function isJoin(text) {
    const t = norm(text);
    return t === norm(i18n.t('joinWord')) || t === 'join' || t === `!${norm(i18n.t('joinWord'))}` || t === '!join';
  }
  function parseColorOnly(text) {
    const t = String(text || '').trim().replace(/^#/, '');
    if (!t) return null;
    if (/^\d+$/.test(t)) {
      const i = parseInt(t, 10);
      return i >= 1 && i <= palette.length ? i : null;
    }
    return colorIndex.get(norm(t)) || null;
  }

  function avatarNode(player, size) {
    if (player && player.avatar) {
      const img = document.createElement('img');
      img.className = size >= 80 ? 'cc-avatar' : 'cc-mini';
      img.src = player.avatar;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => img.replaceWith(initialsNode(player, size));
      return img;
    }
    return initialsNode(player, size);
  }
  function initialsNode(player, size) {
    const d = document.createElement('div');
    d.className = size >= 80 ? 'cc-initials' : 'cc-mini init';
    d.textContent = String((player && player.name) || '?').trim().slice(0, 1).toUpperCase() || '?';
    return d;
  }
  function showCard(card) {
    overlayEl.innerHTML = '';
    overlayEl.appendChild(card);
    overlayEl.classList.add('show');
  }
  function hideOverlay() {
    overlayEl.classList.remove('show');
    overlayEl.innerHTML = '';
  }
  function cardNode(titleKey) {
    const card = document.createElement('div');
    card.className = 'cc-card';
    const title = document.createElement('div');
    title.className = 'cc-title';
    title.textContent = i18n.t(titleKey);
    card.appendChild(title);
    return card;
  }

  // ---- phase instruction bar + toasts (visible on stream) ----
  const toastsEl = document.getElementById('toasts');
  const instrEl = document.getElementById('instrBar');

  function setInstruction(text) {
    if (instrEl) instrEl.textContent = text || '';
  }
  function toast(text, { ms = 3200, tone = '' } = {}) {
    if (!toastsEl || !text) return;
    const el = document.createElement('div');
    el.className = 'cc-toast' + (tone ? ' ' + tone : '');
    el.textContent = text;
    toastsEl.appendChild(el);
    while (toastsEl.children.length > 4) toastsEl.removeChild(toastsEl.firstChild);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 320);
    }, ms);
  }
  // The always-on hint telling viewers exactly what to type right now.
  function refreshInstruction() {
    if (gameMode === 'free') return setInstruction(i18n.t('instrFree'));
    if (turnEngine.state === 'signup') return setInstruction(i18n.t('instrSignup', { word: i18n.t('joinWord') }));
    if (turnEngine.state === 'waiting') return setInstruction(i18n.t('instrWaiting', { word: i18n.t('joinWord') }));
    if (turnEngine.state === 'await-color') {
      const p = turnEngine.current;
      return setInstruction(p ? i18n.t('instrTurn', { name: p.name }) : i18n.t('instrFree'));
    }
    if (turnEngine.state === 'complete') return setInstruction(i18n.t('instrComplete'));
    setInstruction('');
  }

  // ---------- turn-relay rendering ----------
  function renderSignup() {
    if (gameMode !== 'turns') return;
    const card = cardNode('signupMode');
    const count = document.createElement('div');
    count.className = 'cc-name';
    count.textContent = `${queue.size()} ${i18n.t('joined')}`;
    card.appendChild(count);
    const hint = document.createElement('div');
    hint.className = 'cc-prompt';
    hint.textContent = i18n.t('joinHint');
    card.appendChild(hint);
    const row = document.createElement('div');
    row.className = 'cc-avatarrow';
    for (const p of queue.list().slice(-24)) row.appendChild(avatarNode(p, 44));
    card.appendChild(row);
    showCard(card);
  }

  function renderWaiting() {
    const card = cardNode('modeTurns');
    const hint = document.createElement('div');
    hint.className = 'cc-prompt';
    hint.textContent = i18n.t('joinHint');
    card.appendChild(hint);
    const row = document.createElement('div');
    row.className = 'cc-avatarrow';
    for (const p of queue.list().slice(-24)) row.appendChild(avatarNode(p, 44));
    card.appendChild(row);
    showCard(card);
  }

  function renderSpotlight() {
    if (gameMode !== 'turns') return;
    if (turnEngine.state === 'complete') return renderComplete();
    if (turnEngine.state === 'signup') return renderSignup();
    if (turnEngine.state === 'waiting') return renderWaiting();

    const p = turnEngine.current;
    if (!p) return hideOverlay();
    const card = cardNode('modeTurns');
    card.insertBefore(avatarNode(p, 96), card.firstChild.nextSibling);
    const name = document.createElement('div');
    name.className = 'cc-name';
    name.textContent = p.name;
    card.appendChild(name);
    const prompt = document.createElement('div');
    prompt.className = 'cc-prompt';
    prompt.textContent = i18n.t('pickColor');
    card.appendChild(prompt);
    const timer = document.createElement('div');
    timer.className = 'cc-timer';
    timer.textContent = `${skipSeconds}s`;
    card.appendChild(timer);
    showCard(card);
  }

  function renderComplete() {
    const card = cardNode('muralComplete');
    if (artworkTitle) {
      const t = document.createElement('div');
      t.className = 'cc-name';
      t.textContent = artworkTitle;
      card.appendChild(t);
    }
    const authors = [...new Set(turnEngine.results().map((r) => (r.author ? r.author.name : '')))].filter(Boolean);
    const made = document.createElement('div');
    made.className = 'cc-madeby';
    made.textContent = `${i18n.t('madeBy')}: ${authors.join(', ')}`;
    card.appendChild(made);
    if (signatures.length) {
      const sig = document.createElement('div');
      sig.className = 'cc-madeby';
      sig.textContent = signatures.join(' · ');
      card.appendChild(sig);
    }
    showCard(card);
  }

  function clearTurnTimer() {
    if (turnTimer) {
      clearInterval(turnTimer);
      turnTimer = null;
    }
  }

  function beginTurn() {
    clearTurnTimer();
    if (gameMode !== 'turns') return;
    if (turnEngine.state !== 'await-color') {
      renderSpotlight();
      refreshInstruction();
      return;
    }
    turnDeadline = Date.now() + skipSeconds * 1000;
    renderSpotlight();
    refreshInstruction();
    const cur = turnEngine.current;
    if (cur && cur.userId !== lastTurnUserId) {
      toast(i18n.t('toastTurnStart', { name: cur.name }), { tone: 'good' });
      lastTurnUserId = cur.userId;
    }
    turnTimer = setInterval(() => {
      const left = Math.max(0, Math.ceil((turnDeadline - Date.now()) / 1000));
      const el = overlayEl.querySelector('.cc-timer');
      if (el) el.textContent = `${left}s`;
      if (left <= 0) {
        clearTurnTimer();
        turnEngine.skip();
        toast(i18n.t('toastSkipped'));
        beginTurn();
      }
    }, 250);
  }

  function applyTurn(color) {
    const entry = turnEngine.setColor(color);
    if (!entry) return;
    for (const num of entry.regions) {
      engine.apply({ regionNumber: num, color, user: entry.author.name });
      board.setColor(num, color);
      board.flash(num);
    }
    ticker.add({
      user: entry.author.name,
      region: entry.regions.join(','),
      hex: palette[color - 1].hex,
      verb: i18n.t('verbColored'),
    });
    updateProgress();
    paletteBar.highlight(color);
    toast(i18n.t('toastColored', { name: entry.author.name, region: entry.regions.join('-') }));
    clearTurnTimer();
    if (turnEngine.state === 'complete') {
      const names = [...new Set(turnEngine.results().map((r) => (r.author ? r.author.name : '')))]
        .filter(Boolean)
        .join(', ');
      toast(i18n.t('toastComplete', { names }), { ms: 8000, tone: 'good' });
      lastTurnUserId = '';
    }
    beginTurn();
    reportState();
  }

  // ---------- free-mode colouring ----------
  function doColor(region, color, user, { bypassLimit = false, override = false } = {}) {
    if (!bypassLimit) {
      const gate = limiter.check(user);
      if (!gate.ok) return { ok: false, reason: gate.reason };
    }
    const res = engine.apply({ regionNumber: region, color, user, override });
    if (!res.ok) return res;
    if (!bypassLimit) limiter.record(user);

    board.setColor(res.region.number, color);
    board.flash(res.region.number);
    ticker.add({ user, region: res.region.number, hex: palette[color - 1].hex, verb: i18n.t('verb' + cap(res.verb)) });
    updateProgress();
    reportState();
    return res;
  }

  function handleRegionClick(n) {
    if (gameMode === 'turns') {
      board.select(n);
      return;
    }
    if (selectedColor != null) {
      doColor(n, selectedColor, 'host', { bypassLimit: true });
    } else {
      board.select(n);
      regionEl.value = String(n);
    }
  }

  function handleChat(ev) {
    lastEventAt = Date.now();
    const text = textOf(ev);

    if (gameMode === 'turns') {
      const user = userOf(ev);
      if (isJoin(text)) {
        if (signupMode === 'free' && turnEngine.addPlayer(user)) {
          toast(i18n.t('toastJoined', { name: user.name }));
          if (turnEngine.state === 'signup') renderSignup();
          reportState();
        }
        return;
      }
      if (turnEngine.state === 'await-color') {
        const cur = turnEngine.current;
        if (cur && user.userId === cur.userId) {
          const color = parseColorOnly(text);
          if (color) applyTurn(color);
        }
      }
      return;
    }

    // free mode
    const user = ev.username || ev.user || ev.nickname || 'viewer';
    const parsed = parseChat(text, palette, colorIndex);
    if (!parsed) return;
    doColor(parsed.region, parsed.color, user);
  }

  // Run a hub-routed chat command (see docs/COMMANDS.md). The hub parses the
  // chat and sends effect 'command' carrying { name, args } plus the event.
  function runCommand(name, args, event) {
    const cmd = String(name || '').toLowerCase();
    const user = event ? userOf(event) : { userId: 'command', name: 'command', avatar: '' };
    if (cmd === 'join') {
      if (turnEngine.addPlayer(user)) {
        toast(i18n.t('toastJoined', { name: user.name }));
        if (turnEngine.state === 'signup') renderSignup();
      }
    } else if (cmd === 'gold') {
      const r = engine.randomUncolored();
      if (r) {
        engine.apply({ regionNumber: r.number, color: 1, user: user.name });
        board.applyPaint(r.number, premiumPaint('gold'));
        board.flash(r.number);
      }
    } else if (cmd === 'wipe') {
      engine.clearAll();
      board.reset();
      ticker.clear();
    } else if (cmd === 'color') {
      const region = Number(args && args[0]);
      const color = parseColorOnly((args && args[1]) || '');
      if (region && color) doColor(region, color, user.name, { bypassLimit: true });
    }
    updateProgress();
    reportState();
  }

  function handleEffect(ef) {
    lastEventAt = Date.now();
    const key = ef.effect;
    const payload = ef.payload || {};
    const count = Math.max(1, Number(payload.count) || 1);
    const rnd = (n) => Math.floor(Math.random() * n);
    const gifter = ef.event ? userOf(ef.event) : null;

    if (key === 'command') {
      const cmd = commandFromPayload(payload);
      if (cmd) runCommand(cmd.name, cmd.args, ef.event);
    } else     if (key === 'priority_join') {
      if (gifter && gifter.userId && turnEngine.addPlayer(gifter, { priority: true })) {
        toast(i18n.t('toastJoined', { name: gifter.name }), { tone: 'good' });
        if (turnEngine.state === 'signup') renderSignup();
      }
    } else if (key === 'name_artwork') {
      artworkTitle = String(payload.title || (gifter && gifter.name) || '').slice(0, 40);
    } else if (key === 'sign_artwork') {
      if (gifter && gifter.name) signatures.push(`✍ ${gifter.name}`);
    } else if (key === 'wipe_canvas') {
      engine.clearAll();
      board.reset();
      ticker.clear();
    } else if (key === 'clear_region') {
      const r = engine.randomColored();
      if (r) {
        engine.clear(r.number);
        board.setRawFill(r.number, '#ffffff');
        board.flash(r.number);
      }
    } else if (key === 'premium_color') {
      const r = engine.randomUncolored();
      if (r) {
        engine.apply({ regionNumber: r.number, color: 1, user: 'gift' });
        board.applyPaint(r.number, premiumPaint(payload.style || 'gold') || premiumPaint('gold'));
        board.flash(r.number);
      }
    } else if (key === 'multi_fill' || key === 'rainbow_sweep') {
      for (let i = 0; i < count; i++) {
        const r = engine.randomUncolored();
        if (!r) break;
        const color = 1 + rnd(palette.length);
        engine.apply({ regionNumber: r.number, color, user: 'gift' });
        board.setColor(r.number, color);
      }
    } else if (key === 'overwrite') {
      for (let i = 0; i < count; i++) {
        const r = engine.randomColored() || engine.randomUncolored();
        if (!r) break;
        const color = 1 + rnd(palette.length);
        engine.apply({ regionNumber: r.number, color, user: 'gift', override: true });
        board.setColor(r.number, color);
        board.flash(r.number);
      }
    }

    updateProgress();
    if (sourceManager) sourceManager.ackEffect(ef.id, { ok: true, effect: key });
    reportState();
  }

  // ---------- control panel ----------
  function setGameMode(m) {
    gameMode = m === 'turns' ? 'turns' : 'free';
    controlPanel.setGameMode(gameMode);
    if (gameMode === 'turns') {
      turnEngine.openSignup();
      renderSignup();
    } else {
      clearTurnTimer();
      hideOverlay();
    }
    refreshInstruction();
    reportState();
  }

  const controlPanel = wireControlPanel({
    i18n,
    onSource: (m) => sourceManager.setMode(m),
    onMode: (m) => {
      engine.setMode(m);
      document.getElementById('modeBadge').textContent = i18n.t(m);
      reportState();
    },
    onGameMode: setGameMode,
    onSignupMode: (m) => {
      signupMode = m === 'gift' ? 'gift' : 'free';
    },
    onOpenSignup: () => {
      setGameMode('turns');
      turnEngine.openSignup();
      renderSignup();
    },
    onStart: () => {
      if (gameMode !== 'turns') setGameMode('turns');
      turnEngine.start();
      toast(i18n.t('toastStart'), { tone: 'good' });
      beginTurn();
      reportState();
    },
    onSkip: () => {
      if (gameMode !== 'turns') return;
      turnEngine.skip();
      toast(i18n.t('toastSkipped'));
      beginTurn();
      reportState();
    },
    onEnd: () => {
      clearTurnTimer();
      hideOverlay();
    },
    onPerTurn: (n) => {
      perTurn = Math.max(1, Math.min(6, Math.floor(n) || 1));
      sections = buildSections(meta.regions, perTurn);
      turnEngine = createTurnEngine({ sections, queue });
      hideOverlay();
    },
    onSkipSeconds: (n) => {
      skipSeconds = Math.max(3, Math.min(120, Math.floor(n) || 20));
    },
    onSimulate: () => {
      if (gameMode === 'turns') {
        if (turnEngine.state === 'signup' || turnEngine.state === 'waiting') addFakePlayer();
        else if (turnEngine.state === 'await-color') applyTurn(1 + Math.floor(Math.random() * palette.length));
      } else {
        const user = 'sim' + (100 + Math.floor(Math.random() * 900));
        doColor(1 + Math.floor(Math.random() * engine.total()), 1 + Math.floor(Math.random() * palette.length), user);
      }
    },
    onAutoSim: (v) => {
      autoSimOn = !!v;
      sourceManager.setAutoSim(v);
    },
    onReset: () => {
      engine.clearAll();
      board.reset();
      ticker.clear();
      limiter.reset();
      updateProgress();
      reportState();
    },
    onManualSend: (region, color, user) => {
      const res = doColor(region, color, user, { bypassLimit: true });
      if (!res.ok) controlPanel.setStatus(i18n.t(REASON_KEY[res.reason] || 'reasonUnknown'), 'warn');
    },
    onToggleLive: () => setLive(!live),
  });

  function addFakePlayer() {
    const n = queue.size() + 1;
    const names = ['Ayla', 'Mert', 'Sara', 'Juan', 'Lin', 'Omar', 'Zoe', 'Kenji', 'Mia', 'Raj'];
    turnEngine.addPlayer({ userId: 'demo-' + n, name: `${names[(n - 1) % names.length]}${n}`, avatar: '' });
    if (turnEngine.state === 'signup') renderSignup();
    if (turnEngine.state === 'waiting') renderWaiting();
  }

  // ---------- status / live ----------
  function updateStatus() {
    const active = sourceManager ? sourceManager.active : 'off';
    const bs = sourceManager ? sourceManager.bridge : 'disabled';
    let text = i18n.t('statusOff');
    let cls = '';
    if (active === 'hub') {
      const waiting = Date.now() - lastEventAt > 6000;
      text = i18n.t(waiting ? 'statusHubWaiting' : 'statusHubLive');
      cls = 'ok';
    } else if (active === 'both') {
      text = i18n.t('statusBoth');
      cls = bs === 'connected' ? 'ok' : 'mock';
    } else if (active === 'bridge') {
      text = i18n.t(bs === 'connected' ? 'statusBridge' : 'statusBridgeConnecting');
      cls = bs === 'connected' ? 'ok' : 'mock';
    } else if (active === 'demo') {
      text = i18n.t('statusDemo');
      cls = 'mock';
    }
    controlPanel.setStatus(text, cls);
    document.body.classList.toggle('test', active === 'demo' || active === 'off');
    if (srcSel.value !== active && ['hub', 'bridge', 'both', 'demo', 'off'].includes(active)) srcSel.value = active;
  }

  function setLive(next) {
    live = !!next;
    document.body.classList.toggle('live', live);
    controlPanel.setLive(live);
    try {
      localStorage.setItem('cc.live', live ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (live) {
      controlPanel.setOpen(false);
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      showLiveHint(6000);
    } else {
      const el = document.getElementById('liveHint');
      if (el) el.classList.remove('show');
    }
    reportState();
    updateStatus();
  }

  let liveHintTimer = null;
  function showLiveHint(ms) {
    const el = document.getElementById('liveHint');
    if (!el) return;
    el.classList.add('show');
    if (liveHintTimer) clearTimeout(liveHintTimer);
    liveHintTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  document.addEventListener('keydown', (e) => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(tag);
    if (e.key === 'Escape') {
      if (live) setLive(false);
      else controlPanel.setOpen(false);
      return;
    }
    if (typing && !live) return;
    if (e.key === 'h' || e.key === 'H') {
      setLive(!live);
    } else if (e.code === 'Backquote') {
      e.preventDefault();
      controlPanel.setOpen(!controlPanel.isOpen());
    }
  });
  document.getElementById('liveHint').addEventListener('click', () => setLive(false));
  document.addEventListener('mousemove', () => {
    if (live) showLiveHint(2500);
  });

  // ---------- demo driver (turn mode, offline) ----------
  const demoOrder = meta.regions.map((r) => r.number);
  let demoSampleIdx = 0;
  const nextSample = () => {
    if (!demoOrder.length) return null;
    const region = demoOrder[demoSampleIdx % demoOrder.length];
    const color = 1 + (demoSampleIdx % palette.length);
    demoSampleIdx += 1;
    return `${region} ${color}`;
  };

  setInterval(() => {
    if (gameMode !== 'turns' || !sourceManager || sourceManager.active !== 'demo' || !autoSimOn) return;
    if (turnEngine.state === 'signup') {
      if (queue.size() < 8) addFakePlayer();
      if (queue.size() >= 5) {
        turnEngine.start();
        beginTurn();
      }
    } else if (turnEngine.state === 'await-color') {
      applyTurn(1 + Math.floor(Math.random() * palette.length));
    }
  }, 1300);

  // ---------- start source ----------
  sourceManager = createSourceManager({
    config,
    capabilities: CAPABILITIES,
    handlers: { onChat: handleChat, onEffect: handleEffect, onStatus: () => {} },
    nextSample,
    intervalMs: 1100,
  });
  const initialSource = ['hub', 'bridge', 'both', 'demo', 'off'].includes(config.source) ? config.source : 'auto';
  await sourceManager.setMode(initialSource);

  let autoSim = true;
  try {
    const saved = localStorage.getItem('cc.autoSim');
    if (saved === '0') autoSim = false;
  } catch {
    /* ignore */
  }
  autoSimOn = autoSim;
  sourceManager.setAutoSim(autoSim);
  controlPanel.setAutoSim(autoSim);

  controlPanel.setMode(engine.mode);
  document.getElementById('modeBadge').textContent = i18n.t(engine.mode);
  controlPanel.setSource(sourceManager.active);
  controlPanel.setGameMode(gameMode);
  controlPanel.setSignupMode(signupMode);
  if (gameMode === 'turns') {
    turnEngine.openSignup();
    renderSignup();
  }

  let openControls = true;
  try {
    const saved = localStorage.getItem('cc.controlsOpen');
    if (saved === '0') openControls = false;
  } catch {
    /* ignore */
  }
  controlPanel.setOpen(openControls);

  let startLive = config.live;
  try {
    if (!startLive && localStorage.getItem('cc.live') === '1') startLive = true;
  } catch {
    /* ignore */
  }
  setLive(startLive);

  refreshInstruction();
  updateProgress();
  updateStatus();
  reportState();
  setInterval(updateStatus, 1500);
}

boot();
