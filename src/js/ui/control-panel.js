// Color Chaos - control panel (streamer-only testing/controls drawer).
// Toggled by the "Controls" header button or the ` key. Never shown in Live mode.
export function wireControlPanel({ i18n, onSource, onMode, onSimulate, onAutoSim, onReset, onManualSend, onToggleLive }) {
  const panel = document.getElementById('controls');
  const btnControls = document.getElementById('btnControls');
  const btnLive = document.getElementById('btnLive');
  const sourceSel = document.getElementById('ctlSource');
  const modeSel = document.getElementById('ctlMode');
  const autoSimEl = document.getElementById('ctlAutoSim');
  const regionEl = document.getElementById('ctlRegion');
  const colorEl = document.getElementById('ctlColor');
  const userEl = document.getElementById('ctlUser');

  function setOpen(open) {
    panel.classList.toggle('open', open);
    try {
      localStorage.setItem('cc.controlsOpen', open ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  btnControls.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  document.getElementById('ctlClose').addEventListener('click', () => setOpen(false));
  btnLive.addEventListener('click', () => onToggleLive());

  sourceSel.addEventListener('change', () => onSource(sourceSel.value));
  modeSel.addEventListener('change', () => onMode(modeSel.value));
  autoSimEl.addEventListener('change', () => onAutoSim(autoSimEl.checked));
  document.getElementById('ctlSimulate').addEventListener('click', () => onSimulate());
  document.getElementById('ctlReset').addEventListener('click', () => onReset());
  document.getElementById('ctlSend').addEventListener('click', () =>
    onManualSend(Number(regionEl.value), Number(colorEl.value), userEl.value || 'host')
  );

  return {
    setOpen,
    isOpen: () => panel.classList.contains('open'),
    setSource: (m) => {
      sourceSel.value = m;
    },
    setMode: (m) => {
      modeSel.value = m;
    },
    setAutoSim: (v) => {
      autoSimEl.checked = !!v;
    },
    setRegion: (n) => {
      regionEl.value = String(n);
    },
    setColor: (i) => {
      colorEl.value = String(i);
    },
    setStatus(text, cls) {
      const el = document.getElementById('dockStatus');
      if (el) {
        el.textContent = text;
        el.className = 'cc-status ' + (cls || '');
      }
    },
    setLive(live) {
      btnLive.textContent = i18n.t(live ? 'exitLive' : 'goLive');
      btnLive.classList.toggle('active', live);
    },
  };
}
