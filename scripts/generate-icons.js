'use strict'
// Generates all PWA icons for "Día a Día" using Playwright + Chromium.
// Font: Lilita One (Google Fonts CDN) — bold, rounded, bubble-style.
// Run: node scripts/generate-icons.js

const { chromium } = require('playwright')
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')

const ROOT    = path.join(__dirname, '..')
const PUBLIC  = path.join(ROOT, 'public')
const APP_DIR = path.join(ROOT, 'src', 'app')

// ── HTML template for each icon size ───────────────────────────────────────
function makeHtml(size) {
  const fontDia = Math.round(size * 0.335)
  const fontA   = Math.round(size * 0.200)
  const pad     = Math.round(size * 0.065)

  return /* html */ `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Lilita+One&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${size}px; height: ${size}px; overflow: hidden; }
.icon {
  width: ${size}px;
  height: ${size}px;
  background: #000000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${pad}px;
}
.line {
  font-family: 'Lilita One', 'Arial Black', Impact, sans-serif;
  color: #FFFFFF;
  font-size: ${fontDia}px;
  line-height: 0.87;
  text-align: center;
  white-space: nowrap;
  letter-spacing: -0.01em;
  display: block;
}
.small {
  font-size: ${fontA}px;
  line-height: 0.87;
}
</style>
</head>
<body>
<div class="icon">
  <div class="line">Día</div>
  <div class="line small">a</div>
  <div class="line">Día</div>
</div>
</body>
</html>`
}

// ── Wrap a PNG buffer inside a minimal ICO container ───────────────────────
// Modern browsers (Chrome, Firefox, Edge, Safari) fully support PNG-in-ICO.
function wrapInIco(pngBuffer, size) {
  const DATA_OFFSET = 22 // 6-byte header + 16-byte dir entry
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)  // reserved
  header.writeUInt16LE(1, 2)  // type: 1 = ICO
  header.writeUInt16LE(1, 4)  // number of images

  const dir = Buffer.alloc(16)
  dir.writeUInt8(size >= 256 ? 0 : size, 0) // width  (0 = 256)
  dir.writeUInt8(size >= 256 ? 0 : size, 1) // height (0 = 256)
  dir.writeUInt8(0, 2)                      // colour count (0 = true-colour)
  dir.writeUInt8(0, 3)                      // reserved
  dir.writeUInt16LE(1, 4)                   // colour planes
  dir.writeUInt16LE(32, 6)                  // bits per pixel
  dir.writeUInt32LE(pngBuffer.length, 8)   // image data size
  dir.writeUInt32LE(DATA_OFFSET, 12)        // offset to image data

  return Buffer.concat([header, dir, pngBuffer])
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n⚡ Día a Día — Icon Generator')
  console.log('──────────────────────────────')
  console.log('Launching Chromium…\n')

  const browser = await chromium.launch()

  const tasks = [
    { size: 512, dest: path.join(PUBLIC, 'icon-512x512.png') },
    { size: 192, dest: path.join(PUBLIC, 'icon-192x192.png') },
    { size: 180, dest: path.join(PUBLIC, 'apple-touch-icon.png') },
    { size: 32,  dest: null, isFavicon: true },
  ]

  let faviconPng = null

  for (const { size, dest, isFavicon } of tasks) {
    const page = await browser.newPage()
    await page.setViewportSize({ width: size, height: size })

    // Try network-idle (waits for Google Fonts), fall back to 'load' + delay
    try {
      await page.setContent(makeHtml(size), { waitUntil: 'networkidle', timeout: 12000 })
    } catch {
      await page.setContent(makeHtml(size), { waitUntil: 'load' })
      await page.waitForTimeout(1000)
    }

    // Ensure all fonts have finished loading
    await page.evaluate(() => document.fonts.ready)

    const png = await page.screenshot({
      clip: { x: 0, y: 0, width: size, height: size },
      omitBackground: false,
    })

    await page.close()

    if (isFavicon) {
      faviconPng = png
    } else {
      fs.writeFileSync(dest, png)
      console.log(`✓  ${path.relative(ROOT, dest).replace(/\\/g, '/')}  (${size}×${size})`)
    }
  }

  await browser.close()

  // Next.js requires RGBA PNG inside the ICO container — convert with sharp
  const rgbaPng = await sharp(faviconPng).ensureAlpha().png().toBuffer()
  const icoPath = path.join(APP_DIR, 'favicon.ico')
  fs.writeFileSync(icoPath, wrapInIco(rgbaPng, 32))
  console.log(`✓  src/app/favicon.ico  (32×32, RGBA)`)

  console.log('\n✅ All icons generated successfully!\n')
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message)
  process.exit(1)
})
