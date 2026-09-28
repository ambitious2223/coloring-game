// Color Chaos - runtime config.
// Resolution order (first wins): URL query -> window.TIKORA_GAME_CONFIG -> defaults.
// Tikora injects ?game=<slug>&key=<key> when it launches the game.
const params = new URLSearchParams(window.location.search);
const injected = (typeof window !== 'undefined' && window.TIKORA_GAME_CONFIG) || {};

export const config = {
  gameSlug: params.get('game') || injected.gameSlug || 'color-chaos',
  apiKey: params.get('key') || injected.apiKey || '',
  lang: (params.get('lang') || injected.locale || 'en').slice(0, 2),
  canvas: params.get('canvas') || injected.canvas || 'photo-demo-sunset',
  hubUrl: params.get('hub') || injected.hubUrl || 'http://127.0.0.1:27016/',
};

export const canvasBase = `/js/data/canvases/${config.canvas}/`;
