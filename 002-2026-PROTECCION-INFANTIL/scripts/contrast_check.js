const COLORS = {
  'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0', 'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8', 'slate-500': '#64748b', 'slate-600': '#475569', 'slate-700': '#334155',
  'slate-800': '#1e293b', 'slate-900': '#0f172a', 'slate-950': '#020617',
  'sky-50': '#f0f9ff', 'sky-100': '#e0f2fe', 'sky-300': '#7dd3fc', 'sky-400': '#38bdf8',
  'sky-500': '#0ea5e9', 'sky-600': '#0284c7', 'sky-700': '#0369a1', 'sky-800': '#075985', 'sky-900': '#0c4a6e',
  'cyan-300': '#67e8f9', 'cyan-400': '#22d3ee', 'cyan-500': '#06b6d4', 'cyan-600': '#0891b2',
  'emerald-100': '#d1fae5', 'emerald-400': '#34d399', 'emerald-500': '#10b981', 'emerald-600': '#059669',
  'emerald-700': '#047857', 'emerald-800': '#065f46', 'emerald-900': '#064e3b',
  'amber-100': '#fef3c7', 'amber-400': '#fbbf24', 'amber-500': '#f59e0b', 'amber-600': '#d97706', 'amber-700': '#b45309',
  'orange-100': '#ffedd5', 'orange-400': '#fb923c', 'orange-500': '#f97316', 'orange-600': '#ea580c', 'orange-700': '#c2410c',
  'red-100': '#fee2e2', 'red-400': '#f87171', 'red-500': '#ef4444', 'red-600': '#dc2626', 'red-700': '#b91c1c', 'red-800': '#991b1b',
  'white': '#ffffff', 'black': '#000000',
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}
function luminance([r, g, b]) {
  const a = [r, g, b].map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}
function contrast(c1, c2) {
  const l1 = luminance(hexToRgb(c1));
  const l2 = luminance(hexToRgb(c2));
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function blend(foreground, background, opacity) {
  const [r1, g1, b1] = hexToRgb(foreground);
  const [r2, g2, b2] = hexToRgb(background);
  const r = Math.round((r1 * opacity + r2 * (1 - opacity)) * 255);
  const g = Math.round((g1 * opacity + g2 * (1 - opacity)) * 255);
  const b = Math.round((b1 * opacity + b2 * (1 - opacity)) * 255);
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

const pageLight = COLORS['slate-50'];
const pageDark = COLORS['slate-950'];
const checks = [];
function check(name, text, bg, isLarge = false) {
  if (!COLORS[text] && !text.startsWith('#')) { console.log('missing text', text); return; }
  if (!COLORS[bg] && !bg.startsWith('#')) { console.log('missing bg', bg); return; }
  const t = COLORS[text] || text;
  const b = COLORS[bg] || bg;
  const c = contrast(t, b);
  const required = isLarge ? 3 : 4.5;
  const pass = c >= required ? 'PASS' : 'FAIL';
  checks.push({ name, text, bg, contrast: c.toFixed(2), required, pass });
}

const glassLight = blend(COLORS.white, pageLight, 0.7);
const glassDark = blend(COLORS['slate-900'], pageDark, 0.6);
const glassInputLight = blend(COLORS.white, pageLight, 0.6);
const glassInputDark = blend(COLORS['slate-900'], pageDark, 0.5);
const bgWhite40Light = blend(COLORS.white, pageLight, 0.4);
const bgWhite40Dark = blend(COLORS['slate-900'], pageDark, 0.4);

// Glass text
check('text-body on glass light', 'slate-900', glassLight);
check('text-body on glass dark', 'slate-50', glassDark);
check('text-muted on glass light', 'slate-600', glassLight);
check('text-muted on glass dark', 'slate-400', glassDark);
check('text-subtle on glass light', 'slate-500', glassLight);
check('text-subtle on glass dark', 'slate-400', glassDark);
check('text-accent on glass light', 'sky-700', glassLight);
check('text-accent on glass dark', 'cyan-400', glassDark);

// Glass input
check('text-body on glass-input light', 'slate-900', glassInputLight);
check('text-body on glass-input dark', 'slate-50', glassInputDark);

// bg-white/40
check('text-body on bg-white/40 light', 'slate-900', bgWhite40Light);
check('text-body on bg-white/40 dark', 'slate-50', bgWhite40Dark);

// Buttons (text-sm, normal size -> 4.5:1)
check('white text on primary light', 'white', 'sky-700');
check('white text on primary dark', 'white', 'sky-700');
check('white text on secondary', 'white', 'emerald-700');
check('white text on danger', 'white', 'red-700');

// Semantic colors on glass
check('text-red-700 on glass light', 'red-700', glassLight);
check('text-red-400 on glass dark', 'red-400', glassDark);
check('text-green-700 on glass light', 'emerald-700', glassLight);
check('text-green-400 on glass dark', 'emerald-400', glassDark);
check('text-amber-700 on glass light', 'amber-700', glassLight);
check('text-amber-400 on glass dark', 'amber-400', glassDark);
check('text-orange-700 on glass light', 'orange-700', glassLight);
check('text-orange-400 on glass dark', 'orange-400', glassDark);

// Risk badge text colors (text-xs -> 4.5:1)
check('emerald-700 on glass light', 'emerald-700', glassLight);
check('emerald-400 on glass dark', 'emerald-400', glassDark);
check('amber-700 on glass light', 'amber-700', glassLight);
check('amber-400 on glass dark', 'amber-400', glassDark);
check('orange-700 on glass light', 'orange-700', glassLight);
check('orange-400 on glass dark', 'orange-400', glassDark);
check('red-700 on glass light', 'red-700', glassLight);
check('red-400 on glass dark', 'red-400', glassDark);

console.log('Contrast checks:');
for (const c of checks) {
  console.log(`${c.pass === 'PASS' ? 'PASS' : 'FAIL'} ${c.name}: ${c.contrast}:1 (req ${c.required}:1)`);
}

const fails = checks.filter(c => c.pass === 'FAIL');
console.log(`\n${fails.length} failures`);
for (const c of fails) {
  console.log(`  ${c.name}: ${c.contrast}:1 (need ${c.required}:1)`);
}
