/**
 * Rasterizes public/logo.svg → src/app/favicon.ico (16/32/48 PNG layers).
 * Run: node scripts/generate-favicon.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const svgPath = path.join(root, "public", "logo.svg");
const outPath = path.join(root, "src", "app", "favicon.ico");

const buf16 = await sharp(svgPath).resize(16, 16).png().toBuffer();
const buf32 = await sharp(svgPath).resize(32, 32).png().toBuffer();
const buf48 = await sharp(svgPath).resize(48, 48).png().toBuffer();
const ico = await pngToIco([buf16, buf32, buf48]);
fs.writeFileSync(outPath, ico);
console.log("Wrote", outPath);
