/**
 * CP1252-aware mojibake reverse fix.
 *
 * Mojibake oluşma süreci:
 *   1. Orijinal UTF-8 dosyadaki her byte, Windows-1252 (CP1252) ile ayrı bir karakter olarak okundu
 *   2. O karakterler tekrar UTF-8 olarak kaydedildi → mojibake
 *
 * Geri alma:
 *   1. Dosyayı UTF-8 string olarak oku (mojibake karakterler görünür)
 *   2. Her karakteri CP1252 byte değeriyle eşleştir
 *   3. Bu byte'ları UTF-8 olarak decode et → orijinal metin
 */
const fs = require('fs');
const path = require('path');

// CP1252 → Unicode mapping for bytes 0x80-0x9F (differs from ISO-8859-1)
const CP1252_HIGH = {
  0x80: 0x20AC, // €
  0x82: 0x201A, // ‚
  0x83: 0x0192, // ƒ
  0x84: 0x201E, // „
  0x85: 0x2026, // …
  0x86: 0x2020, // †
  0x87: 0x2021, // ‡
  0x88: 0x02C6, // ˆ
  0x89: 0x2030, // ‰
  0x8A: 0x0160, // Š
  0x8B: 0x2039, // ‹
  0x8C: 0x0152, // Œ
  0x8E: 0x017D, // Ž
  0x91: 0x2018, // '
  0x92: 0x2019, // '
  0x93: 0x201C, // "
  0x94: 0x201D, // "
  0x95: 0x2022, // •
  0x96: 0x2013, // –
  0x97: 0x2014, // —
  0x98: 0x02DC, // ˜
  0x99: 0x2122, // ™
  0x9A: 0x0161, // š
  0x9B: 0x203A, // ›
  0x9C: 0x0153, // œ
  0x9E: 0x017E, // ž
  0x9F: 0x0178, // Ÿ
};

// Reverse: Unicode codepoint → CP1252 byte (for chars in the special range)
const UNICODE_TO_CP1252 = {};
for (const [byteVal, codepoint] of Object.entries(CP1252_HIGH)) {
  UNICODE_TO_CP1252[codepoint] = parseInt(byteVal);
}

/**
 * Encode a string back to CP1252 bytes.
 * For chars in U+0000-U+00FF: use codepoint directly as byte.
 * For CP1252 special chars: use the CP1252 byte mapping.
 * For chars outside CP1252 range (e.g. emojis > U+00FF not in CP1252): skip/keep as-is.
 */
function encodeAsCP1252(str) {
  const result = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code <= 0xFF) {
      result.push(code);
    } else if (UNICODE_TO_CP1252[code] !== undefined) {
      result.push(UNICODE_TO_CP1252[code]);
    } else {
      // Surrogate pair or out-of-CP1252: skip for now (emoji case handled differently)
      // Just push low byte as fallback
      result.push(code & 0xFF);
    }
  }
  return Buffer.from(result);
}

// Mojibake detection pattern: valid UTF-8 multi-byte sequences
const MOJIBAKE_RE = /[\xC0-\xC5\xC6-\xCF\xD0-\xDF\xE0-\xEF\xF0-\xF4][\x80-\xBF]/;

function walk(dir) {
  const results = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) results.push(...walk(full));
    else if (/\.(tsx?|ts)$/.test(f)) results.push(full);
  }
  return results;
}

const root = 'D:/Projects/procureflow/web/src';
const files = walk(root);
let fixed = 0, skipped = 0;

for (const fp of files) {
  const bytes = fs.readFileSync(fp);

  // Strip UTF-8 BOM if present
  const startOffset = (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) ? 3 : 0;
  const rawBytes = startOffset ? bytes.slice(startOffset) : bytes;

  const asUtf8 = rawBytes.toString('utf8');

  if (!MOJIBAKE_RE.test(asUtf8)) {
    skipped++;
    continue;
  }

  // Re-encode using CP1252 mapping to get back original bytes
  const reBytes = encodeAsCP1252(asUtf8);

  // Decode those bytes as UTF-8 = original correct text
  const fixedContent = reBytes.toString('utf8');

  // Sanity check: result shouldn't have control chars (except tab/newline/CR)
  const hasControlChars = /[\x00-\x08\x0E-\x1F]/.test(fixedContent);
  if (hasControlChars) {
    console.log('WARNING: control chars remain in', fp.replace('D:/Projects/procureflow/web/src/', ''));
  }

  fs.writeFileSync(fp, fixedContent, { encoding: 'utf8' });
  fixed++;
  console.log('fixed:', fp.replace('D:/Projects/procureflow/web/src/', ''));
}

console.log('\nDone. Fixed:', fixed, '/ Skipped:', skipped);
