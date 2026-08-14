const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const IMAGES_ROOT = path.join(__dirname, 'Images');
const MAX_WIDTH = 1200;
const JPEG_QUALITY = 78;
const PNG_QUALITY = 80;

let totalSaved = 0;
let count = 0;

function formatKB(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

function getAllImageFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllImageFiles(full));
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

async function compressImage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const originalSize = fs.statSync(filePath).size;
  const tmp = filePath + '.tmp';

  try {
    const pipeline = sharp(filePath).resize({ width: MAX_WIDTH, withoutEnlargement: true });

    if (ext === '.jpg' || ext === '.jpeg') {
      await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toFile(tmp);
    } else if (ext === '.png') {
      await pipeline.png({ quality: PNG_QUALITY, compressionLevel: 9 }).toFile(tmp);
    } else if (ext === '.webp') {
      await pipeline.webp({ quality: JPEG_QUALITY }).toFile(tmp);
    } else {
      return;
    }

    const newSize = fs.statSync(tmp).size;
    if (newSize < originalSize) {
      fs.renameSync(tmp, filePath);
      totalSaved += originalSize - newSize;
      count++;
      const rel = path.relative(__dirname, filePath);
      console.log(`  OK  ${rel.padEnd(45)} ${formatKB(originalSize)} → ${formatKB(newSize)}`);
    } else {
      fs.unlinkSync(tmp);
    }
  } catch (err) {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    console.error(` ERR  ${filePath}: ${err.message}`);
  }
}

(async () => {
  if (!fs.existsSync(IMAGES_ROOT)) {
    console.log('No Images/ folder found, skipping compression.');
    return;
  }
  const files = getAllImageFiles(IMAGES_ROOT);
  console.log(`Compressing ${files.length} images in Images/...\n`);
  for (const f of files) await compressImage(f);
  console.log(`\nDone. ${count} images reduced. Saved: ${formatKB(totalSaved)}`);
})();
