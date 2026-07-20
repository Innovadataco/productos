const COLORS = {
  'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0', 'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8', 'slate-500': '#64748b', 'slate-600': '#475569', 'slate-700': '#334155',
  'slate-800': '#1e293b', 'slate-900': '#0f172a', 'slate-950': '#020617',
  'sky-50': '#f0f9ff', 'sky-100': '#e0f2fe', 'sky-300': '#7dd3fc', 'sky-400': '#38bdf8',
  'sky-500': '#0ea5e9', 'sky-600': '#0284c7', 'sky-700': '#0369a1', 'sky-800': '#075985', 'sky-900': '#0c4a6e',
  'cyan-300': '#67e8f9', 'cyan-400': '#22d3ee', 'cyan-500': '#06b6d4', 'cyan-600': '#0891b2',
  'emerald-400': '#34d399', 'emerald-500': '#10b981', 'emerald-600': '#059669', 'emerald-700': '#047857',
  'emerald-800': '#065f46', 'emerald-900': '#064e3b',
  'amber-400': '#fbbf24', 'amber-500': '#f59e0b', 'amber-600': '#d97706', 'amber-700': '#b45309',
  'orange-400': '#fb923c', 'orange-500': '#f97316', 'orange-600': '#ea580c', 'orange-700': '#c2410c',
  'red-400': '#f87171', 'red-500': '#ef4444', 'red-600': '#dc2626', 'red-700': '#b91c1c', 'red-800': '#991b1b',
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
  if (!COLORS[text] && !text.startsWith('#')) { console.log('missing text color', text); return; }
  if (!COLORS[bg] && !bg.startsWith('#')) { console.log('missing background color', bg); return; }
  const t = COLORS[text] || text;
  const b = COLORS[bg] || bg;
  const c = contrast(t, b);
  const required = isLarge ? 3 : 4.5;
  const pass = c >= required ? 'PASS' : 'FAIL';
  checks.push({ name, text, bg, contrast: c.toFixed(2), required, pass });
}

function checkGraphical(name, text, bg) {
  if (!COLORS[text] && !text.startsWith('#')) { console.log('missing color', text); return; }
  if (!COLORS[bg] && !bg.startsWith('#')) { console.log('missing background color', bg); return; }
  const t = COLORS[text] || text;
  const b = COLORS[bg] || bg;
  const c = contrast(t, b);
  const required = 3;
  const pass = c >= required ? 'PASS' : 'FAIL';
  checks.push({ name, text, bg, contrast: c.toFixed(2), required, pass, isGraphical: true });
}

const glassLight = blend(COLORS.white, pageLight, 0.7);
const glassDark = blend(COLORS['slate-900'], pageDark, 0.6);
const glassStrongLight = blend(COLORS.white, pageLight, 0.9);
const glassStrongDark = blend(COLORS['slate-900'], pageDark, 0.85);
const glassInputLight = blend(COLORS.white, pageLight, 0.6);
const glassInputDark = blend(COLORS['slate-900'], pageDark, 0.5);
const bgWhite40Light = blend(COLORS.white, pageLight, 0.4);
const bgWhite40Dark = blend(COLORS['slate-900'], pageDark, 0.4);

// Glass text
const glassTextChecks = [
  ['text-body on glass light', 'slate-900', glassLight],
  ['text-body on glass dark', 'slate-50', glassDark],
  ['text-muted on glass light', 'slate-600', glassLight],
  ['text-muted on glass dark', 'slate-400', glassDark],
  ['text-subtle on glass light', 'slate-500', glassLight],
  ['text-subtle on glass dark', 'slate-400', glassDark],
  ['text-accent on glass light', 'sky-700', glassLight],
  ['text-accent on glass dark', 'cyan-400', glassDark],
];
glassTextChecks.forEach(([name, t, b]) => check(name, t, b));

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

// Disabled buttons (solid colors, no opacity)
check('disabled text on disabled bg light', 'slate-600', 'slate-300');
check('disabled text on disabled bg dark', 'slate-300', 'slate-700');

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

// Risk badge dots (non-textual -> 3:1)
checkGraphical('emerald-600 dot on glass light', 'emerald-600', glassLight);
checkGraphical('emerald-500 dot on glass dark', 'emerald-500', glassDark);
checkGraphical('amber-600 dot on glass light', 'amber-600', glassLight);
checkGraphical('amber-500 dot on glass dark', 'amber-500', glassDark);
checkGraphical('orange-600 dot on glass light', 'orange-600', glassLight);
checkGraphical('orange-500 dot on glass dark', 'orange-500', glassDark);
checkGraphical('red-600 dot on glass light', 'red-600', glassLight);
checkGraphical('red-500 dot on glass dark', 'red-500', glassDark);
checkGraphical('slate-500 dot on glass light', 'slate-500', glassLight);
checkGraphical('slate-400 dot on glass dark', 'slate-400', glassDark);

// Sparkline axes and labels on glass-strong
check('sparkline y-axis labels light', 'slate-500', glassStrongLight);
check('sparkline y-axis labels dark', 'slate-300', glassStrongDark);
check('sparkline x-axis labels light', 'slate-500', glassStrongLight);
check('sparkline x-axis labels dark', 'slate-300', glassStrongDark);
checkGraphical('sparkline grid lines light', 'slate-700', glassStrongLight);
checkGraphical('sparkline grid lines dark', 'slate-400', glassStrongDark);

// AdminReporteDetalle loading text on glass-strong
check('loading text on glass-strong light', 'slate-600', glassStrongLight);
check('loading text on glass-strong dark', 'slate-400', glassStrongDark);

console.log('Contrast checks:');
for (const c of checks) {
  console.log(`${c.pass === 'PASS' ? 'PASS' : 'FAIL'} ${c.name}: ${c.contrast}:1 (req ${c.required}:1)`);
}

const fails = checks.filter(c => c.pass === 'FAIL');
console.log(`\n${fails.length} failures`);
for (const c of fails) {
  console.log(`  ${c.name}: ${c.contrast}:1 (need ${c.required}:1)`);
}

if (fails.length > 0) process.exit(1);
