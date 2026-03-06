#!/usr/bin/env node
/**
 * Asset Generation Script for WorkTracker
 *
 * Generates branded PNG assets for the app using Node.js built-in modules.
 * This creates simple but functional icons that can be replaced with
 * professionally designed assets later.
 *
 * Design:
 * - App icon: Clock/timer symbol with primary color (#6366F1) on dark background
 * - Adaptive icon: Same design, foreground only for Android adaptive icons
 * - Splash: App icon centered on dark background (#0F0F0F)
 * - Favicon: Small version for web
 *
 * Usage: node scripts/generate-assets.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Theme colors
const COLORS = {
  background: { r: 15, g: 15, b: 15, a: 255 },      // #0F0F0F
  primary: { r: 99, g: 102, b: 241, a: 255 },       // #6366F1
  secondary: { r: 34, g: 211, b: 238, a: 255 },     // #22D3EE
  white: { r: 255, g: 255, b: 255, a: 255 },
  transparent: { r: 0, g: 0, b: 0, a: 0 },
};

/**
 * Creates a PNG file from raw RGBA pixel data
 */
function createPNG(width, height, pixels) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);  // Bit depth
  ihdr.writeUInt8(6, 9);  // Color type (RGBA)
  ihdr.writeUInt8(0, 10); // Compression method
  ihdr.writeUInt8(0, 11); // Filter method
  ihdr.writeUInt8(0, 12); // Interlace method

  const ihdrChunk = createChunk('IHDR', ihdr);

  // IDAT chunk (image data)
  // Add filter byte (0 = None) at the start of each row
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // Filter byte
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 4) + 1 + x * 4;
      rawData[dstIdx] = pixels[srcIdx];     // R
      rawData[dstIdx + 1] = pixels[srcIdx + 1]; // G
      rawData[dstIdx + 2] = pixels[srcIdx + 2]; // B
      rawData[dstIdx + 3] = pixels[srcIdx + 3]; // A
    }
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Creates a PNG chunk with CRC
 */
function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

/**
 * CRC32 calculation for PNG chunks
 */
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = getCRC32Table();

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }

  return crc ^ 0xFFFFFFFF;
}

let crc32Table = null;
function getCRC32Table() {
  if (crc32Table) return crc32Table;

  crc32Table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crc32Table[i] = c;
  }
  return crc32Table;
}

/**
 * Creates a pixel buffer filled with a solid color
 */
function createSolidPixels(width, height, color) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4] = color.r;
    pixels[i * 4 + 1] = color.g;
    pixels[i * 4 + 2] = color.b;
    pixels[i * 4 + 3] = color.a;
  }
  return pixels;
}

/**
 * Draws a filled circle on the pixel buffer
 */
function drawCircle(pixels, width, cx, cy, radius, color, filled = true) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 0 || x >= width || y < 0 || y >= width) continue;

      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (filled && dist <= radius) {
        setPixel(pixels, width, x, y, color);
      } else if (!filled && Math.abs(dist - radius) < 2) {
        // Anti-aliased ring
        const alpha = Math.max(0, 1 - Math.abs(dist - radius) / 2);
        const blendedColor = {
          r: color.r,
          g: color.g,
          b: color.b,
          a: Math.round(color.a * alpha)
        };
        setPixelBlend(pixels, width, x, y, blendedColor);
      }
    }
  }
}

/**
 * Draws a ring (unfilled circle) on the pixel buffer
 */
function drawRing(pixels, width, cx, cy, outerRadius, thickness, color) {
  const innerRadius = outerRadius - thickness;
  for (let y = cy - outerRadius - 2; y <= cy + outerRadius + 2; y++) {
    for (let x = cx - outerRadius - 2; x <= cx + outerRadius + 2; x++) {
      if (x < 0 || x >= width || y < 0 || y >= width) continue;

      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (dist >= innerRadius && dist <= outerRadius) {
        // Simple anti-aliasing at edges
        let alpha = 1;
        if (dist < innerRadius + 1) {
          alpha = dist - innerRadius;
        } else if (dist > outerRadius - 1) {
          alpha = outerRadius - dist;
        }
        alpha = Math.max(0, Math.min(1, alpha));

        const blendedColor = {
          r: color.r,
          g: color.g,
          b: color.b,
          a: Math.round(color.a * alpha)
        };
        setPixelBlend(pixels, width, x, y, blendedColor);
      }
    }
  }
}

/**
 * Draws clock hands (hour and minute indicators)
 */
