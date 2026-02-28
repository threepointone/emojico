# emojico

Emoji to favicon. One command.

```bash
npx emojico 🍎
```

This generates a `favicon.ico` (with 16x16, 32x32, and 48x48 sizes) in the current directory.

## Interactive mode

Run without an argument to get a guided experience:

```bash
npx emojico
```

**Step 1** — search and pick an emoji:

```
  🔍 Search: cat

  ❯ 🐱  cat face
    🐈  cat
    🐈‍⬛  black cat
    😸  grinning cat with smiling eyes
    …

  ↑/↓ navigate · enter select · esc quit
```

**Step 2** — choose an output folder (tab to autocomplete):

```
  📁 Output folder: .

  ❯ ./src
    ./dist
    ./public

  tab complete · ↑/↓ navigate · enter confirm · esc quit
```

**Step 3** — pick what to generate:

```
  📦 Generate all assets?

  ❯ favicon.ico only
    All assets (favicons, Apple touch icons, og:image)

  ↑/↓ toggle · enter confirm · esc quit
```

## Options

```bash
emojico [emoji] [--out <directory>] [--all]
```

- **`--out, -o <directory>`** — output directory (default: `.`)
- **`--all`** — generate the full asset set (see below)
- **`--help, -h`** — show help

## Full asset generation

Pass `--all` to generate everything you need:

```bash
npx emojico 🚀 --out ./icons --all
```

```
icons/
├── favicon.ico
├── og-image.png                          # 1200x630
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

Drop this into your `<head>`:

```html
<link rel="icon" type="image/x-icon" href="/favicon.ico" />

<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png" />
<link rel="icon" type="image/png" sizes="48x48" href="/favicons/favicon-48x48.png" />

<link rel="apple-touch-icon" sizes="57x57" href="/apple-touch-icon/apple-touch-icon-57x57.png" />
<link rel="apple-touch-icon" sizes="60x60" href="/apple-touch-icon/apple-touch-icon-60x60.png" />
<link rel="apple-touch-icon" sizes="72x72" href="/apple-touch-icon/apple-touch-icon-72x72.png" />
<link rel="apple-touch-icon" sizes="76x76" href="/apple-touch-icon/apple-touch-icon-76x76.png" />
<link rel="apple-touch-icon" sizes="114x114" href="/apple-touch-icon/apple-touch-icon-114x114.png" />
<link rel="apple-touch-icon" sizes="120x120" href="/apple-touch-icon/apple-touch-icon-120x120.png" />
<link rel="apple-touch-icon" sizes="144x144" href="/apple-touch-icon/apple-touch-icon-144x144.png" />
<link rel="apple-touch-icon" sizes="152x152" href="/apple-touch-icon/apple-touch-icon-152x152.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon/apple-touch-icon-180x180.png" />

<meta property="og:image" content="/og-image.png" />
```

## Development

```bash
git clone https://github.com/threepointone/emojico.git
cd emojico
npm install
npm run build    # bundles with esbuild
npm test
```

## License

ISC
