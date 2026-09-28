// Color Chaos - i18n. English / Turkish / Arabic (+ RTL for Arabic).
// Also builds the color-name lookup used by the chat parser, across ALL
// languages at once, so a viewer can type a color word in any of them.

export const ALL_LANGS = ['en', 'tr', 'ar'];

const STRINGS = {
  en: {
    title: 'Color Chaos',
    subtitle: 'Comment a region number and a color - together you paint the canvas.',
    progress: 'Progress',
    palette: 'Palette',
    feed: 'Live coloring',
    feedEmpty: 'No colors yet - be the first!',
    hint: 'Comment: region + color, e.g. 12 green or 12 3. Press ` for the host dock.',
    dock: 'Host dock',
    mode: 'Mode',
    region: 'Region',
    color: 'Color',
    user: 'User',
    send: 'Send',
    simulate: 'Simulate',
    reset: 'Reset',
    lock: 'Lock',
    chaos: 'Chaos',
    statusConnecting: 'Connecting...',
    statusHub: 'Hub connected',
    statusMock: 'Offline demo',
    reasonLocked: 'already colored',
    reasonUnknown: 'no such region',
    reasonBadColor: 'unknown color',
    reasonCooldown: 'slow down',
    reasonCap: 'limit reached',
    verbColored: 'colored',
    verbRecolored: 'recolored',
    verbCleared: 'cleared',
    verbOverwrote: 'overwrote',
    toastInvalid: 'Comment like "12 green" or "12 3".',
    colorRed: 'Red', colorGreen: 'Green', colorBlue: 'Blue', colorYellow: 'Yellow',
    colorOrange: 'Orange', colorPurple: 'Purple', colorCyan: 'Cyan', colorMagenta: 'Magenta',
    colorLime: 'Lime', colorPink: 'Pink',
  },
  tr: {
    title: 'Color Chaos',
    subtitle: 'Bölge numarası ve bir renk yaz - birlikte tabloyu boyayın.',
    progress: 'İlerleme',
    palette: 'Palet',
    feed: 'Canlı boyama',
    feedEmpty: 'Henüz renk yok - ilk sen ol!',
    hint: 'Yorum: bölge + renk, örn. 12 yeşil veya 12 3. Host paneli için ` tuşu.',
    dock: 'Host paneli',
    mode: 'Mod',
    region: 'Bölge',
    color: 'Renk',
    user: 'Kullanıcı',
    send: 'Gönder',
    simulate: 'Simüle',
    reset: 'Sıfırla',
    lock: 'Kilitli',
    chaos: 'Kaos',
    statusConnecting: 'Bağlanıyor...',
    statusHub: 'Hub bağlı',
    statusMock: 'Çevrimdışı demo',
    reasonLocked: 'zaten boyanmış',
    reasonUnknown: 'böyle bir bölge yok',
    reasonBadColor: 'bilinmeyen renk',
    reasonCooldown: 'yavaşla',
    reasonCap: 'sınıra ulaşıldı',
    verbColored: 'boyadı',
    verbRecolored: 'yeniden boyadı',
    verbCleared: 'temizledi',
    verbOverwrote: 'üzerine boyadı',
    toastInvalid: 'Örn. "12 yeşil" veya "12 3" yazın.',
    colorRed: 'Kırmızı', colorGreen: 'Yeşil', colorBlue: 'Mavi', colorYellow: 'Sarı',
    colorOrange: 'Turuncu', colorPurple: 'Mor', colorCyan: 'Camgöbeği', colorMagenta: 'Eflatun',
    colorLime: 'Açık Yeşil', colorPink: 'Pembe',
  },
  ar: {
    title: 'Color Chaos',
    subtitle: 'اكتب رقم المنطقة ولوناً - لنلوّن اللوحة معاً.',
    progress: 'التقدم',
    palette: 'اللوحة اللونية',
    feed: 'التلوين المباشر',
    feedEmpty: 'لا توجد ألوان بعد - كن الأول!',
    hint: 'اكتب: المنطقة + اللون، مثل 12 أخضر أو 12 3. اضغط ` للوحة المضيف.',
    dock: 'لوحة المضيف',
    mode: 'الوضع',
    region: 'المنطقة',
    color: 'اللون',
    user: 'المستخدم',
    send: 'إرسال',
    simulate: 'محاكاة',
    reset: 'إعادة',
    lock: 'مقفل',
    chaos: 'فوضى',
    statusConnecting: 'جارٍ الاتصال...',
    statusHub: 'متصل بالمركز',
    statusMock: 'عرض بدون اتصال',
    reasonLocked: 'ملوّن مسبقاً',
    reasonUnknown: 'لا توجد هذه المنطقة',
    reasonBadColor: 'لون غير معروف',
    reasonCooldown: 'تمهّل',
    reasonCap: 'بلغت الحد',
    verbColored: 'لوّن',
    verbRecolored: 'أعاد التلوين',
    verbCleared: 'أفرغ',
    verbOverwrote: 'طلى فوق',
    toastInvalid: 'اكتب مثل "12 أخضر" أو "12 3".',
    colorRed: 'أحمر', colorGreen: 'أخضر', colorBlue: 'أزرق', colorYellow: 'أصفر',
    colorOrange: 'برتقالي', colorPurple: 'بنفسجي', colorCyan: 'سماوي', colorMagenta: 'أرجواني',
    colorLime: 'ليموني', colorPink: 'وردي',
  },
};

const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .trim();

function fmt(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function createI18n(lang) {
  const code = STRINGS[lang] ? lang : 'en';
  const dict = STRINGS[code];

  function t(key, vars) {
    const raw = key in dict ? dict[key] : key in STRINGS.en ? STRINGS.en[key] : key;
    return fmt(raw, vars);
  }

  // normalized color name (any language) -> palette index (1-based)
  function colorIndex(palette) {
    const map = new Map();
    for (const item of palette) {
      for (const l of ALL_LANGS) {
        const word = STRINGS[l][item.nameKey];
        if (word) map.set(norm(word), item.index);
      }
      map.set(item.hex.toLowerCase(), item.index);
    }
    return map;
  }

  return { lang: code, dir: code === 'ar' ? 'rtl' : 'ltr', t, colorIndex };
}
