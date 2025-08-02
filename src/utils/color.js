function getLuminance(hex) {
  // Remove # if present
  hex = hex.replace(/^#/, "");
  // Parse r,g,b
  const num = parseInt(hex, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  // Standard luminance formula
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function isDarkColor(hex) {
  return getLuminance(hex) < 140;
}
