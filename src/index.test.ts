import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { PNG } from "pngjs";
import { createCanvas } from "@napi-rs/canvas";
import {
  parsePng,
  createIcoHeader,
  createIcoDirectory,
  createBitmapInfoHeader,
  convertRgbaToBgr,
  generateIco,
} from "./index";

const TEST_OUTPUT_DIR = path.join(__dirname, "../test-output");
const CLI_PATH = path.join(__dirname, "../dist/index.js");

// Helper function to create a safe directory name from an emoji
function getSafeDirName(emoji: string): string {
  return `emoji-${Buffer.from(emoji).toString("hex")}`;
}

// Helper function to create test PNG using Canvas
function createTestPng(
  width: number,
  height: number,
  color: { r: number; g: number; b: number; alpha: number }
): Buffer {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.alpha})`;
  ctx.fillRect(0, 0, width, height);
  return canvas.toBuffer("image/png");
}

// Helper function to get PNG metadata using pngjs
function getPngMetadata(pngBuffer: Buffer): { width: number; height: number } {
  const png = PNG.sync.read(pngBuffer);
  return { width: png.width, height: png.height };
}

describe("emojico CLI", () => {
  beforeAll(() => {
    // Ensure the CLI is built before running tests
    execSync("npm run build", { stdio: "inherit" });
  });

  beforeEach(() => {
    // Clean up test output directory before each test
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    // Do NOT create the test output directory here; let the CLI do it
  });

  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  describe("default behavior (favicon.ico only)", () => {
    it("should generate only favicon.ico", async () => {
      // Run the CLI without --all flag
      execSync(`node ${CLI_PATH} 🍎 --out ${TEST_OUTPUT_DIR}`);

      // Check if main directory exists
      expect(fs.existsSync(TEST_OUTPUT_DIR)).toBe(true);

      // Check if favicon.ico exists
      expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, "favicon.ico"))).toBe(
        true
      );

      // Check that other directories are not created
      expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, "favicons"))).toBe(false);
      expect(
        fs.existsSync(path.join(TEST_OUTPUT_DIR, "apple-touch-icon"))
      ).toBe(false);
    }, 30000);

    it("should create output directory if it doesn't exist", () => {
      const deepOutputDir = path.join(TEST_OUTPUT_DIR, "deep/nested/dir");
      execSync(`node ${CLI_PATH} 🍎 --out ${deepOutputDir}`);

      expect(fs.existsSync(deepOutputDir)).toBe(true);
      expect(fs.existsSync(path.join(deepOutputDir, "favicon.ico"))).toBe(true);
      expect(fs.existsSync(path.join(deepOutputDir, "favicons"))).toBe(false);
      expect(fs.existsSync(path.join(deepOutputDir, "apple-touch-icon"))).toBe(
        false
      );
    }, 30000);
  });

  describe("--all flag behavior", () => {
    it("should generate all required files with correct sizes", async () => {
      // Run the CLI with --all flag
      execSync(`node ${CLI_PATH} 🍎 --out ${TEST_OUTPUT_DIR} --all`);

      // Check if main directories exist
      expect(fs.existsSync(TEST_OUTPUT_DIR)).toBe(true);
      expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, "favicons"))).toBe(true);
      expect(
        fs.existsSync(path.join(TEST_OUTPUT_DIR, "apple-touch-icon"))
      ).toBe(true);

      // Check if favicon.ico exists
      expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, "favicon.ico"))).toBe(
        true
      );

      // Check favicon PNG files
      const faviconSizes = [16, 32, 48];
      for (const size of faviconSizes) {
        const filePath = path.join(
          TEST_OUTPUT_DIR,
          "favicons",
          `favicon-${size}x${size}.png`
        );
        expect(fs.existsSync(filePath)).toBe(true);

        // Verify image dimensions
        const fileBuffer = fs.readFileSync(filePath);
        const metadata = getPngMetadata(fileBuffer);
        expect(metadata.width).toBe(size);
        expect(metadata.height).toBe(size);
      }

      // Check Apple touch icon files
      const appleSizes = [57, 60, 72, 76, 114, 120, 144, 152, 180];
      for (const size of appleSizes) {
        const filePath = path.join(
          TEST_OUTPUT_DIR,
          "apple-touch-icon",
          `apple-touch-icon-${size}x${size}.png`
        );
        expect(fs.existsSync(filePath)).toBe(true);

        // Verify image dimensions
        const fileBuffer = fs.readFileSync(filePath);
        const metadata = getPngMetadata(fileBuffer);
        expect(metadata.width).toBe(size);
        expect(metadata.height).toBe(size);
      }
    }, 30000);

    it("should handle different emoji inputs with --all flag", () => {
      const emojis = ["😀", "🚀", "🌈", "💡"];

      for (const emoji of emojis) {
        const safeDirName = getSafeDirName(emoji);
        const emojiOutputDir = path.join(TEST_OUTPUT_DIR, safeDirName);

        // Create the directory before running the command
        fs.mkdirSync(emojiOutputDir, { recursive: true });

        execSync(`node ${CLI_PATH} ${emoji} --out ${emojiOutputDir} --all`);

        expect(fs.existsSync(path.join(emojiOutputDir, "favicon.ico"))).toBe(
          true
        );
        expect(fs.existsSync(path.join(emojiOutputDir, "favicons"))).toBe(true);
        expect(
          fs.existsSync(path.join(emojiOutputDir, "apple-touch-icon"))
        ).toBe(true);
      }
    }, 120000);
  });

  it("should use current directory as default when no output directory is specified", () => {
    // Change to a temporary directory for this test
    const originalCwd = process.cwd();
    const tempDir = path.join(TEST_OUTPUT_DIR, "temp-cwd");
    fs.mkdirSync(tempDir, { recursive: true });
    process.chdir(tempDir);

    try {
      // Run the CLI without --out flag
      execSync(`node ${CLI_PATH} 🍎`);

      // Check if favicon.ico was created in the current directory
      expect(fs.existsSync(path.join(tempDir, "favicon.ico"))).toBe(true);

      // Check that other directories are not created
      expect(fs.existsSync(path.join(tempDir, "favicons"))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, "apple-touch-icon"))).toBe(false);
    } finally {
      // Restore original working directory
      process.chdir(originalCwd);
    }
  }, 30000);

  it("should use current directory as default with --all flag", () => {
    // Change to a temporary directory for this test
    const originalCwd = process.cwd();
    const tempDir = path.join(TEST_OUTPUT_DIR, "temp-cwd-all");
    fs.mkdirSync(tempDir, { recursive: true });
    process.chdir(tempDir);

    try {
      // Run the CLI with --all flag but without --out flag
      execSync(`node ${CLI_PATH} 🍎 --all`);

      // Check if all files were created in the current directory
      expect(fs.existsSync(path.join(tempDir, "favicon.ico"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "favicons"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "apple-touch-icon"))).toBe(true);

      // Check that favicon PNG files exist
      const faviconSizes = [16, 32, 48];
      for (const size of faviconSizes) {
        const filePath = path.join(
          tempDir,
          "favicons",
          `favicon-${size}x${size}.png`
        );
        expect(fs.existsSync(filePath)).toBe(true);
      }

      // Check that Apple touch icon files exist
      const appleSizes = [57, 60, 72, 76, 114, 120, 144, 152, 180];
      for (const size of appleSizes) {
        const filePath = path.join(
          tempDir,
          "apple-touch-icon",
          `apple-touch-icon-${size}x${size}.png`
        );
        expect(fs.existsSync(filePath)).toBe(true);
      }
    } finally {
      // Restore original working directory
      process.chdir(originalCwd);
    }
  }, 30000);

  it("should fail when no emoji is provided", () => {
    expect(() => {
      execSync(`node ${CLI_PATH} --out ${TEST_OUTPUT_DIR}`);
    }).toThrow();
  });
});

describe("ICO generation", () => {
  describe("parsePng", () => {
    it("should parse a PNG buffer and extract image data", async () => {
      // Create a simple 16x16 PNG using Canvas
      const pngBuffer = createTestPng(16, 16, { r: 255, g: 0, b: 0, alpha: 1 });

      const result = await parsePng(pngBuffer);

      expect(result.width).toBe(16);
      expect(result.height).toBe(16);
      expect(result.bpp).toBe(4); // RGBA
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data.length).toBe(16 * 16 * 4); // width * height * 4 bytes
    });

    it("should handle different PNG sizes", async () => {
      const sizes = [32, 48, 64];

      for (const size of sizes) {
        const pngBuffer = createTestPng(size, size, { r: 0, g: 0, b: 0, alpha: 0 });

        const result = await parsePng(pngBuffer);

        expect(result.width).toBe(size);
        expect(result.height).toBe(size);
        expect(result.data.length).toBe(size * size * 4);
      }
    });
  });

  describe("createIcoHeader", () => {
    it("should create a valid ICO header", () => {
      const header = createIcoHeader(3);

      expect(header.length).toBe(6);
      expect(header.readUInt16LE(0)).toBe(0); // Reserved
      expect(header.readUInt16LE(2)).toBe(1); // Type (ICO)
      expect(header.readUInt16LE(4)).toBe(3); // Count
    });

    it("should handle different image counts", () => {
      for (const count of [1, 2, 5, 10]) {
        const header = createIcoHeader(count);
        expect(header.readUInt16LE(4)).toBe(count);
      }
    });
  });

  describe("createIcoDirectory", () => {
    it("should create a valid directory entry", () => {
      const dir = createIcoDirectory(16, 16, 4, 1000, 50);

      expect(dir.length).toBe(16);
      expect(dir.readUInt8(0)).toBe(16); // Width
      expect(dir.readUInt8(1)).toBe(16); // Height
      expect(dir.readUInt8(2)).toBe(0); // Color palette
      expect(dir.readUInt8(3)).toBe(0); // Reserved
      expect(dir.readUInt16LE(4)).toBe(1); // Color planes
      expect(dir.readUInt16LE(6)).toBe(32); // Bits per pixel (4 * 8)
      expect(dir.readUInt32LE(8)).toBe(1000); // Size
      expect(dir.readUInt32LE(12)).toBe(50); // Offset
    });

    it("should handle 256x256 images (encoded as 0)", () => {
      const dir = createIcoDirectory(256, 256, 4, 2000, 100);

      expect(dir.readUInt8(0)).toBe(0); // Width (256 encoded as 0)
      expect(dir.readUInt8(1)).toBe(0); // Height (256 encoded as 0)
    });
  });

  describe("createBitmapInfoHeader", () => {
    it("should create a valid BITMAPINFOHEADER", () => {
      const header = createBitmapInfoHeader(16, 16, 4, 1024);

      expect(header.length).toBe(40);
      expect(header.readUInt32LE(0)).toBe(40); // Header size
      expect(header.readInt32LE(4)).toBe(16); // Width
      expect(header.readInt32LE(8)).toBe(32); // Height (doubled for ICO)
      expect(header.readUInt16LE(12)).toBe(1); // Color planes
      expect(header.readUInt16LE(14)).toBe(32); // Bits per pixel
      expect(header.readUInt32LE(16)).toBe(0); // Compression
      expect(header.readUInt32LE(20)).toBe(1024); // Image size
    });

    it("should double the height value", () => {
      const header = createBitmapInfoHeader(32, 32, 4, 2048);
      expect(header.readInt32LE(8)).toBe(64); // Height * 2
    });
  });

  describe("convertRgbaToBgr", () => {
    it("should convert RGBA to BGRA and flip vertically", () => {
      // Create a 2x2 image with known colors
      // Top row: Red, Green
      // Bottom row: Blue, White
      const rgba = Buffer.alloc(16); // 2x2x4 bytes
      // Top-left (Red)
      rgba.writeUInt8(255, 0); // R
      rgba.writeUInt8(0, 1); // G
      rgba.writeUInt8(0, 2); // B
      rgba.writeUInt8(255, 3); // A
      // Top-right (Green)
      rgba.writeUInt8(0, 4); // R
      rgba.writeUInt8(255, 5); // G
      rgba.writeUInt8(0, 6); // B
      rgba.writeUInt8(255, 7); // A
      // Bottom-left (Blue)
      rgba.writeUInt8(0, 8); // R
      rgba.writeUInt8(0, 9); // G
      rgba.writeUInt8(255, 10); // B
      rgba.writeUInt8(255, 11); // A
      // Bottom-right (White)
      rgba.writeUInt8(255, 12); // R
      rgba.writeUInt8(255, 13); // G
      rgba.writeUInt8(255, 14); // B
      rgba.writeUInt8(255, 15); // A

      const bgr = convertRgbaToBgr(rgba, 2, 2, 4);

      // After flipping and converting, bottom row should be on top
      // Bottom-left (Blue) should be at top-left position
      expect(bgr.readUInt8(0)).toBe(255); // B (was bottom-left)
      expect(bgr.readUInt8(1)).toBe(0); // G
      expect(bgr.readUInt8(2)).toBe(0); // R
      expect(bgr.readUInt8(3)).toBe(255); // A

      // Bottom-right (White) should be at top-right position
      expect(bgr.readUInt8(4)).toBe(255); // B
      expect(bgr.readUInt8(5)).toBe(255); // G
      expect(bgr.readUInt8(6)).toBe(255); // R
      expect(bgr.readUInt8(7)).toBe(255); // A
    });

    it("should preserve buffer size", () => {
      const width = 10;
      const height = 10;
      const rgba = Buffer.alloc(width * height * 4);
      rgba.fill(128); // Fill with gray

      const bgr = convertRgbaToBgr(rgba, width, height, 4);

      expect(bgr.length).toBe(rgba.length);
    });
  });

  describe("generateIco", () => {
    it("should generate a valid ICO file from PNG buffers", async () => {
      // Create test PNG buffers
      const png16 = createTestPng(16, 16, { r: 255, g: 0, b: 0, alpha: 1 });
      const png32 = createTestPng(32, 32, { r: 0, g: 255, b: 0, alpha: 1 });

      const icoBuffer = await generateIco([png16, png32]);

      // Check ICO file structure
      expect(icoBuffer.length).toBeGreaterThan(0);
      expect(icoBuffer.readUInt16LE(0)).toBe(0); // Reserved
      expect(icoBuffer.readUInt16LE(2)).toBe(1); // Type
      expect(icoBuffer.readUInt16LE(4)).toBe(2); // Count (2 images)

      // Check directory entries exist
      expect(icoBuffer.length).toBeGreaterThan(6 + 16 * 2); // Header + 2 directory entries
    });

    it("should generate ICO with single image", async () => {
      const png = createTestPng(48, 48, { r: 0, g: 0, b: 255, alpha: 1 });

      const icoBuffer = await generateIco([png]);

      expect(icoBuffer.readUInt16LE(4)).toBe(1); // Count
      expect(icoBuffer.length).toBeGreaterThan(6 + 16); // Header + 1 directory entry
    });

    it("should generate ICO with multiple sizes (favicon sizes)", async () => {
      const sizes = [16, 32, 48];
      const pngBuffers = sizes.map((size) =>
        createTestPng(size, size, { r: 128, g: 128, b: 128, alpha: 1 })
      );

      const icoBuffer = await generateIco(pngBuffers);

      expect(icoBuffer.readUInt16LE(4)).toBe(3); // Count (3 images)
      expect(icoBuffer.length).toBeGreaterThan(6 + 16 * 3); // Header + 3 directory entries
    });

    it("should produce a file that can be read as ICO", async () => {
      const png = createTestPng(16, 16, { r: 255, g: 255, b: 255, alpha: 1 });

      const icoBuffer = await generateIco([png]);

      // Write to temp file and verify it's recognized as ICO
      const tempFile = path.join(__dirname, "../test-output", "test.ico");
      fs.mkdirSync(path.dirname(tempFile), { recursive: true });
      fs.writeFileSync(tempFile, icoBuffer);

      // Check file exists and has content
      expect(fs.existsSync(tempFile)).toBe(true);
      expect(fs.statSync(tempFile).size).toBeGreaterThan(0);

      // Clean up
      fs.unlinkSync(tempFile);
    });
  });
});
