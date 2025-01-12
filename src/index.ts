#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import puppeteer from "puppeteer";
import sharp from "sharp";
import toIco from "to-ico";

const SIZES = {
  favicon: [16, 32, 48],
  apple: [57, 60, 72, 76, 114, 120, 144, 152, 180],
};

async function emojiToImage(emoji: string, size: number): Promise<Buffer> {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set viewport to be larger than needed to ensure high quality rendering
  await page.setViewport({ width: 512, height: 512 });

  // Create an HTML page with the emoji
  await page.setContent(`
    <html>
      <head>
        <style>
          body {
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: transparent;
          }
          .emoji {
            font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
            font-size: 400px;
            line-height: 1;
          }
        </style>
      </head>
      <body>
        <div class="emoji">${emoji}</div>
      </body>
    </html>
  `);

  // Take a screenshot of the emoji
  const element = await page.$(".emoji");
  const screenshot = await element!.screenshot({
    omitBackground: true,
  });

  await browser.close();

  // Resize the image to the desired size
  const resized = await sharp(screenshot)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return resized;
}

async function generateFavicons(emoji: string, outDir: string) {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Create subdirectories
  const faviconDir = path.join(outDir, "favicons");
  const appleDir = path.join(outDir, "apple-touch-icon");

  if (!fs.existsSync(faviconDir)) {
    fs.mkdirSync(faviconDir);
  }
  if (!fs.existsSync(appleDir)) {
    fs.mkdirSync(appleDir);
  }

  // Generate favicon sizes
  const faviconBuffers = await Promise.all(
    SIZES.favicon.map(async (size) => {
      const buffer = await emojiToImage(emoji, size);
      fs.writeFileSync(
        path.join(faviconDir, `favicon-${size}x${size}.png`),
        buffer
      );
      return buffer;
    })
  );

  // Generate Apple touch icon sizes
  await Promise.all(
    SIZES.apple.map(async (size) => {
      const buffer = await emojiToImage(emoji, size);
      fs.writeFileSync(
        path.join(appleDir, `apple-touch-icon-${size}x${size}.png`),
        buffer
      );
    })
  );

  // Generate favicon.ico with multiple sizes
  const icoBuffer = await toIco(faviconBuffers);
  fs.writeFileSync(path.join(outDir, "favicon.ico"), icoBuffer);

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
}

const program = new Command();

program
  .name("emojico")
  .description("CLI to convert emoji to favicon and Apple touch icon assets")
  .argument("<emoji>", "emoji to convert")
  .requiredOption(
    "-o, --out <dir>",
    "output directory for the generated assets"
  )
  .action((emoji, options) => {
    generateFavicons(emoji, options.out).catch(console.error);
  });

program.parse();
