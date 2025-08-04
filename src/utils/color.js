export function getLuminance(hex) {
  hex = hex.replace(/^#/, '');
  const num = parseInt(hex, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isDarkColor(hex) {
  return getLuminance(hex) < 140;
}
