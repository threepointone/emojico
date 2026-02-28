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
  searchEmoji,
  getDirCompletions,
  EmojiEntry,
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
      // Check that og-image.png is not generated without --all
      expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, "og-image.png"))).toBe(
        false
      );
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

      // Check Open Graph image
      const ogImagePath = path.join(TEST_OUTPUT_DIR, "og-image.png");
      expect(fs.existsSync(ogImagePath)).toBe(true);

      // Verify og-image dimensions (1200x630)
      const ogImageBuffer = fs.readFileSync(ogImagePath);
      const ogMetadata = getPngMetadata(ogImageBuffer);
      expect(ogMetadata.width).toBe(1200);
      expect(ogMetadata.height).toBe(630);
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
        // Check that og-image.png is generated for each emoji
        expect(fs.existsSync(path.join(emojiOutputDir, "og-image.png"))).toBe(
          true
        );
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
      // Check that og-image.png is not generated without --all
      expect(fs.existsSync(path.join(tempDir, "og-image.png"))).toBe(false);
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

      // Check that og-image.png exists
      expect(fs.existsSync(path.join(tempDir, "og-image.png"))).toBe(true);
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

  describe("favicon.ico structure", () => {
    it("should contain 3 embedded images (16, 32, 48)", () => {
      const outDir = path.join(TEST_OUTPUT_DIR, "ico-structure");
      execSync(`node ${CLI_PATH} 🍎 --out ${outDir}`);

      const ico = fs.readFileSync(path.join(outDir, "favicon.ico"));
      expect(ico.readUInt16LE(0)).toBe(0); // Reserved
      expect(ico.readUInt16LE(2)).toBe(1); // Type: ICO
      expect(ico.readUInt16LE(4)).toBe(3); // Count: 3 images

      // Read directory entries (each 16 bytes, starting at offset 6)
      const sizes = [];
      for (let i = 0; i < 3; i++) {
        const offset = 6 + i * 16;
        const w = ico.readUInt8(offset);
        sizes.push(w === 0 ? 256 : w);
      }
      expect(sizes.sort((a, b) => a - b)).toEqual([16, 32, 48]);
    }, 30000);

    it("should produce a non-trivial file size", () => {
      const outDir = path.join(TEST_OUTPUT_DIR, "ico-size");
      execSync(`node ${CLI_PATH} 🚀 --out ${outDir}`);

      const stat = fs.statSync(path.join(outDir, "favicon.ico"));
      expect(stat.size).toBeGreaterThan(1000);
    }, 30000);
  });

  describe("multi-codepoint emoji", () => {
    it("should handle ZWJ sequences", () => {
      const outDir = path.join(TEST_OUTPUT_DIR, "zwj-test");
      execSync(
        `node ${CLI_PATH} $'\\U0001F468\\u200D\\U0001F469\\u200D\\U0001F467' --out ${outDir}`
      );
      expect(fs.existsSync(path.join(outDir, "favicon.ico"))).toBe(true);
    }, 30000);

    it("should handle flag emoji", () => {
      const outDir = path.join(TEST_OUTPUT_DIR, "flag-test");
      execSync(`node ${CLI_PATH} 🇺🇸 --out ${outDir}`);
      expect(fs.existsSync(path.join(outDir, "favicon.ico"))).toBe(true);
    }, 30000);

    it("should handle skin tone modifier emoji", () => {
      const outDir = path.join(TEST_OUTPUT_DIR, "skin-tone-test");
      execSync(`node ${CLI_PATH} 👋🏽 --out ${outDir}`);
      expect(fs.existsSync(path.join(outDir, "favicon.ico"))).toBe(true);
    }, 30000);

    it("should handle keycap emoji", () => {
      const outDir = path.join(TEST_OUTPUT_DIR, "keycap-test");
      execSync(`node ${CLI_PATH} '#️⃣' --out ${outDir}`);
      expect(fs.existsSync(path.join(outDir, "favicon.ico"))).toBe(true);
    }, 30000);
  });

  describe("CLI flag ordering", () => {
    it("should accept --all before --out", () => {
      const outDir = path.join(TEST_OUTPUT_DIR, "flag-order-1");
      execSync(`node ${CLI_PATH} 🍎 --all --out ${outDir}`);
      expect(fs.existsSync(path.join(outDir, "favicon.ico"))).toBe(true);
      expect(fs.existsSync(path.join(outDir, "favicons"))).toBe(true);
      expect(
        fs.existsSync(path.join(outDir, "apple-touch-icon"))
      ).toBe(true);
    }, 30000);

    it("should accept emoji after flags", () => {
      const outDir = path.join(TEST_OUTPUT_DIR, "flag-order-2");
      execSync(`node ${CLI_PATH} --out ${outDir} 🍎`);
      expect(fs.existsSync(path.join(outDir, "favicon.ico"))).toBe(true);
    }, 30000);

    it("should accept -o with --all in any order", () => {
      const outDir = path.join(TEST_OUTPUT_DIR, "flag-order-3");
      execSync(`node ${CLI_PATH} --all -o ${outDir} 🍎`);
      expect(fs.existsSync(path.join(outDir, "favicon.ico"))).toBe(true);
      expect(fs.existsSync(path.join(outDir, "og-image.png"))).toBe(true);
    }, 30000);
  });

  describe("error handling", () => {
    it("should error when --out has no value", () => {
      expect(() => {
        execSync(`node ${CLI_PATH} 🍎 --out`, { encoding: "utf8" });
      }).toThrow();
    });

    it("should error when -o has no value", () => {
      expect(() => {
        execSync(`node ${CLI_PATH} 🍎 -o`, { encoding: "utf8" });
      }).toThrow();
    });
  });
});

