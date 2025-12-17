#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";
import toIco from "to-ico";

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
  const icoBuffer = await toIco(faviconBuffers);
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

// Parse arguments and run
const { emoji, outDir, generateAll } = parseArgs();
generateFavicons(emoji, outDir, generateAll).catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
