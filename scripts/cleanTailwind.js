import fs from 'fs';

// 1. Map hex colors to your CSS variables or Tailwind tokens
const colorMap = {
  '#09004f': 'var(--primary-color-primary-600)',
  '#0d0071': 'var(--primary-color-primary-500)',
  '#f0f0ff': 'var(--primary-color-primary-100)',
  '#111111': 'var(--neutrals-color-black)',
  '#4c4c4c': 'var(--neutrals-color-grey-500)',
  '#bfbfbf': 'var(--neutrals-color-grey-300)',
  '#eeeeee': 'var(--neutrals-color-grey-200)',
  '#f9fafb': 'var(--neutrals-color-grey-100)',
  '#ffffff': 'var(--neutrals-color-white)',
  '#e53935': 'var(--semantics-color-red-500)',
  '#16a244': 'var(--semantics-color-green-500)',
  '#1f8b6d': 'var(--others-color-persian-500)',
  '#15b1c0': 'var(--others-color-teal-500)',
  '#0093d6': 'var(--others-color-blue-500)',
};

// Regex replacements
const replacements = {
  "font-\\['Figtree'\\]": 'font-heading', // assume you alias in tailwind.config
};

// Regex strips
const stripPatterns = [
  /w-\[\d+px\]/g, // strip fixed width
  /h-\[\d+px\]/g, // strip fixed height
  /leading-\[[\d\.]+px\]/g, // strip pixel line-heights
  /left-\[[\d\.]+px\]/g, // strip absolute positions
  /top-\[[\d\.]+px\]/g,
  /right-\[[\d\.]+px\]/g,
  /bottom-\[[\d\.]+px\]/g,
  /\sabsolute\s/g, // remove absolute positioning
];

// Clean one file
function cleanFile(file) {
  let code = fs.readFileSync(file, 'utf8');

  // 1. Replace hardcoded colors
  for (const [hex, varName] of Object.entries(colorMap)) {
    const escaped = hex.replace('#', '\\#');
    code = code.replace(new RegExp(`bg-\\[${escaped}\\]`, 'gi'), `bg-[${varName}]`);
    code = code.replace(new RegExp(`text-\\[${escaped}\\]`, 'gi'), `text-[${varName}]`);
  }

  // 2. Token replacements (fonts, etc.)
  for (const [pattern, replacement] of Object.entries(replacements)) {
    code = code.replace(new RegExp(pattern, 'g'), replacement);
  }

  // 3. Strip unwanted classes
  stripPatterns.forEach(rgx => {
    code = code.replace(rgx, '');
  });

  // 4. Cleanup double spaces
  code = code.replace(/\s{2,}/g, ' ');

  fs.writeFileSync(file, code, 'utf8');
  console.log(`✅ Cleaned ${file}`);
}

// Run for a single file
const target = process.argv[2];
if (!target) {
  console.error('❌ Usage: node scripts/clean-tailwind.js path/to/file.jsx');
  process.exit(1);
}
cleanFile(target);
