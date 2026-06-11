/**
 * Generuje PWA ikony z SVG zdroje (sharp).
 * Spuštění: node scripts/generate-icons.mjs
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const iconsDir = path.join(root, "public", "icons");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#818cf8"/>
      <stop offset="100%" style="stop-color:#6366f1"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="108" fill="#0a0a0f"/>
  <path fill="url(#g)" d="M256 72 L392 148 V268 C392 356 334 418 256 448 C178 418 120 356 120 268 V148 Z"/>
  <path fill="#0a0a0f" opacity="0.35" d="M256 120 L344 168 V260 C344 318 308 362 256 382 C204 362 168 318 168 260 V168 Z"/>
  <path fill="#fff" d="M256 168 L296 192 V252 C296 282 278 302 256 312 C234 302 216 282 216 252 V192 Z"/>
</svg>`;

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];

await mkdir(iconsDir, { recursive: true });
await writeFile(path.join(iconsDir, "icon.svg"), svg);

for (const size of sizes) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
}

// Maskable — bezpečná zóna 80 %
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.72);
  const pad = Math.round((size - inner) / 2);
  await sharp(Buffer.from(svg))
    .resize(inner, inner)
    .extend({
      top: pad,
      bottom: pad,
      left: pad,
      right: pad,
      background: { r: 10, g: 10, b: 15, alpha: 1 },
    })
    .png()
    .toFile(path.join(iconsDir, `icon-maskable-${size}x${size}.png`));
}

console.log(`Generated ${sizes.length + 2} icons in public/icons/`);
