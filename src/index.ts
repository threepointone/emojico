import * as fs from "fs";
import * as path from "path";
import { PNG } from "pngjs";

// Import canvas library
import { createCanvas, loadImage } from "@napi-rs/canvas";

export interface EmojiEntry {
  name: string;
  slug: string;
  group: string;
  emoji_version: string;
  unicode_version: string;
  skin_tone_support: boolean;
}

const SIZES = {
  favicon: [16, 32, 48],
  apple: [57, 60, 72, 76, 114, 120, 144, 152, 180],
};

function printHelp() {
  console.log(`
emojico - Convert emoji to favicon and Apple touch icon assets

Usage: emojico [emoji] [--out <directory>] [--all]

Run without an emoji argument to interactively search and pick one.

Options:
  --out, -o <directory>  Output directory for the generated assets (default: current directory)
  --all                  Generate all assets (favicon.ico, PNG favicons, Apple touch icons, and og:image)
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

  if (args.includes("--help") || args.includes("-h")) {
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

  return { emoji, outDir, generateAll };
}

export function searchEmoji(
  entries: Array<[string, EmojiEntry]>,
  query: string
): Array<[string, EmojiEntry]> {
  if (!query.trim()) return entries.slice(0, 10);
  const lower = query.toLowerCase();

  const scored: Array<{ item: [string, EmojiEntry]; score: number }> = [];

  for (const entry of entries) {
    const name = entry[1].name.toLowerCase();
    let score = 0;
    if (name === lower) score = 3;
    else if (name.startsWith(lower)) score = 2;
    else if (name.includes(lower)) score = 1;
    else {
      const words = lower.split(/\s+/);
      if (words.every((w) => name.includes(w))) score = 0.5;
    }
    if (score > 0) scored.push({ item: entry, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 10).map((s) => s.item);
}

function interactiveEmojiPicker(): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const emojiData: Record<string, EmojiEntry> =
    require("unicode-emoji-json");
  const emojiEntries = Object.entries(emojiData) as Array<
    [string, EmojiEntry]
  >;

  if (!process.stdin.isTTY) {
    console.error("Interactive mode requires a terminal.");
    process.exit(1);
  }

  return new Promise((resolve) => {
    let query = "";
    let selectedIndex = 0;
    let results = searchEmoji(emojiEntries, "");
    let prevLineCount = 0;

    const stdout = process.stdout;
    const stdin = process.stdin;

    stdout.write("\x1b[?25l");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function cleanup() {
      stdout.write("\x1b[?25h");
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeAllListeners("data");
    }

    function render() {
      if (prevLineCount > 0) {
        stdout.write(`\x1b[${prevLineCount}A`);
      }
      stdout.write("\x1b[0J");

      const lines: string[] = [];
      lines.push(`  \x1b[1m🔍 Search:\x1b[0m ${query}\x1b[2m█\x1b[0m`);
      lines.push("");

      if (results.length === 0) {
        lines.push("  No emoji found");
      } else {
        for (let i = 0; i < results.length; i++) {
          const [emoji, entry] = results[i];
          if (i === selectedIndex) {
            lines.push(
              `  \x1b[36m❯\x1b[0m ${emoji}  \x1b[1m${entry.name}\x1b[0m`
            );
          } else {
            lines.push(`    ${emoji}  ${entry.name}`);
          }
        }
      }

      lines.push("");
      lines.push(
        "  \x1b[2m↑/↓ navigate · enter select · esc quit\x1b[0m"
      );

      stdout.write(lines.join("\n") + "\n");
      prevLineCount = lines.length;
    }

    function onData(key: string) {
      if (key === "\x03" || (key === "\x1b" && key.length === 1)) {
        cleanup();
        if (prevLineCount > 0) {
          stdout.write(`\x1b[${prevLineCount}A\x1b[0J`);
        }
        console.log("Cancelled.");
        process.exit(0);
      }

      if (key === "\r") {
        if (results.length > 0 && selectedIndex < results.length) {
          const [emoji, entry] = results[selectedIndex];
          cleanup();
          if (prevLineCount > 0) {
            stdout.write(`\x1b[${prevLineCount}A\x1b[0J`);
          }
          console.log(`Selected: ${emoji}  ${entry.name}`);
          resolve(emoji);
          return;
        }
      }

      if (key[0] === "\x1b" && key.length > 1) {
        if (key === "\x1b[A") {
          selectedIndex = Math.max(0, selectedIndex - 1);
        } else if (key === "\x1b[B") {
          selectedIndex = Math.min(results.length - 1, selectedIndex + 1);
        }
        render();
        return;
      }

      if (key === "\x7f" || key === "\b") {
        if (query.length > 0) {
          query = query.slice(0, -1);
          selectedIndex = 0;
          results = searchEmoji(emojiEntries, query);
          render();
        }
        return;
      }

      if (key >= " " && key <= "~") {
        query += key;
        selectedIndex = 0;
        results = searchEmoji(emojiEntries, query);
        render();
        return;
      }
    }

    stdin.on("data", onData);
    render();
  });
}

export function getDirCompletions(input: string): string[] {
  let searchDir: string;
  let prefix: string;

  if (!input || input === "." || input === "./") {
    searchDir = ".";
    prefix = "";
  } else if (input.endsWith("/")) {
    searchDir = input.slice(0, -1);
    prefix = "";
  } else {
    searchDir = path.dirname(input);
    prefix = path.basename(input).toLowerCase();
  }

  try {
    const entries = fs.readdirSync(searchDir, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith(".") &&
          e.name !== "node_modules" &&
          (!prefix || e.name.toLowerCase().startsWith(prefix))
      )
      .map((e) => (searchDir === "." ? "./" + e.name : searchDir + "/" + e.name))
      .slice(0, 5);
  } catch {
    return [];
  }
}

function interactiveFolderPrompt(): Promise<string> {
  return new Promise((resolve) => {
    let value = ".";
    let completions = getDirCompletions(value);
    let selectedCompletion = 0;
    let prevLineCount = 0;

    const stdout = process.stdout;
    const stdin = process.stdin;

    stdout.write("\x1b[?25l");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function cleanup() {
      stdout.write("\x1b[?25h");
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeAllListeners("data");
    }

    function render() {
      if (prevLineCount > 0) {
        stdout.write(`\x1b[${prevLineCount}A`);
      }
      stdout.write("\x1b[0J");

      const lines: string[] = [];
      lines.push(
        `  \x1b[1m\u{1F4C1} Output folder:\x1b[0m ${value}\x1b[2m\u2588\x1b[0m`
      );
      lines.push("");

      if (completions.length > 0) {
        for (let i = 0; i < completions.length; i++) {
          if (i === selectedCompletion) {
            lines.push(
              `  \x1b[36m\u276f\x1b[0m \x1b[1m${completions[i]}\x1b[0m`
            );
          } else {
            lines.push(`    ${completions[i]}`);
          }
        }
      }

      lines.push("");
      lines.push(
        "  \x1b[2mtab complete \u00b7 \u2191/\u2193 navigate \u00b7 enter confirm \u00b7 esc quit\x1b[0m"
      );

      stdout.write(lines.join("\n") + "\n");
      prevLineCount = lines.length;
    }

    function onData(key: string) {
      if (key === "\x03" || (key === "\x1b" && key.length === 1)) {
        cleanup();
        if (prevLineCount > 0) {
          stdout.write(`\x1b[${prevLineCount}A\x1b[0J`);
        }
        console.log("Cancelled.");
        process.exit(0);
      }

      if (key === "\t") {
        if (completions.length > 0 && selectedCompletion < completions.length) {
          value = completions[selectedCompletion] + "/";
          completions = getDirCompletions(value);
          selectedCompletion = 0;
          render();
        }
        return;
      }

      if (key === "\r") {
        const finalValue = value.replace(/\/+$/, "") || ".";
        cleanup();
        if (prevLineCount > 0) {
          stdout.write(`\x1b[${prevLineCount}A\x1b[0J`);
        }
        console.log(`  \u{1F4C1} Output folder: ${finalValue}`);
        resolve(finalValue);
        return;
      }

      if (key[0] === "\x1b" && key.length > 1) {
        if (key === "\x1b[A") {
          selectedCompletion = Math.max(0, selectedCompletion - 1);
        } else if (key === "\x1b[B") {
          selectedCompletion = Math.min(
            completions.length - 1,
            selectedCompletion + 1
          );
        }
        render();
        return;
      }

      if (key === "\x7f" || key === "\b") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          selectedCompletion = 0;
          completions = getDirCompletions(value);
          render();
        }
        return;
      }

      if (key >= " " && key <= "~") {
        value += key;
        selectedCompletion = 0;
        completions = getDirCompletions(value);
        render();
        return;
      }
    }

    stdin.on("data", onData);
    render();
  });
}

function interactiveAllToggle(): Promise<boolean> {
  return new Promise((resolve) => {
    let selected = false;
    let prevLineCount = 0;

    const stdout = process.stdout;
    const stdin = process.stdin;

    stdout.write("\x1b[?25l");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function cleanup() {
      stdout.write("\x1b[?25h");
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeAllListeners("data");
    }

    function render() {
      if (prevLineCount > 0) {
        stdout.write(`\x1b[${prevLineCount}A`);
      }
      stdout.write("\x1b[0J");

      const lines: string[] = [];
      lines.push(`  \x1b[1m\u{1F4E6} Generate all assets?\x1b[0m`);
      lines.push("");

      if (!selected) {
        lines.push(
          `  \x1b[36m\u276f\x1b[0m \x1b[1mfavicon.ico only\x1b[0m`
        );
        lines.push(
          `    All assets (favicons, Apple touch icons, og:image)`
        );
      } else {
        lines.push(`    favicon.ico only`);
        lines.push(
          `  \x1b[36m\u276f\x1b[0m \x1b[1mAll assets (favicons, Apple touch icons, og:image)\x1b[0m`
        );
      }

      lines.push("");
      lines.push(
        "  \x1b[2m\u2191/\u2193 toggle \u00b7 enter confirm \u00b7 esc quit\x1b[0m"
      );

      stdout.write(lines.join("\n") + "\n");
      prevLineCount = lines.length;
    }

    function onData(key: string) {
      if (key === "\x03" || (key === "\x1b" && key.length === 1)) {
        cleanup();
        if (prevLineCount > 0) {
          stdout.write(`\x1b[${prevLineCount}A\x1b[0J`);
        }
        console.log("Cancelled.");
        process.exit(0);
      }

      if (key === "\r") {
        cleanup();
        if (prevLineCount > 0) {
          stdout.write(`\x1b[${prevLineCount}A\x1b[0J`);
        }
        const label = selected
          ? "All assets"
          : "favicon.ico only";
        console.log(`  \u{1F4E6} ${label}`);
        resolve(selected);
        return;
      }

      if (key[0] === "\x1b" && key.length > 1) {
        if (key === "\x1b[A" || key === "\x1b[B") {
          selected = !selected;
        }
        render();
        return;
      }
    }

    stdin.on("data", onData);
    render();
  });
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
 * Resize PNG buffer to target size using Canvas API
 * Implements "fit: contain" behavior with transparent background
 */
async function resizePng(
  pngBuffer: Buffer,
  targetSize: number
): Promise<Buffer> {
  const image = await loadImage(pngBuffer);
  const canvas = createCanvas(targetSize, targetSize);
  const ctx = canvas.getContext("2d");

  // Calculate scaling to fit (contain) - maintain aspect ratio
  const scale = Math.min(targetSize / image.width, targetSize / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (targetSize - width) / 2;
  const y = (targetSize - height) / 2;

  // Draw scaled image centered on transparent background
  ctx.drawImage(image, x, y, width, height);
  return canvas.toBuffer("image/png");
}

/**
 * Generate Open Graph image (1200x630) with emoji centered on white background
 * The emoji is rendered at a larger size (600px) for better visibility
 */
async function generateOgImage(emoji: string): Promise<Buffer> {
  const OG_WIDTH = 1200;
  const OG_HEIGHT = 630;
  const EMOJI_SIZE = 600; // Larger emoji size for better visibility

  // Render emoji at high resolution
  const emojiBuffer = emojiToImageCanvas(emoji, EMOJI_SIZE);
  const emojiImage = await loadImage(emojiBuffer);

  // Create canvas with white background
  const canvas = createCanvas(OG_WIDTH, OG_HEIGHT);
  const ctx = canvas.getContext("2d");

  // Fill with white background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

  // Center the emoji
  const x = (OG_WIDTH - EMOJI_SIZE) / 2;
  const y = (OG_HEIGHT - EMOJI_SIZE) / 2;
  ctx.drawImage(emojiImage, x, y, EMOJI_SIZE, EMOJI_SIZE);

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

  // Resize to all sizes using Canvas API
  const buffers = await Promise.all(
    allSizes.map(async (size) => {
      const buffer = await resizePng(highResBuffer, size);
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
 * Parse PNG buffer and extract image data using pngjs
 */
export async function parsePng(pngBuffer: Buffer): Promise<{
  width: number;
  height: number;
  bpp: number; // bytes per pixel (4 for RGBA)
  data: Buffer; // raw RGBA pixel data
}> {
  const png = PNG.sync.read(pngBuffer);

  return {
    width: png.width,
    height: png.height,
    bpp: 4, // RGBA = 4 bytes per pixel
    data: png.data, // Already RGBA Buffer
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
 * Based on to-ico implementation but using pngjs for PNG parsing
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

    // Generate Open Graph image
    const ogImageBuffer = await generateOgImage(emoji);
    fs.writeFileSync(path.join(outDir, "og-image.png"), ogImageBuffer);

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
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon/apple-touch-icon-180x180.png">

<!-- Open Graph Image -->
<meta property="og:image" content="/og-image.png">`);
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

  (async () => {
    if (emoji) {
      await generateFavicons(emoji, outDir, generateAll);
    } else {
      const selectedEmoji = await interactiveEmojiPicker();
      const selectedFolder = await interactiveFolderPrompt();
      const selectedAll = await interactiveAllToggle();
      console.log("");
      await generateFavicons(selectedEmoji, selectedFolder, selectedAll);
    }
  })().catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });
}
