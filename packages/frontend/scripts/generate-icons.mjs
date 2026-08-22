import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');
const iconsDir = path.resolve(publicDir, 'icons');

fs.mkdirSync(iconsDir, { recursive: true });

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function createPng(width, height, pixelFn) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const idatData = zlib.deflateSync(rawData);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idatData),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function createIco(pngBuffer, size = 32) {
  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // icon type 1
  header.writeUInt16LE(1, 4); // 1 image

  // Directory entry: 16 bytes
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size >= 256 ? 0 : size, 0); // width
  entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // color palette count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8); // image size in bytes
  entry.writeUInt32LE(22, 12); // offset (6 + 16 = 22)

  return Buffer.concat([header, entry, pngBuffer]);
}

// BasBuddy Brand Palette
const HARBOUR_NAVY = [16, 27, 45, 255];   // #101B2D
const MANGO_PEEL   = [244, 161, 0, 255];  // #F4A100
const WARM_IVORY   = [255, 248, 238, 255];// #FFF8EE
const SIGNAL_PINK  = [233, 75, 140, 255]; // #E94B8C
const EMBER_CORAL  = [255, 90, 71, 255];  // #FF5A47

function renderBusGlyph(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Background: Solid Harbour Navy
  let color = HARBOUR_NAVY;

  // Signal Pink Live Pulse Dot (top right)
  const dotDx = nx - 0.72;
  const dotDy = ny - 0.24;
  if (dotDx * dotDx + dotDy * dotDy < 0.045 * 0.045) {
    return SIGNAL_PINK;
  }

  // Bus outer chassis (Mango Peel)
  // Normalized bounds: x in [0.26, 0.74], y in [0.28, 0.72] (comfortably inside 80% safe zone [0.10, 0.90])
  const busLeft = 0.26;
  const busRight = 0.74;
  const busTop = 0.28;
  const busBottom = 0.72;
  const cornerRadius = 0.08;

  const inBusX = nx >= busLeft && nx <= busRight;
  const inBusY = ny >= busTop && ny <= busBottom;

  if (inBusX && inBusY) {
    // Check rounded corners
    let inside = true;
    // Top-left
    if (nx < busLeft + cornerRadius && ny < busTop + cornerRadius) {
      const dx = nx - (busLeft + cornerRadius);
      const dy = ny - (busTop + cornerRadius);
      if (dx * dx + dy * dy > cornerRadius * cornerRadius) inside = false;
    }
    // Top-right
    if (nx > busRight - cornerRadius && ny < busTop + cornerRadius) {
      const dx = nx - (busRight - cornerRadius);
      const dy = ny - (busTop + cornerRadius);
      if (dx * dx + dy * dy > cornerRadius * cornerRadius) inside = false;
    }
    // Bottom-left
    if (nx < busLeft + cornerRadius && ny > busBottom - cornerRadius) {
      const dx = nx - (busLeft + cornerRadius);
      const dy = ny - (busBottom - cornerRadius);
      if (dx * dx + dy * dy > cornerRadius * cornerRadius) inside = false;
    }
    // Bottom-right
    if (nx > busRight - cornerRadius && ny > busBottom - cornerRadius) {
      const dx = nx - (busRight - cornerRadius);
      const dy = ny - (busBottom - cornerRadius);
      if (dx * dx + dy * dy > cornerRadius * cornerRadius) inside = false;
    }

    if (inside) {
      color = MANGO_PEEL;

      // Windshield (Navy cut-out inside Mango chassis)
      const winLeft = 0.32;
      const winRight = 0.68;
      const winTop = 0.35;
      const winBottom = 0.48;
      const winCorner = 0.03;

      if (nx >= winLeft && nx <= winRight && ny >= winTop && ny <= winBottom) {
        let inWin = true;
        if (nx < winLeft + winCorner && ny < winTop + winCorner) {
          const dx = nx - (winLeft + winCorner);
          const dy = ny - (winTop + winCorner);
          if (dx * dx + dy * dy > winCorner * winCorner) inWin = false;
        }
        if (nx > winRight - winCorner && ny < winTop + winCorner) {
          const dx = nx - (winRight - winCorner);
          const dy = ny - (winTop + winCorner);
          if (dx * dx + dy * dy > winCorner * winCorner) inWin = false;
        }
        if (inWin) {
          color = HARBOUR_NAVY;
        }
      }

      // Headlights (Warm Ivory circles)
      const hlLeftDx = nx - 0.36;
      const hlRightDx = nx - 0.64;
      const hlDy = ny - 0.58;
      if (hlLeftDx * hlLeftDx + hlDy * hlDy < 0.035 * 0.035) {
        color = WARM_IVORY;
      }
      if (hlRightDx * hlRightDx + hlDy * hlDy < 0.035 * 0.035) {
        color = WARM_IVORY;
      }

      // Grille bar (Warm Ivory line)
      if (nx >= 0.44 && nx <= 0.56 && ny >= 0.57 && ny <= 0.59) {
        color = WARM_IVORY;
      }
    }
  }

  // Wheels (Navy circles at bottom chassis)
  const wheelLeftDx = nx - 0.36;
  const wheelRightDx = nx - 0.64;
  const wheelDy = ny - 0.73;
  if (wheelLeftDx * wheelLeftDx + wheelDy * wheelDy < 0.05 * 0.05) {
    color = HARBOUR_NAVY;
  }
  if (wheelRightDx * wheelRightDx + wheelDy * wheelDy < 0.05 * 0.05) {
    color = HARBOUR_NAVY;
  }

  return color;
}

// 1. Generate icon-512.png
const png512 = createPng(512, 512, renderBusGlyph);
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), png512);
console.log('✓ Generated public/icons/icon-512.png (512x512)');

// 2. Generate icon-192.png
const png192 = createPng(192, 192, renderBusGlyph);
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), png192);
console.log('✓ Generated public/icons/icon-192.png (192x192)');

// 3. Generate apple-touch-icon.png (180x180)
const png180 = createPng(180, 180, renderBusGlyph);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png180);
console.log('✓ Generated public/apple-touch-icon.png (180x180)');

// 4. Generate favicon.ico (32x32)
const png32 = createPng(32, 32, renderBusGlyph);
const ico = createIco(png32, 32);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), ico);
console.log('✓ Generated public/favicon.ico (32x32 ICO)');
