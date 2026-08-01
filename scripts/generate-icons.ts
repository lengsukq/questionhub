import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = resolve(root, "public/icons");
mkdirSync(targetDir, { recursive: true });

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5E5CE6"/>
      <stop offset="0.55" stop-color="#0A84FF"/>
      <stop offset="1" stop-color="#30B0C7"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="228" fill="url(#bg)"/>
  <g fill="#FFFFFF">
    <path d="M512 320 C 442 282, 362 278, 300 292 L300 700 C 362 686, 442 690, 512 728 Z" opacity="0.82"/>
    <path d="M512 320 C 582 282, 662 278, 724 292 L724 700 C 662 686, 582 690, 512 728 Z"/>
    <rect x="499" y="306" width="26" height="418" rx="13"/>
  </g>
  <circle cx="762" cy="266" r="112" fill="#34C759" stroke="#FFFFFF" stroke-width="26"/>
  <path d="M706 272 L748 314 L822 224" fill="none" stroke="#FFFFFF" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const sizes = [1024, 512, 192, 180];

async function main(): Promise<void> {
  for (const size of sizes) {
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(resolve(targetDir, `icon-${size}.png`));
    console.log(`已生成 public/icons/icon-${size}.png`);
  }
}

void main();
