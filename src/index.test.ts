import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import sharp from "sharp";

const TEST_OUTPUT_DIR = path.join(__dirname, "../test-output");
const CLI_PATH = path.join(__dirname, "../dist/index.js");

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
  });

  afterAll(() => {
    // Clean up after all tests
    if (fs.existsSync(TEST_OUTPUT_DIR)) {
      fs.rmSync(TEST_OUTPUT_DIR, { recursive: true });
    }
  });

  it("should generate all required files with correct sizes", async () => {
    // Run the CLI
    execSync(`node ${CLI_PATH} 🍎 --out ${TEST_OUTPUT_DIR}`);

    // Check if main directories exist
    expect(fs.existsSync(TEST_OUTPUT_DIR)).toBe(true);
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, "favicons"))).toBe(true);
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, "apple-touch-icon"))).toBe(
      true
    );

    // Check if favicon.ico exists
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, "favicon.ico"))).toBe(true);

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
      const metadata = await sharp(filePath).metadata();
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
      const metadata = await sharp(filePath).metadata();
      expect(metadata.width).toBe(size);
      expect(metadata.height).toBe(size);
    }
  }, 30000); // Increase timeout to 30 seconds

  it("should fail when no output directory is specified", () => {
    expect(() => {
      execSync(`node ${CLI_PATH} 🍎`);
    }).toThrow();
  });

  it("should create output directory if it doesn't exist", () => {
    const deepOutputDir = path.join(TEST_OUTPUT_DIR, "deep/nested/dir");
    execSync(`node ${CLI_PATH} 🍎 --out ${deepOutputDir}`);

    expect(fs.existsSync(deepOutputDir)).toBe(true);
    expect(fs.existsSync(path.join(deepOutputDir, "favicon.ico"))).toBe(true);
  }, 30000); // Increase timeout to 30 seconds

  it("should handle different emoji inputs", () => {
    const emojis = ["😀", "🚀", "🌈", "💡"];

    for (const emoji of emojis) {
      const emojiOutputDir = path.join(TEST_OUTPUT_DIR, emoji);
      execSync(`node ${CLI_PATH} ${emoji} --out ${emojiOutputDir}`);

      expect(fs.existsSync(path.join(emojiOutputDir, "favicon.ico"))).toBe(
        true
      );
      expect(fs.existsSync(path.join(emojiOutputDir, "favicons"))).toBe(true);
      expect(fs.existsSync(path.join(emojiOutputDir, "apple-touch-icon"))).toBe(
        true
      );
    }
  }, 120000); // Increase timeout to 120 seconds for multiple emojis
});
