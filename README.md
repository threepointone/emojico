# emojico 🎨

A CLI tool that converts any emoji into a complete set of favicons and touch icons for your web projects.

## Features

- 🖼️ Generates favicon.ico with multiple sizes (16x16, 32x32, 48x48)
- 📱 Creates Apple Touch Icons in all standard sizes
- ✨ High-quality emoji rendering
- 🎯 Perfect for quick favicon generation
- 📦 Works with any emoji

## Installation

```bash
# Install globally
npm install -g emojico

# Or use with npx
npx emojico 🚀 --out ./icons
```

## Usage

```bash
emojico <emoji> --out <directory>
```

### Options

- `<emoji>`: The emoji to convert (required)
- `-o, --out <directory>`: Output directory for the generated assets (required)

### Example

```bash
# Generate icons for an apple emoji
emojico 🍎 --out ./my-icons

# Generate rocket favicon
emojico 🚀 --out ./rocket-icons

# Generate light bulb icons in a nested directory
emojico 💡 --out ./assets/icons
```

## Output Structure

The tool will create the following structure in your output directory:

```
output-directory/
├── favicon.ico             # Multi-size ICO file (16x16, 32x32, 48x48)
├── favicons/
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   └── favicon-48x48.png
└── apple-touch-icon/
    ├── apple-touch-icon-57x57.png
    ├── apple-touch-icon-60x60.png
    ├── apple-touch-icon-72x72.png
    ├── apple-touch-icon-76x76.png
    ├── apple-touch-icon-114x114.png
    ├── apple-touch-icon-120x120.png
    ├── apple-touch-icon-144x144.png
    ├── apple-touch-icon-152x152.png
    └── apple-touch-icon-180x180.png
```

## HTML Usage

Add the following to your HTML `<head>` section:

```html
<!-- Standard favicon -->
<link rel="icon" type="image/x-icon" href="/favicon.ico" />

<!-- PNG favicon alternatives -->
<link
  rel="icon"
  type="image/png"
  sizes="16x16"
  href="/favicons/favicon-16x16.png"
/>
<link
  rel="icon"
  type="image/png"
  sizes="32x32"
  href="/favicons/favicon-32x32.png"
/>
<link
  rel="icon"
  type="image/png"
  sizes="48x48"
  href="/favicons/favicon-48x48.png"
/>

<!-- Apple Touch Icons -->
<link
  rel="apple-touch-icon"
  sizes="57x57"
  href="/apple-touch-icon/apple-touch-icon-57x57.png"
/>
<link
  rel="apple-touch-icon"
  sizes="60x60"
  href="/apple-touch-icon/apple-touch-icon-60x60.png"
/>
<link
  rel="apple-touch-icon"
  sizes="72x72"
  href="/apple-touch-icon/apple-touch-icon-72x72.png"
/>
<link
  rel="apple-touch-icon"
  sizes="76x76"
  href="/apple-touch-icon/apple-touch-icon-76x76.png"
/>
<link
  rel="apple-touch-icon"
  sizes="114x114"
  href="/apple-touch-icon/apple-touch-icon-114x114.png"
/>
<link
  rel="apple-touch-icon"
  sizes="120x120"
  href="/apple-touch-icon/apple-touch-icon-120x120.png"
/>
<link
  rel="apple-touch-icon"
  sizes="144x144"
  href="/apple-touch-icon/apple-touch-icon-144x144.png"
/>
<link
  rel="apple-touch-icon"
  sizes="152x152"
  href="/apple-touch-icon/apple-touch-icon-152x152.png"
/>
<link
  rel="apple-touch-icon"
  sizes="180x180"
  href="/apple-touch-icon/apple-touch-icon-180x180.png"
/>
```

## Development

```bash
# Clone the repository
git clone https://github.com/threepointone/emojico.git
cd emojico

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## Requirements

- Node.js >= 14
- Operating system with emoji support

## License

ISC

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
