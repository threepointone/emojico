#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

// Import canvas library
import { createCanvas } from "@napi-rs/canvas";

const SIZES = {
  favicon: [16, 32, 48],
  apple: [57, 60, 72, 76, 114, 120, 144, 152, 180],
};

function printHelp() {
  console.log(`
emojico - Convert emoji to favicon and Apple touch icon assets

Usage: emojico <emoji> [--out <directory>] [--all]

Options:
  --out, -o <directory>  Output directory for the generated assets (default: current directory)
  --all                  Generate all assets (favicon.ico, PNG favicons, and Apple touch icons)
  --help, -h             Show this help message

Example:
  emojico 🍎
  emojico 🍎 --out ./icons
  emojico 🍎 --out ./icons --all
`);
  process.exit(0);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printHelp();
  }

  let emoji = "";
  let outDir = "."; // Default to current directory
  let generateAll = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out" || args[i] === "-o") {
      if (i + 1 < args.length) {
        outDir = args[i + 1];
        i++; // Skip next argument
      }
    } else if (args[i] === "--all") {
      generateAll = true;
    } else if (!emoji && !args[i].startsWith("-")) {
      emoji = args[i];
    }
  }

  if (!emoji) {
    console.error("Error: Emoji is required");
    console.error("Run with --help for usage information");
    process.exit(1);
  }

  return { emoji, outDir, generateAll };
}

/**
 * Render emoji to image using Canvas
 */
function emojiToImageCanvas(emoji: string, size: number): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // Set font with emoji support
  const fontSize = Math.floor(size * 0.8);
  ctx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "EmojiOne Color", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw emoji centered
  ctx.fillText(emoji, size / 2, size / 2);

  return canvas.toBuffer("image/png");
}

/**
 * Optimized: Render emoji once at high resolution, then resize to all sizes
 * This is the fastest approach - one render, multiple fast resizes
 */
