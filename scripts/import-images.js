// Resizes/compresses the restaurant's real photography from The-Royal-Chilli
// into public/ so the new site uses authentic photos without the ~240MB of
// unoptimized originals bloating this repo.
// Usage: node scripts/import-images.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_ROOT = 'C:/Users/adapa/The-Royal-Chilli';
const DEST_ROOT = path.join(__dirname, '..', 'public');

const jobs = [
  { srcDir: 'gallery', destDir: 'gallery', maxWidth: 1600, quality: 78 },
  { srcDir: 'pptx_images', destDir: 'promotions', maxWidth: 1400, quality: 78 },
];

async function processDir({ srcDir, destDir, maxWidth, quality }) {
  const srcPath = path.join(SOURCE_ROOT, srcDir);
  const destPath = path.join(DEST_ROOT, destDir);
  fs.mkdirSync(destPath, { recursive: true });

  const files = fs.readdirSync(srcPath).filter(f => /\.(jpe?g|png)$/i.test(f));
  let totalIn = 0, totalOut = 0;

  for (const file of files) {
    const inFile = path.join(srcPath, file);
    const outName = file.replace(/\.(jpe?g|png)$/i, '.webp');
    const outFile = path.join(destPath, outName);
    const inSize = fs.statSync(inFile).size;

    await sharp(inFile)
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality })
      .toFile(outFile);

    const outSize = fs.statSync(outFile).size;
    totalIn += inSize;
    totalOut += outSize;
    console.log(`${srcDir}/${file} -> ${destDir}/${outName}  (${(inSize/1024/1024).toFixed(1)}MB -> ${(outSize/1024).toFixed(0)}KB)`);
  }

  console.log(`\n${srcDir}: ${files.length} files, ${(totalIn/1024/1024).toFixed(1)}MB -> ${(totalOut/1024/1024).toFixed(1)}MB\n`);
}

(async () => {
  for (const job of jobs) {
    await processDir(job);
  }
})().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