function drawClockHands(pixels, width, cx, cy, radius, color) {
  // Draw hour markers (small dots at 12, 3, 6, 9 positions)
  const markerRadius = Math.round(radius * 0.06);
  const markerDistance = radius * 0.75;

  // 12 o'clock
  drawCircle(pixels, width, cx, cy - markerDistance, markerRadius, color, true);
  // 3 o'clock
  drawCircle(pixels, width, cx + markerDistance, cy, markerRadius, color, true);
  // 6 o'clock
  drawCircle(pixels, width, cx, cy + markerDistance, markerRadius, color, true);
  // 9 o'clock
  drawCircle(pixels, width, cx - markerDistance, cy, markerRadius, color, true);

  // Draw play button triangle (indicating timer/work tracking)
  const triangleSize = radius * 0.35;
  const triangleCx = cx + triangleSize * 0.1; // Slight offset to center visually
  drawPlayTriangle(pixels, width, triangleCx, cy, triangleSize, color);
}

/**
 * Draws a play button triangle
 */
function drawPlayTriangle(pixels, width, cx, cy, size, color) {
  // Triangle points: left-center, top-right, bottom-right
  const leftX = cx - size * 0.4;
  const rightX = cx + size * 0.5;
  const topY = cy - size * 0.5;
  const bottomY = cy + size * 0.5;

  for (let y = Math.floor(topY); y <= Math.ceil(bottomY); y++) {
    for (let x = Math.floor(leftX); x <= Math.ceil(rightX); x++) {
      if (x < 0 || x >= width || y < 0 || y >= width) continue;

      // Check if point is inside triangle using barycentric coordinates
      const v0x = rightX - leftX;
      const v0y = cy - topY;
      const v1x = leftX - leftX;
      const v1y = bottomY - topY;
      const v2x = x - leftX;
      const v2y = y - topY;

      // Simplified point-in-triangle test
      const relY = (y - topY) / (bottomY - topY);
      const expectedX = leftX + (rightX - leftX) * (1 - Math.abs(relY * 2 - 1));

      if (x >= leftX && x <= expectedX && y >= topY && y <= bottomY) {
        setPixelBlend(pixels, width, x, y, color);
      }
    }
  }
}

/**
 * Sets a pixel at (x, y) with the given color
 */
function setPixel(pixels, width, x, y, color) {
  const idx = (Math.round(y) * width + Math.round(x)) * 4;
  pixels[idx] = color.r;
  pixels[idx + 1] = color.g;
  pixels[idx + 2] = color.b;
  pixels[idx + 3] = color.a;
}

/**
 * Blends a pixel at (x, y) with the given color using alpha compositing
 */