describe("searchEmoji", () => {
  const makeEntry = (
    emoji: string,
    name: string
  ): [string, EmojiEntry] => [
    emoji,
    {
      name,
      slug: name.replace(/\s+/g, "_"),
      group: "Test",
      emoji_version: "1.0",
      unicode_version: "1.0",
      skin_tone_support: false,
    },
  ];

  const entries: Array<[string, EmojiEntry]> = [
    makeEntry("\u{1F600}", "grinning face"),
    makeEntry("\u{1F604}", "grinning face with smiling eyes"),
    makeEntry("\u{1F34E}", "red apple"),
    makeEntry("\u{1F34F}", "green apple"),
    makeEntry("\u{1F431}", "cat face"),
    makeEntry("\u{1F408}", "cat"),
    makeEntry("\u{1F415}", "dog"),
    makeEntry("\u{1F436}", "dog face"),
    makeEntry("\u{2764}\u{FE0F}", "red heart"),
    makeEntry("\u{1F499}", "blue heart"),
    makeEntry("\u{1F49A}", "green heart"),
    makeEntry("\u{1F49B}", "yellow heart"),
  ];

  it("should return first 10 entries for empty query", () => {
    const results = searchEmoji(entries, "");
    expect(results.length).toBe(10);
    expect(results[0][1].name).toBe("grinning face");
  });

  it("should return first 10 entries for whitespace-only query", () => {
    const results = searchEmoji(entries, "   ");
    expect(results.length).toBe(10);
  });

  it("should rank exact matches highest", () => {
    const results = searchEmoji(entries, "cat");
    expect(results[0][1].name).toBe("cat");
  });

  it("should rank starts-with above contains", () => {
    const results = searchEmoji(entries, "red");
    expect(results[0][1].name).toBe("red apple");
    expect(results[1][1].name).toBe("red heart");
  });

  it("should find contains matches", () => {
    const results = searchEmoji(entries, "apple");
    expect(results.length).toBe(2);
    expect(results.map((r) => r[1].name)).toContain("red apple");
    expect(results.map((r) => r[1].name)).toContain("green apple");
  });

  it("should be case-insensitive", () => {
    const results = searchEmoji(entries, "CAT");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0][1].name).toBe("cat");
  });

  it("should support multi-word matching", () => {
    const results = searchEmoji(entries, "face grinning");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0][1].name).toContain("grinning");
    expect(results[0][1].name).toContain("face");
  });

  it("should return empty array for no matches", () => {
    const results = searchEmoji(entries, "zzzzzzz");
    expect(results).toEqual([]);
  });

  it("should return at most 10 results", () => {
    const manyEntries = Array.from({ length: 50 }, (_, i) =>
      makeEntry(`E${i}`, `heart variant ${i}`)
    );
    const results = searchEmoji(manyEntries, "heart");
    expect(results.length).toBe(10);
  });

  it("should work with real emoji data", () => {
    const emojiData: Record<string, EmojiEntry> = require("unicode-emoji-json");
    const realEntries = Object.entries(emojiData) as Array<[string, EmojiEntry]>;

    const results = searchEmoji(realEntries, "rocket");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0][0]).toBe("\u{1F680}");
  });
});

