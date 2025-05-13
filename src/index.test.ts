import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import sharp from "sharp";

const TEST_OUTPUT_DIR = path.join(__dirname, "../test-output");
const CLI_PATH = path.join(__dirname, "../dist/index.js");

// Helper function to create a safe directory name from an emoji
function getSafeDirName(emoji: string): string {
  return `emoji-${Buffer.from(emoji).toString("hex")}`;
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

  it("should fail when no output directory is specified", () => {
    expect(() => {
      execSync(`node ${CLI_PATH} 🍎`);
    }).toThrow();
  });
});