function setPixelBlend(pixels, width, x, y, color) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || x >= width || y < 0 || y >= width) return;

  const idx = (y * width + x) * 4;
  const srcAlpha = color.a / 255;
  const dstAlpha = pixels[idx + 3] / 255;
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

  if (outAlpha > 0) {
    pixels[idx] = Math.round((color.r * srcAlpha + pixels[idx] * dstAlpha * (1 - srcAlpha)) / outAlpha);
    pixels[idx + 1] = Math.round((color.g * srcAlpha + pixels[idx + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha);
    pixels[idx + 2] = Math.round((color.b * srcAlpha + pixels[idx + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha);
    pixels[idx + 3] = Math.round(outAlpha * 255);
  }
}

/**
 * Generates the main app icon
 */
function generateAppIcon(size) {
  const pixels = createSolidPixels(size, size, COLORS.background);
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size * 0.42;
  const ringThickness = size * 0.06;

  // Draw outer ring (clock face)
  drawRing(pixels, size, cx, cy, outerRadius, ringThickness, COLORS.primary);

  // Draw inner circle background
  const innerRadius = outerRadius - ringThickness - size * 0.02;
  drawCircle(pixels, size, cx, cy, innerRadius, COLORS.background, true);

  // Draw clock markers and play button
  drawClockHands(pixels, size, cx, cy, innerRadius, COLORS.primary);

  return createPNG(size, size, pixels);
}

/**
 * Generates the Android adaptive icon foreground
 */
function generateAdaptiveIconForeground(size) {
  // Adaptive icons need safe zone - actual content should be in center 66%
  const pixels = createSolidPixels(size, size, COLORS.transparent);
  const cx = size / 2;
  const cy = size / 2;
  const safeZone = size * 0.33; // Content in center 66%
  const outerRadius = safeZone * 0.85;
  const ringThickness = safeZone * 0.12;

  // Draw outer ring (clock face)
  drawRing(pixels, size, cx, cy, outerRadius, ringThickness, COLORS.primary);

  // Draw clock markers and play button
  const innerRadius = outerRadius - ringThickness - safeZone * 0.04;
  drawClockHands(pixels, size, cx, cy, innerRadius, COLORS.primary);

  return createPNG(size, size, pixels);
}

/**
 * Generates the Android adaptive icon background
 */
function generateAdaptiveIconBackground(size) {
  const pixels = createSolidPixels(size, size, COLORS.background);
  return createPNG(size, size, pixels);
}

/**
 * Generates the Android adaptive icon monochrome version
 */
function generateAdaptiveIconMonochrome(size) {
  // Monochrome uses white on transparent
  const pixels = createSolidPixels(size, size, COLORS.transparent);
  const cx = size / 2;
  const cy = size / 2;
  const safeZone = size * 0.33;
  const outerRadius = safeZone * 0.85;
  const ringThickness = safeZone * 0.12;

  // Draw outer ring in white
  drawRing(pixels, size, cx, cy, outerRadius, ringThickness, COLORS.white);

  // Draw clock markers and play button in white
  const innerRadius = outerRadius - ringThickness - safeZone * 0.04;
  drawClockHands(pixels, size, cx, cy, innerRadius, COLORS.white);

  return createPNG(size, size, pixels);
}

/**
 * Generates the splash screen image
 */
function generateSplash(width, height) {
  const pixels = createSolidPixels(width, height, COLORS.background);

  // Draw centered icon (smaller than full splash)
  const iconSize = Math.min(width, height) * 0.3;
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = iconSize * 0.42;
  const ringThickness = iconSize * 0.06;

  // Draw outer ring (clock face)
  drawRing(pixels, width, cx, cy, outerRadius, ringThickness, COLORS.primary);

  // Draw clock markers and play button
  const innerRadius = outerRadius - ringThickness - iconSize * 0.02;
  drawClockHands(pixels, width, cx, cy, innerRadius, COLORS.primary);

  return createPNG(width, height, pixels);
}

/**
 * Generates the favicon
 */
function generateFavicon(size) {
  const pixels = createSolidPixels(size, size, COLORS.background);
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size * 0.42;
  const ringThickness = Math.max(2, size * 0.08);

  // Draw outer ring (clock face) - simplified for small size
  drawRing(pixels, size, cx, cy, outerRadius, ringThickness, COLORS.primary);

  // For small favicon, just draw a simple play indicator
  const innerRadius = outerRadius - ringThickness - 1;
  if (size >= 32) {
    drawClockHands(pixels, size, cx, cy, innerRadius, COLORS.primary);
  }

  return createPNG(size, size, pixels);
}

// Main execution
const assetsDir = path.join(__dirname, '..', 'assets');

console.log('Generating WorkTracker assets...\n');

// Generate main app icon (1024x1024)
console.log('Creating icon.png (1024x1024)...');
const iconData = generateAppIcon(1024);
fs.writeFileSync(path.join(assetsDir, 'icon.png'), iconData);
console.log('  Done!\n');

// Generate splash icon (used in splash screen config)
console.log('Creating splash-icon.png (1024x1024)...');
const splashIconData = generateAppIcon(1024);
fs.writeFileSync(path.join(assetsDir, 'splash-icon.png'), splashIconData);
console.log('  Done!\n');

// Generate Android adaptive icon foreground (1024x1024)
console.log('Creating android-icon-foreground.png (1024x1024)...');
const foregroundData = generateAdaptiveIconForeground(1024);
fs.writeFileSync(path.join(assetsDir, 'android-icon-foreground.png'), foregroundData);
console.log('  Done!\n');

// Generate Android adaptive icon background (1024x1024)
console.log('Creating android-icon-background.png (1024x1024)...');
const backgroundData = generateAdaptiveIconBackground(1024);
fs.writeFileSync(path.join(assetsDir, 'android-icon-background.png'), backgroundData);
console.log('  Done!\n');

// Generate Android adaptive icon monochrome (1024x1024)
console.log('Creating android-icon-monochrome.png (1024x1024)...');
const monochromeData = generateAdaptiveIconMonochrome(1024);
fs.writeFileSync(path.join(assetsDir, 'android-icon-monochrome.png'), monochromeData);
console.log('  Done!\n');

// Generate splash screen (1284x2778 - iPhone 14 Pro Max size)
console.log('Creating splash.png (1284x2778)...');
const splashData = generateSplash(1284, 2778);
fs.writeFileSync(path.join(assetsDir, 'splash.png'), splashData);
console.log('  Done!\n');

// Generate favicon (48x48 for web)
console.log('Creating favicon.png (48x48)...');
const faviconData = generateFavicon(48);
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), faviconData);
console.log('  Done!\n');

console.log('All assets generated successfully!');
console.log('\nAsset files created:');
console.log('  - assets/icon.png (1024x1024) - Main app icon');
console.log('  - assets/splash-icon.png (1024x1024) - Splash screen icon');
console.log('  - assets/android-icon-foreground.png (1024x1024) - Android adaptive foreground');
console.log('  - assets/android-icon-background.png (1024x1024) - Android adaptive background');
console.log('  - assets/android-icon-monochrome.png (1024x1024) - Android monochrome icon');
console.log('  - assets/splash.png (1284x2778) - Full splash screen');
console.log('  - assets/favicon.png (48x48) - Web favicon');