describe("getDirCompletions", () => {
  const TEMP_DIR = path.join(__dirname, "../test-output/completions-test");

  beforeAll(() => {
    fs.mkdirSync(path.join(TEMP_DIR, "alpha"), { recursive: true });
    fs.mkdirSync(path.join(TEMP_DIR, "alpha/nested"), { recursive: true });
    fs.mkdirSync(path.join(TEMP_DIR, "bravo"), { recursive: true });
    fs.mkdirSync(path.join(TEMP_DIR, "charlie"), { recursive: true });
    fs.mkdirSync(path.join(TEMP_DIR, ".hidden"), { recursive: true });
    fs.mkdirSync(path.join(TEMP_DIR, "node_modules"), { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true });
    }
  });

  it("should list directories for empty input from cwd", () => {
    const originalCwd = process.cwd();
    process.chdir(TEMP_DIR);
    try {
      const results = getDirCompletions("");
      expect(results).toContain("./alpha");
      expect(results).toContain("./bravo");
      expect(results).toContain("./charlie");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should list directories for '.' input", () => {
    const originalCwd = process.cwd();
    process.chdir(TEMP_DIR);
    try {
      const results = getDirCompletions(".");
      expect(results.length).toBeGreaterThan(0);
      expect(results).toContain("./alpha");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should list directories for './' input", () => {
    const originalCwd = process.cwd();
    process.chdir(TEMP_DIR);
    try {
      const results = getDirCompletions("./");
      expect(results).toContain("./alpha");
      expect(results).toContain("./bravo");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should filter by prefix", () => {
    const originalCwd = process.cwd();
    process.chdir(TEMP_DIR);
    try {
      const results = getDirCompletions("./a");
      expect(results).toEqual(["./alpha"]);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should list subdirectories with trailing slash", () => {
    const originalCwd = process.cwd();
    process.chdir(TEMP_DIR);
    try {
      const results = getDirCompletions("./alpha/");
      expect(results).toEqual(["./alpha/nested"]);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should filter out hidden directories", () => {
    const originalCwd = process.cwd();
    process.chdir(TEMP_DIR);
    try {
      const results = getDirCompletions("");
      const hidden = results.filter((r) => r.includes(".hidden"));
      expect(hidden).toEqual([]);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should filter out node_modules", () => {
    const originalCwd = process.cwd();
    process.chdir(TEMP_DIR);
    try {
      const results = getDirCompletions("");
      const nm = results.filter((r) => r.includes("node_modules"));
      expect(nm).toEqual([]);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should return empty array for nonexistent path", () => {
    const results = getDirCompletions("/nonexistent/path/xyz");
    expect(results).toEqual([]);
  });

  it("should be case-insensitive when filtering", () => {
    const originalCwd = process.cwd();
    process.chdir(TEMP_DIR);
    try {
      const results = getDirCompletions("./A");
      expect(results).toEqual(["./alpha"]);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("should return at most 5 results", () => {
    const manyDirsBase = path.join(TEMP_DIR, "many");
    for (let i = 0; i < 8; i++) {
      fs.mkdirSync(path.join(manyDirsBase, `dir${i}`), { recursive: true });
    }
    const originalCwd = process.cwd();
    process.chdir(TEMP_DIR);
    try {
      const results = getDirCompletions("./many/");
      expect(results.length).toBe(5);
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe("CLI argument parsing", () => {
  const CLI_PATH = path.join(__dirname, "../dist/index.js");

  it("should show help with --help flag", () => {
    const output = execSync(`node ${CLI_PATH} --help`, {
      encoding: "utf8",
    });
    expect(output).toContain("emojico");
    expect(output).toContain("Usage");
    expect(output).toContain("--out");
    expect(output).toContain("--all");
  });

  it("should show help with -h flag", () => {
    const output = execSync(`node ${CLI_PATH} -h`, { encoding: "utf8" });
    expect(output).toContain("Usage");
  });

  it("should accept -o as shorthand for --out", () => {
    const outDir = path.join(__dirname, "../test-output/shorthand-test");
    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true });
    execSync(`node ${CLI_PATH} \u{1F34E} -o ${outDir}`);
    expect(fs.existsSync(path.join(outDir, "favicon.ico"))).toBe(true);
    fs.rmSync(outDir, { recursive: true });
  }, 30000);

  it("should exit with error when no emoji in non-TTY mode", () => {
    expect(() => {
      execSync(`echo | node ${CLI_PATH}`, { encoding: "utf8" });
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
        const pngBuffer = createTestPng(size, size, {
          r: 0,
          g: 0,
          b: 0,
          alpha: 0,
        });

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
