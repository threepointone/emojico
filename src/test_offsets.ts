import { createCanvas } from "@napi-rs/canvas";
import * as fs from "fs";

const testEmoji = "📔";
const testSize = 180;

// Test various offset percentages
const offsetValues = [0, 0.05, 0.08, 0.10, 0.12, 0.15];

offsetValues.forEach(offsetPercent => {
  const canvas = createCanvas(testSize, testSize);
  const ctx = canvas.getContext("2d");
  
  // Draw reference lines
  ctx.strokeStyle = "rgba(200, 200, 200, 0.5)";
  ctx.beginPath();
  ctx.moveTo(0, testSize / 2);
  ctx.lineTo(testSize, testSize / 2);
  ctx.stroke();
  
  // Render emoji with offset
  const fontHeight = Math.floor(testSize * 0.8);
  ctx.font = `${fontHeight}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "EmojiOne Color", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  
  const yPos = (testSize / 2) + (testSize * offsetPercent);
  ctx.fillText(testEmoji, testSize / 2, yPos);
  
  const buffer = canvas.toBuffer("image/png");
  fs.writeFileSync(`/tmp/test_offset_${(offsetPercent * 100).toFixed(0)}.png`, buffer);
  console.log(`Created test with ${(offsetPercent * 100)}% offset`);
});
