/** iOS splash screens — generuje z ikony */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const splashDir = path.join(__dirname, "..", "public", "splash");
const iconPath = path.join(__dirname, "..", "public", "icons", "icon-512x512.png");

const splashes = [
  { name: "apple-splash-1170-2532.png", width: 1170, height: 2532 },
  { name: "apple-splash-1284-2778.png", width: 1284, height: 2778 },
  { name: "apple-splash-1179-2556.png", width: 1179, height: 2556 },
];

await mkdir(splashDir, { recursive: true });

for (const { name, width, height } of splashes) {
  const iconSize = Math.round(Math.min(width, height) * 0.22);
  const icon = await sharp(iconPath).resize(iconSize, iconSize).png().toBuffer();

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 10, g: 10, b: 15, alpha: 1 },
    },
  })
    .composite([{ input: icon, gravity: "centre" }])
    .png()
    .toFile(path.join(splashDir, name));
}

console.log(`Generated ${splashes.length} iOS splash screens`);