async function generateAllSizesOptimized(
  emoji: string
): Promise<Map<number, Buffer>> {
  // Render once at high resolution (512x512 for best quality)
  const HIGH_RES_SIZE = 512;
  const highResBuffer = emojiToImageCanvas(emoji, HIGH_RES_SIZE);

  // Get all sizes we need
  const allSizes = [...SIZES.favicon, ...SIZES.apple];

  // Resize to all sizes using Sharp (very fast)
  const buffers = await Promise.all(
    allSizes.map(async (size) => {
      const buffer = await sharp(highResBuffer)
        .resize(size, size, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer();
      return { size, buffer };
    })
  );

  // Return as Map for easy lookup
  const sizeMap = new Map<number, Buffer>();
  buffers.forEach(({ size, buffer }) => {
    sizeMap.set(size, buffer);
  });

  return sizeMap;
}

/**
 * Parse PNG buffer and extract image data using Sharp
 */
export async function parsePng(pngBuffer: Buffer): Promise<{
  width: number;
  height: number;
  bpp: number; // bytes per pixel (4 for RGBA)
  data: Buffer; // raw RGBA pixel data
}> {
  const metadata = await sharp(pngBuffer).metadata();
  const raw = await sharp(pngBuffer).ensureAlpha().raw().toBuffer();

  return {
    width: metadata.width!,
    height: metadata.height!,
    bpp: 4, // RGBA = 4 bytes per pixel
    data: raw,
  };
}

/**
 * Create ICO file header
 * Format: reserved (2), type (2), count (2)
 */
export function createIcoHeader(count: number): Buffer {
  const buf = Buffer.alloc(6);
  buf.writeUInt16LE(0, 0); // Reserved, must be 0
  buf.writeUInt16LE(1, 2); // Type: 1 = ICO
  buf.writeUInt16LE(count, 4); // Number of images
  return buf;
}

/**
 * Create ICO directory entry for an image
 * Format: width (1), height (1), color palette (1), reserved (1),
 *         color planes (2), bpp (2), size (4), offset (4)
 */
export function createIcoDirectory(
  width: number,
  height: number,
  bpp: number,
  size: number,
  offset: number
): Buffer {
  const buf = Buffer.alloc(16);
  // Width and height: 0 means 256
  buf.writeUInt8(width === 256 ? 0 : width, 0);
  buf.writeUInt8(height === 256 ? 0 : height, 1);
  buf.writeUInt8(0, 2); // Color palette (0 = no palette)
  buf.writeUInt8(0, 3); // Reserved
  buf.writeUInt16LE(1, 4); // Color planes (1 = no palette)
  buf.writeUInt16LE(bpp * 8, 6); // Bits per pixel
  buf.writeUInt32LE(size, 8); // Size of image data
  buf.writeUInt32LE(offset, 12); // Offset of image data
  return buf;
}

/**
 * Create BITMAPINFOHEADER (40 bytes)
 */
export function createBitmapInfoHeader(
  width: number,
  height: number,
  bpp: number,
  dataSize: number
): Buffer {
  const buf = Buffer.alloc(40);
  buf.writeUInt32LE(40, 0); // Header size
  buf.writeInt32LE(width, 4); // Width
  buf.writeInt32LE(height * 2, 8); // Height (doubled for ICO format)
  buf.writeUInt16LE(1, 12); // Color planes
  buf.writeUInt16LE(bpp * 8, 14); // Bits per pixel
  buf.writeUInt32LE(0, 16); // Compression (0 = none)
  buf.writeUInt32LE(dataSize, 20); // Image size
  buf.writeInt32LE(0, 24); // X pixels per meter
  buf.writeInt32LE(0, 28); // Y pixels per meter
  buf.writeUInt32LE(0, 32); // Colors used
  buf.writeUInt32LE(0, 36); // Important colors
  return buf;
}

/**
 * Convert RGBA data to BGR (flip vertically and swap R/B channels)
 * ICO format requires bottom-up pixel order and BGR instead of RGB
 */
export function convertRgbaToBgr(
  rgbaData: Buffer,
  width: number,
  height: number,
  bpp: number
): Buffer {
  const cols = width * bpp;
  const rows = height * cols;
  const end = rows - cols;
  const buf = Buffer.alloc(rgbaData.length);

  // Flip vertically and convert RGBA to BGRA
  for (let row = 0; row < rows; row += cols) {
    for (let col = 0; col < cols; col += bpp) {
      const srcPos = row + col;
      const r = rgbaData.readUInt8(srcPos);
      const g = rgbaData.readUInt8(srcPos + 1);
      const b = rgbaData.readUInt8(srcPos + 2);
      const a = rgbaData.readUInt8(srcPos + 3);

      // Write to flipped position with BGR order
      const dstPos = end - row + col;
      buf.writeUInt8(b, dstPos);
      buf.writeUInt8(g, dstPos + 1);
      buf.writeUInt8(r, dstPos + 2);
      buf.writeUInt8(a, dstPos + 3);
    }
  }

  return buf;
}

/**
 * Generate ICO file from array of PNG buffers
 * Based on to-ico implementation but using Sharp for PNG parsing
 */
export async function generateIco(pngBuffers: Buffer[]): Promise<Buffer> {
  // Parse all PNG buffers
  const images = await Promise.all(pngBuffers.map(parsePng));

  // Create header
  const header = createIcoHeader(images.length);
  const parts: Buffer[] = [header];

  // Calculate offsets
  let offset =
    6 + // Header size
    16 * images.length; // Directory entries

  // Create directory entries
  const directories: Buffer[] = [];
  for (const img of images) {
    const bitmapSize = 40 + img.data.length; // BITMAPINFOHEADER + pixel data
    const dir = createIcoDirectory(
      img.width,
      img.height,
      img.bpp,
      bitmapSize,
      offset
    );
    directories.push(dir);
    offset += bitmapSize;
  }

  parts.push(...directories);

  // Create bitmap data for each image
  for (const img of images) {
    const bitmapHeader = createBitmapInfoHeader(
      img.width,
      img.height,
      img.bpp,
      img.data.length
    );
    const bgrData = convertRgbaToBgr(img.data, img.width, img.height, img.bpp);
    parts.push(bitmapHeader, bgrData);
  }

  // Concatenate all parts
  return Buffer.concat(parts);
}

async function generateFavicons(
  emoji: string,
  outDir: string,
  generateAll: boolean
) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Use optimized approach: render once, resize many
  const sizeMap = await generateAllSizesOptimized(emoji);

  // Get favicon buffers
  const faviconBuffers = SIZES.favicon.map((size) => sizeMap.get(size)!);

  // Save individual PNG favicons if --all flag is set
  if (generateAll) {
    const faviconDir = path.join(outDir, "favicons");
    if (!fs.existsSync(faviconDir)) {
      fs.mkdirSync(faviconDir, { recursive: true });
    }
    SIZES.favicon.forEach((size) => {
      const buffer = sizeMap.get(size)!;
      fs.writeFileSync(
        path.join(faviconDir, `favicon-${size}x${size}.png`),
        buffer
      );
    });
  }

  // Generate favicon.ico with multiple sizes
  const icoBuffer = await generateIco(faviconBuffers);
  fs.writeFileSync(path.join(outDir, "favicon.ico"), icoBuffer);

  if (generateAll) {
    // Create Apple touch icon directory
    const appleDir = path.join(outDir, "apple-touch-icon");
    if (!fs.existsSync(appleDir)) {
      fs.mkdirSync(appleDir);
    }

    // Save Apple touch icons
    SIZES.apple.forEach((size) => {
      const buffer = sizeMap.get(size)!;
      fs.writeFileSync(
        path.join(appleDir, `apple-touch-icon-${size}x${size}.png`),
        buffer
      );
    });

    console.log(`✅ Generated all favicon and Apple touch icon assets in ${outDir}!

Add this to your HTML <head> section:

<!-- Standard favicon -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">

<!-- PNG favicon alternatives -->
<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="48x48" href="/favicons/favicon-48x48.png">

<!-- Apple Touch Icons -->
<link rel="apple-touch-icon" sizes="57x57" href="/apple-touch-icon/apple-touch-icon-57x57.png">
<link rel="apple-touch-icon" sizes="60x60" href="/apple-touch-icon/apple-touch-icon-60x60.png">
<link rel="apple-touch-icon" sizes="72x72" href="/apple-touch-icon/apple-touch-icon-72x72.png">
<link rel="apple-touch-icon" sizes="76x76" href="/apple-touch-icon/apple-touch-icon-76x76.png">
<link rel="apple-touch-icon" sizes="114x114" href="/apple-touch-icon/apple-touch-icon-114x114.png">
<link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon/apple-touch-icon-120x120.png">
<link rel="apple-touch-icon" sizes="144x144" href="/apple-touch-icon/apple-touch-icon-144x144.png">
<link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon/apple-touch-icon-152x152.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon/apple-touch-icon-180x180.png">`);
  } else {
    console.log(`✅ Generated favicon.ico in ${outDir}!

Add this to your HTML <head> section:

<!-- Standard favicon -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">`);
  }
}

// Parse arguments and run (only if this file is executed directly, not imported)
if (require.main === module) {
  const { emoji, outDir, generateAll } = parseArgs();
  generateFavicons(emoji, outDir, generateAll).catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
}
