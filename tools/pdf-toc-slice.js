#!/usr/bin/env node
'use strict';

// Local, zero-dependency, zero-API-call Textbook PDF Table of Contents (TOC) Inspector & Section Slicer.
// Usage:
//   node tools/pdf-toc-slice.js <textbook.pdf>
//   node tools/pdf-toc-slice.js <textbook.pdf> --match "Heart Failure, Loop Diuretics, Abnormal Findings"
//   node tools/pdf-toc-slice.js <textbook.pdf> --match "Perfusion" --pad 1 --features
//   node tools/pdf-toc-slice.js <textbook.pdf> --depth 3 --json

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { resolveSuiteFile } = require('./repo-checks');

const MAX_PDF_FILE_BYTES = 150 * 1024 * 1024;
const MAX_PDF_META_STREAM_BYTES = 32 * 1024 * 1024;
const MAX_PDF_DEPTH = 64;
const MAX_XREF_ENTRIES = 1000000;
const MAX_OBJSTM_ENTRIES = 100000;
const MAX_ALPHA_REPEAT = 20;
const MAX_PREDICTOR_COLUMNS = 65536;
const MAX_PREDICTOR_COLORS = 16;
const MAX_PREDICTOR_BPC = 16;
const MAX_PREDICTOR_ROW_BYTES = 1024 * 1024;
const FALLBACK_SCAN_WINDOW_BYTES = 8 * 1024 * 1024;
const FALLBACK_SCAN_OVERLAP_BYTES = 64;

// ── Shared Range, Role, Tree & Topic-Matching Helpers (extracted from canonical HTML) ──
// v21.10 (Phase 2): resolve suite HTML relative to repo root (not process.cwd()) and load lazily on first helper call so require() performs zero synchronous I/O.
let _cachedTocHelpers = null;
function loadSuiteTocHelpers() {
  const src = fs.readFileSync(resolveSuiteFile({ rootDir: path.resolve(__dirname, '..') }), 'utf8');
  const startAnchor = 'function kbMergePageRanges(';
  const endAnchor = '\nfunction kbFormatTocSlicePlanMd(';
  const a = src.indexOf(startAnchor);
  const b = a >= 0 ? src.indexOf(endAnchor, a + startAnchor.length) : -1;
  if (a < 0 || b <= a) throw new Error('Suite TOC helper extraction anchor missing');
  return new Function(
    '"use strict";\n' + src.slice(a, b) + '\nreturn {\n' +
    '  mergePageRanges: kbMergePageRanges,\n' +
    '  formatPageRanges: kbFormatPageRanges,\n' +
    '  countPagesInRanges: kbCountPagesInRanges,\n' +
    '  parsePageRanges: kbParsePageRanges,\n' +
    '  detectConceptSortQBank: kbDetectConceptSortQBank,\n' +
    '  suggestTextbookRole: kbSuggestTextbookRole,\n' +
    '  mergeConceptInput: kbMergeConceptInput,\n' +
    '  inferUploadDropMeta: kbInferUploadDropMeta,\n' +
    '  classifyTocFeature: kbClassifyTocFeature,\n' +
    '  buildTocTree: kbBuildTocTree,\n' +
    '  matchTocNodes: kbMatchTocNodes,\n' +
    '  resolveSelectionRanges: kbResolveTocSelectionRanges,\n' +
    '};'
  )();
}

function getTocHelpers() {
  if (!_cachedTocHelpers) _cachedTocHelpers = loadSuiteTocHelpers();
  return _cachedTocHelpers;
}

const mergePageRanges = (...a) => getTocHelpers().mergePageRanges(...a);
const formatPageRanges = (...a) => getTocHelpers().formatPageRanges(...a);
const countPagesInRanges = (...a) => getTocHelpers().countPagesInRanges(...a);
const parsePageRanges = (...a) => getTocHelpers().parsePageRanges(...a);
const detectConceptSortQBank = (...a) => getTocHelpers().detectConceptSortQBank(...a);
const suggestTextbookRole = (...a) => getTocHelpers().suggestTextbookRole(...a);
const mergeConceptInput = (...a) => getTocHelpers().mergeConceptInput(...a);
const inferUploadDropMeta = (...a) => getTocHelpers().inferUploadDropMeta(...a);
const classifyTocFeature = (...a) => getTocHelpers().classifyTocFeature(...a);
const buildTocTree = (...a) => getTocHelpers().buildTocTree(...a);
const matchTocNodes = (...a) => getTocHelpers().matchTocNodes(...a);
const resolveSelectionRanges = (...a) => getTocHelpers().resolveSelectionRanges(...a);

// ── Pure-Node PDF 1.4–1.7 Outline / Page-Tree / PageLabel Reader ──

const PDF_DOC_ENCODING_LOW = {
  0x80: '\u2022', 0x81: '\u2020', 0x82: '\u2021', 0x83: '\u2026', 0x84: '\u2014', 0x85: '\u2013',
  0x86: '\u0192', 0x87: '\u2044', 0x88: '\u2039', 0x89: '\u203A', 0x8A: '\u2212', 0x8B: '\u2030',
  0x8C: '\u201E', 0x8D: '\u201C', 0x8E: '\u201D', 0x8F: '\u2018', 0x90: '\u2019', 0x91: '\u201A',
  0x92: '\u2122', 0x93: '\uFB01', 0x94: '\uFB02', 0x95: '\u0141', 0x96: '\u0152', 0x97: '\u0160',
  0x98: '\u0178', 0x99: '\u017D', 0x9A: '\u0131', 0x9B: '\u0142', 0x9C: '\u0153', 0x9D: '\u0161',
  0x9E: '\u017E', 0xA0: '\u20AC',
};

function decodePdfBytes(bytes) {
  if (!bytes || !bytes.length) return '';
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    let out = '';
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
    }
    return out;
  }
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return Buffer.from(bytes.slice(3)).toString('utf8');
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += PDF_DOC_ENCODING_LOW[b] || String.fromCharCode(b);
  }
  return out;
}

function isPdfWs(b) {
  return b === 0x00 || b === 0x09 || b === 0x0A || b === 0x0C || b === 0x0D || b === 0x20;
}

function isPdfDelim(b) {
  return b === 0x28 || b === 0x29 || b === 0x3C || b === 0x3E || b === 0x5B || b === 0x5D ||
    b === 0x7B || b === 0x7D || b === 0x2F || b === 0x25;
}

class PdfCursor {
  constructor(buf, pos = 0, end = buf.length) {
    this.buf = buf;
    this.pos = pos;
    this.end = Math.min(buf.length, end);
  }
  skipWs() {
    while (this.pos < this.end) {
      const b = this.buf[this.pos];
      if (isPdfWs(b)) { this.pos++; continue; }
      if (b === 0x25) { // % comment
        this.pos++;
        while (this.pos < this.end && this.buf[this.pos] !== 0x0A && this.buf[this.pos] !== 0x0D) this.pos++;
        continue;
      }
      break;
    }
  }
  peek() {
    this.skipWs();
    return this.pos < this.end ? this.buf[this.pos] : -1;
  }
  readWord() {
    this.skipWs();
    const start = this.pos;
    while (this.pos < this.end && !isPdfWs(this.buf[this.pos]) && !isPdfDelim(this.buf[this.pos])) this.pos++;
    return this.buf.slice(start, this.pos).toString('latin1');
  }
  readName() {
    this.pos++; // skip '/'
    let raw = '';
    while (this.pos < this.end && !isPdfWs(this.buf[this.pos]) && !isPdfDelim(this.buf[this.pos])) {
      if (this.buf[this.pos] === 0x23 && this.pos + 2 < this.end) {
        const hex = this.buf.slice(this.pos + 1, this.pos + 3).toString('latin1');
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          raw += String.fromCharCode(Number.parseInt(hex, 16));
          this.pos += 3;
          continue;
        }
      }
      raw += String.fromCharCode(this.buf[this.pos++]);
    }
    return { kind: 'name', value: raw };
  }
  readLiteralString() {
    this.pos++; // skip '('
    const bytes = [];
    let depth = 1;
    while (this.pos < this.end && depth > 0) {
      const b = this.buf[this.pos++];
      if (b === 0x5C) { // backslash
        if (this.pos >= this.end) break;
        const esc = this.buf[this.pos++];
        if (esc === 0x6E) bytes.push(0x0A);
        else if (esc === 0x72) bytes.push(0x0D);
        else if (esc === 0x74) bytes.push(0x09);
        else if (esc === 0x62) bytes.push(0x08);
        else if (esc === 0x66) bytes.push(0x0C);
        else if (esc === 0x0D) { if (this.pos < this.end && this.buf[this.pos] === 0x0A) this.pos++; }
        else if (esc === 0x0A) { /* line continuation */ }
        else if (esc >= 0x30 && esc <= 0x37) {
          let oct = esc - 0x30;
          for (let k = 0; k < 2 && this.pos < this.end && this.buf[this.pos] >= 0x30 && this.buf[this.pos] <= 0x37; k++) {
            oct = (oct << 3) + (this.buf[this.pos++] - 0x30);
          }
          bytes.push(oct & 0xFF);
        } else {
          bytes.push(esc);
        }
        continue;
      }
      if (b === 0x28) { depth++; bytes.push(b); continue; }
      if (b === 0x29) { depth--; if (depth > 0) bytes.push(b); continue; }
      bytes.push(b);
    }
    return { kind: 'string', bytes, value: decodePdfBytes(bytes) };
  }
  readHexString() {
    this.pos++; // skip '<'
    let hex = '';
    while (this.pos < this.end) {
      const b = this.buf[this.pos++];
      if (b === 0x3E) break;
      if (isPdfWs(b)) continue;
      hex += String.fromCharCode(b);
    }
    if (hex.length % 2 === 1) hex += '0';
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      const v = Number.parseInt(hex.slice(i, i + 2), 16);
      bytes.push(Number.isFinite(v) ? v : 0);
    }
    return { kind: 'string', bytes, value: decodePdfBytes(bytes) };
  }
  readArray(depth = 0) {
    if (depth > MAX_PDF_DEPTH) throw new Error('PDF nesting depth exceeds safety limit');
    this.pos++; // skip '['
    const items = [];
    while (this.pos < this.end) {
      const pk = this.peek();
      if (pk < 0 || pk === 0x5D) { if (pk === 0x5D) this.pos++; break; }
      const val = this.readObject(true, depth + 1);
      if (val === undefined) break;
      items.push(val);
    }
    return items;
  }
  readDictOrStream(allowStream = true, depth = 0) {
    if (depth > MAX_PDF_DEPTH) throw new Error('PDF nesting depth exceeds safety limit');
    this.pos += 2; // skip '<<'
    const dict = Object.create(null);
    while (this.pos < this.end) {
      const pk = this.peek();
      if (pk < 0) break;
      if (pk === 0x3E && this.pos + 1 < this.end && this.buf[this.pos + 1] === 0x3E) {
        this.pos += 2;
        break;
      }
      if (pk !== 0x2F) {
        const junk = this.readObject(true, depth + 1);
        if (junk === undefined) break;
        continue;
      }
      const key = this.readName().value;
      const val = this.readObject(true, depth + 1);
      if (val !== undefined) dict[key] = val;
    }
    if (!allowStream) return { kind: 'dict', dict };
    const saved = this.pos;
    const nextTok = this.readWord();
    if (nextTok === 'stream') {
      if (this.pos < this.end && this.buf[this.pos] === 0x0D) this.pos++;
      if (this.pos < this.end && this.buf[this.pos] === 0x0A) this.pos++;
      const streamStart = this.pos;
      let streamEnd = -1;
      if (typeof dict.Length === 'number' && dict.Length >= 0 && streamStart + dict.Length <= this.end) {
        streamEnd = streamStart + dict.Length;
      } else {
        const idx = this.buf.indexOf('endstream', streamStart, 'latin1');
        streamEnd = idx >= 0 ? idx : this.end;
        while (streamEnd > streamStart && (this.buf[streamEnd - 1] === 0x0A || this.buf[streamEnd - 1] === 0x0D)) streamEnd--;
      }
      const rawStream = this.buf.slice(streamStart, streamEnd);
      const endMarker = this.buf.indexOf('endstream', streamEnd, 'latin1');
      this.pos = endMarker >= 0 ? endMarker + 9 : streamEnd;
      return { kind: 'stream', dict, rawStream };
    }
    this.pos = saved;
    return { kind: 'dict', dict };
  }
  readObject(allowStream = true, depth = 0) {
    if (depth > MAX_PDF_DEPTH) throw new Error('PDF nesting depth exceeds safety limit');
    const pk = this.peek();
    if (pk < 0) return undefined;
    if (pk === 0x2F) return this.readName();
    if (pk === 0x28) return this.readLiteralString();
    if (pk === 0x5B) return this.readArray(depth + 1);
    if (pk === 0x3C) {
      if (this.pos + 1 < this.end && this.buf[this.pos + 1] === 0x3C) return this.readDictOrStream(allowStream, depth + 1);
      return this.readHexString();
    }
    const word = this.readWord();
    if (!word) { this.pos++; return undefined; }
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'null') return null;
    if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(word)) {
      const num = Number(word);
      if (/^\d+$/.test(word)) {
        const save1 = this.pos;
        const w2 = this.readWord();
        if (/^\d+$/.test(w2)) {
          const w3 = this.readWord();
          if (w3 === 'R') return { kind: 'ref', num, gen: Number(w2) };
        }
        this.pos = save1;
      }
      return num;
    }
    return { kind: 'keyword', value: word };
  }
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function applyPdfPredictor(data, parms) {
  const predictor = Number(parms && parms.Predictor) || 1;
  if (predictor <= 1) return data;
  if (parms && parms.Colors != null) {
    const rc = Number(parms.Colors);
    if (!Number.isFinite(rc) || rc < 1 || rc > MAX_PREDICTOR_COLORS) throw new Error('Invalid PDF predictor Colors parameter');
  }
  if (parms && parms.BitsPerComponent != null) {
    const rb = Number(parms.BitsPerComponent);
    if (!Number.isFinite(rb) || rb < 1 || rb > MAX_PREDICTOR_BPC) throw new Error('Invalid PDF predictor BitsPerComponent parameter');
  }
  if (parms && parms.Columns != null) {
    const rcol = Number(parms.Columns);
    if (!Number.isFinite(rcol) || rcol < 1 || rcol > MAX_PREDICTOR_COLUMNS) throw new Error('Invalid PDF predictor Columns parameter');
  }
  const colors = Math.max(1, Math.floor(Number(parms && parms.Colors) || 1));
  const bpc = Math.max(1, Math.floor(Number(parms && parms.BitsPerComponent) || 8));
  const columns = Math.max(1, Math.floor(Number(parms && parms.Columns) || 1));
  const bpp = Math.max(1, Math.ceil((colors * bpc) / 8));
  const rowBytes = Math.ceil((columns * colors * bpc) / 8);
  if (rowBytes < 1 || rowBytes > MAX_PREDICTOR_ROW_BYTES || rowBytes > data.length) {
    throw new Error('PDF predictor row width exceeds stream bounds');
  }
  if (predictor === 2) {
    const out = Buffer.from(data);
    for (let r = 0; r + rowBytes <= out.length; r += rowBytes) {
      for (let i = bpp; i < rowBytes; i++) out[r + i] = (out[r + i] + out[r + i - bpp]) & 0xFF;
    }
    return out;
  }
  if (predictor >= 10 && predictor <= 15) {
    const stride = rowBytes + 1;
    // v21.10 (Phase 2): PNG predictors carry a 1-byte filter prefix per row, so verify full stride against data.length.
    if (stride > data.length) {
      throw new Error('PDF predictor row width exceeds stream bounds');
    }
    const rows = Math.floor(data.length / stride);
    if (rows * rowBytes > MAX_PDF_META_STREAM_BYTES) {
      throw new Error('PDF predictor output exceeds safety ceiling');
    }
    const out = Buffer.alloc(rows * rowBytes);
    let prevRow = Buffer.alloc(rowBytes);
    let curRow = Buffer.alloc(rowBytes);
    for (let r = 0; r < rows; r++) {
      const filter = data[r * stride];
      for (let i = 0; i < rowBytes; i++) {
        const raw = data[r * stride + 1 + i];
        const left = i >= bpp ? curRow[i - bpp] : 0;
        const up = prevRow[i];
        const upLeft = i >= bpp ? prevRow[i - bpp] : 0;
        if (filter === 0) curRow[i] = raw;
        else if (filter === 1) curRow[i] = (raw + left) & 0xFF;
        else if (filter === 2) curRow[i] = (raw + up) & 0xFF;
        else if (filter === 3) curRow[i] = (raw + Math.floor((left + up) / 2)) & 0xFF;
        else if (filter === 4) curRow[i] = (raw + paethPredictor(left, up, upLeft)) & 0xFF;
        else curRow[i] = raw;
      }
      curRow.copy(out, r * rowBytes);
      const tmp = prevRow;
      prevRow = curRow;
      curRow = tmp;
    }
    return out;
  }
  return data;
}

class PdfReader {
  constructor(buf) {
    this.buf = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    this.xref = new Map(); // objNum -> { type: 1, offset } | { type: 2, stmObj, index }
    this.objCache = new Map();
    this.stmCache = new Map();
    this.rootRef = null;
    this.initXref();
  }

  decompressStream(streamObj) {
    let data = streamObj.rawStream;
    const dict = streamObj.dict || {};
    let filters = this.deref(dict.Filter);
    let parms = this.deref(dict.DecodeParms);
    if (!filters) return data;
    if (!Array.isArray(filters)) filters = [filters];
    if (!Array.isArray(parms)) parms = [parms];
    for (let i = 0; i < filters.length; i++) {
      const fObj = this.deref(filters[i]);
      const pObj = this.deref(parms[i]);
      const fName = fObj && fObj.kind === 'name' ? fObj.value : '';
      const p = (pObj && pObj.kind === 'dict') ? pObj.dict : null;
      if (fName === 'FlateDecode' || fName === 'Fl') {
        try {
          data = zlib.inflateSync(data, { maxOutputLength: MAX_PDF_META_STREAM_BYTES });
        } catch (err) {
          if (err && err.code === 'ERR_BUFFER_TOO_LARGE') {
            throw new Error('PDF metadata stream exceeds 32 MB decompression limit');
          }
          try {
            data = zlib.inflateRawSync(data, { maxOutputLength: MAX_PDF_META_STREAM_BYTES });
          } catch (rawErr) {
            if (rawErr && rawErr.code === 'ERR_BUFFER_TOO_LARGE') {
              throw new Error('PDF metadata stream exceeds 32 MB decompression limit');
            }
            throw rawErr;
          }
        }
        if (p) data = applyPdfPredictor(data, p);
      } else {
        // v21.10 (Phase 2): reject unsupported stream filters explicitly instead of returning raw undecoded bytes.
        throw new Error('Unsupported PDF stream filter: ' + (fName || 'unknown'));
      }
    }
    return data;
  }

  readIndirectAt(offset, expectedNum = null) {
    const cur = new PdfCursor(this.buf, offset);
    const n1 = cur.readWord();
    const n2 = cur.readWord();
    const kw = cur.readWord();
    if (!/^\d+$/.test(n1) || !/^\d+$/.test(n2) || kw !== 'obj') return undefined;
    if (expectedNum !== null && Number(n1) !== expectedNum) return undefined;
    const obj = cur.readObject(true);
    if (obj && obj.kind === 'stream' && obj.dict && typeof obj.dict.Length === 'object' && obj.dict.Length.kind === 'ref') {
      const resolvedLen = this.deref(obj.dict.Length);
      if (typeof resolvedLen === 'number' && resolvedLen >= 0) {
        // Re-slice exact stream bytes when /Length was an indirect reference
        const reCur = new PdfCursor(this.buf, offset);
        reCur.readWord(); reCur.readWord(); reCur.readWord();
        const dictOnly = reCur.readObject(false);
        if (dictOnly && dictOnly.kind === 'dict') {
          const w = reCur.readWord();
          if (w === 'stream') {
            if (reCur.pos < reCur.end && this.buf[reCur.pos] === 0x0D) reCur.pos++;
            if (reCur.pos < reCur.end && this.buf[reCur.pos] === 0x0A) reCur.pos++;
            obj.rawStream = this.buf.slice(reCur.pos, Math.min(this.buf.length, reCur.pos + resolvedLen));
          }
        }
      }
    }
    return obj;
  }

  parseXrefAt(offset, visited = new Set()) {
    if (!Number.isFinite(offset) || offset < 0 || offset >= this.buf.length || visited.has(offset)) return null;
    visited.add(offset);
    const cur = new PdfCursor(this.buf, offset);
    const first = cur.readWord();
    if (first === 'xref') {
      while (cur.pos < cur.end) {
        const save = cur.pos;
        const w = cur.readWord();
        if (w === 'trailer') break;
        const countWord = cur.readWord();
        if (!/^\d+$/.test(w) || !/^\d+$/.test(countWord)) { cur.pos = save; break; }
        const startNum = Number(w), count = Number(countWord);
        // v21.10 (Phase 2): stop on EOF/malformed rows and cap total XRef entries to block crafted '0 2000000000' CPU/memory DoS.
        for (let i = 0; i < count; i++) {
          if (cur.pos >= cur.end) break;
          const offStr = cur.readWord();
          const genStr = cur.readWord();
          const flag = cur.readWord();
          if (!offStr || !genStr || !flag || !/^\d+$/.test(offStr) || !/^\d+$/.test(genStr)) break;
          const objNum = startNum + i;
          if (flag === 'n' && !this.xref.has(objNum)) {
            if (this.xref.size >= MAX_XREF_ENTRIES) throw new Error('PDF XRef entry count exceeds safety limit');
            this.xref.set(objNum, { type: 1, offset: Number(offStr), gen: Number(genStr) });
          }
        }
      }
      const tr = cur.readObject(false);
      const trailer = tr && tr.kind === 'dict' ? tr.dict : null;
      if (trailer) {
        if (!this.rootRef && trailer.Root && trailer.Root.kind === 'ref') this.rootRef = trailer.Root;
        if (typeof trailer.XRefStm === 'number') this.parseXrefAt(trailer.XRefStm, visited);
        if (typeof trailer.Prev === 'number') this.parseXrefAt(trailer.Prev, visited);
      }
      return trailer;
    }
    // PDF 1.5+ compressed /Type /XRef stream
    const xrefObj = this.readIndirectAt(offset);
    if (xrefObj && xrefObj.kind === 'stream' && xrefObj.dict) {
      const d = xrefObj.dict;
      if (!this.rootRef && d.Root && d.Root.kind === 'ref') this.rootRef = d.Root;
      const W = Array.isArray(d.W) ? d.W.map(Number) : [];
      if (W.length === 3) {
        const [w0, w1, w2] = W;
        const entryLen = w0 + w1 + w2;
        // v21.10 (Phase 2): validate /W field widths and require entryLen > 0 so /W [0 0 0] cannot spin indefinitely without advancing pos.
        if (!W.every(wv => Number.isInteger(wv) && wv >= 0 && wv <= 6) || entryLen <= 0) {
          throw new Error('Invalid PDF XRef /W field widths');
        }
        const size = Number(d.Size) || 0;
        const indexArr = Array.isArray(d.Index) && d.Index.length >= 2 ? d.Index.map(Number) : [0, size];
        const raw = this.decompressStream(xrefObj);
        let pos = 0;
        const readInt = width => {
          let v = 0;
          for (let b = 0; b < width; b++) v = (v * 256) + (raw[pos + b] || 0);
          pos += width;
          return v;
        };
        for (let s = 0; s + 1 < indexArr.length; s += 2) {
          const firstObj = indexArr[s], count = indexArr[s + 1];
          if (!Number.isInteger(firstObj) || !Number.isInteger(count) || count < 0) continue;
          for (let k = 0; k < count && pos + entryLen <= raw.length; k++) {
            const t = w0 === 0 ? 1 : readInt(w0);
            const f1 = w1 === 0 ? 0 : readInt(w1);
            const f2 = w2 === 0 ? 0 : readInt(w2);
            const objNum = firstObj + k;
            if (!this.xref.has(objNum)) {
              if (this.xref.size >= MAX_XREF_ENTRIES) throw new Error('PDF XRef entry count exceeds safety limit');
              if (t === 1) this.xref.set(objNum, { type: 1, offset: f1, gen: f2 });
              else if (t === 2) this.xref.set(objNum, { type: 2, stmObj: f1, index: f2 });
            }
          }
        }
      }
      if (typeof d.Prev === 'number') this.parseXrefAt(d.Prev, visited);
      return d;
    }
    return null;
  }

  fallbackScanObjects() {
    const win = FALLBACK_SCAN_WINDOW_BYTES;
    const overlap = FALLBACK_SCAN_OVERLAP_BYTES;
    const re = /(?:^|[\r\n])\s*(\d+)\s+(\d+)\s+obj\b/g;
    for (let base = 0; base < this.buf.length; base += win - overlap) {
      const end = Math.min(this.buf.length, base + win);
      const text = this.buf.subarray(base, end).toString('latin1');
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        const objNum = Number(m[1]);
        const localOff = base + m.index + m[0].indexOf(m[1]);
        this.xref.set(objNum, { type: 1, offset: localOff, gen: Number(m[2]) });
      }
      if (end >= this.buf.length) break;
    }
    if (!this.rootRef) {
      for (const [objNum] of this.xref) {
        const obj = this.getObject(objNum);
        const d = obj && obj.dict;
        if (d && d.Type && d.Type.kind === 'name' && d.Type.value === 'Catalog') {
          this.rootRef = { kind: 'ref', num: objNum, gen: 0 };
          break;
        }
      }
    }
  }

  initXref() {
    const tailSize = Math.min(this.buf.length, 8192);
    const tail = this.buf.slice(this.buf.length - tailSize).toString('latin1');
    const matches = [...tail.matchAll(/startxref\s+(\d+)/g)];
    if (matches.length) {
      const startXref = Number(matches[matches.length - 1][1]);
      this.parseXrefAt(startXref);
    }
    if (!this.xref.size || !this.rootRef) this.fallbackScanObjects();
  }

  getObjectFromStream(stmObjNum, indexInStm) {
    if (!this.stmCache.has(stmObjNum)) {
      const map = new Map();
      const stm = this.getObject(stmObjNum);
      if (stm && stm.kind === 'stream' && stm.dict) {
        const n = Number(stm.dict.N) || 0;
        const first = Number(stm.dict.First) || 0;
        // v21.10 (Phase 2): cap /N and /First and break on header EOF to block crafted ObjStm DoS loops.
        if (!Number.isInteger(n) || n < 0 || n > MAX_OBJSTM_ENTRIES) {
          throw new Error('PDF object stream /N exceeds safety limit');
        }
        const data = this.decompressStream(stm);
        if (!Number.isInteger(first) || first < 0 || first > data.length) {
          throw new Error('Invalid PDF object stream /First offset');
        }
        const headerCur = new PdfCursor(data, 0, first);
        const pairs = [];
        for (let i = 0; i < n; i++) {
          if (headerCur.pos >= headerCur.end) break;
          const w1 = headerCur.readWord();
          const w2 = headerCur.readWord();
          if (!/^\d+$/.test(w1) || !/^\d+$/.test(w2)) break;
          const onum = Number(w1);
          const off = Number(w2);
          if (Number.isFinite(onum) && Number.isFinite(off)) pairs.push({ onum, off: first + off, idx: i });
        }
        for (let i = 0; i < pairs.length; i++) {
          const endOff = i + 1 < pairs.length ? pairs[i + 1].off : data.length;
          const objCur = new PdfCursor(data, pairs[i].off, endOff);
          const val = objCur.readObject(false);
          map.set(pairs[i].idx, { onum: pairs[i].onum, val });
          map.set('obj:' + pairs[i].onum, val);
        }
      }
      this.stmCache.set(stmObjNum, map);
    }
    const stmMap = this.stmCache.get(stmObjNum);
    const byIdx = stmMap.get(indexInStm);
    return byIdx ? byIdx.val : undefined;
  }

  getObject(objNum, depth = 0) {
    if (depth > 20) return undefined;
    if (this.objCache.has(objNum)) return this.objCache.get(objNum);
    const entry = this.xref.get(objNum);
    if (!entry) return undefined;
    let val;
    if (entry.type === 1) val = this.readIndirectAt(entry.offset, objNum);
    else if (entry.type === 2) {
      val = this.getObjectFromStream(entry.stmObj, entry.index);
      if (val === undefined && this.stmCache.has(entry.stmObj)) {
        val = this.stmCache.get(entry.stmObj).get('obj:' + objNum);
      }
    }
    this.objCache.set(objNum, val);
    return val;
  }

  deref(val, depth = 0) {
    if (depth > 20 || !val || typeof val !== 'object') return val;
    if (val.kind === 'ref') return this.deref(this.getObject(val.num, depth + 1), depth + 1);
    return val;
  }
}

function toRoman(num, lower = true) {
  let n = Math.floor(Number(num));
  if (!Number.isFinite(n) || n <= 0 || n >= 4000) return String(num);
  const table = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
    [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  for (const [v, sym] of table) { while (n >= v) { out += sym; n -= v; } }
  return lower ? out.toLowerCase() : out;
}

function toAlphaLabel(num, lower = true) {
  const n = Math.max(1, Math.floor(Number(num)) || 1);
  const ch = String.fromCharCode(((n - 1) % 26) + (lower ? 97 : 65));
  // v21.10 (Phase 2): cap repeat count so crafted huge PageLabels /St values cannot trigger RangeError or OOM.
  return ch.repeat(Math.min(MAX_ALPHA_REPEAT, Math.floor((n - 1) / 26) + 1));
}

function buildPageMap(reader, catalogDict) {
  const pageObjToPageNum = new Map();
  let pageCount = 0;
  const visited = new Set();
  const walk = (refOrObj, depth = 0) => {
    if (depth > MAX_PDF_DEPTH) return;
    let refNum = null;
    if (refOrObj && refOrObj.kind === 'ref') {
      refNum = refOrObj.num;
      if (visited.has(refNum)) return;
      visited.add(refNum);
    }
    const obj = reader.deref(refOrObj);
    const d = obj && obj.dict;
    if (!d) return;
    const tp = d.Type && d.Type.kind === 'name' ? d.Type.value : '';
    const kids = reader.deref(d.Kids);
    if (tp === 'Pages' || Array.isArray(kids)) {
      for (const k of Array.isArray(kids) ? kids : []) walk(k, depth + 1);
    } else if (tp === 'Page' || refNum !== null) {
      pageCount++;
      if (refNum !== null) pageObjToPageNum.set(refNum, pageCount);
    }
  };
  if (catalogDict && catalogDict.Pages) walk(catalogDict.Pages, 0);
  return { pageObjToPageNum, numPages: Math.max(1, pageCount) };
}

function collectNumberTree(reader, nodeObj, out = [], visited = new Set(), depth = 0) {
  if (!nodeObj || depth > MAX_PDF_DEPTH) return out;
  if (nodeObj.kind === 'ref') {
    if (visited.has(nodeObj.num)) return out;
    visited.add(nodeObj.num);
  }
  const resolved = reader.deref(nodeObj);
  const d = resolved && resolved.dict;
  if (!d) return out;
  const nums = reader.deref(d.Nums);
  if (Array.isArray(nums)) {
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const k = reader.deref(nums[i]);
      const v = reader.deref(nums[i + 1]);
      if (typeof k === 'number') out.push([k, v]);
    }
  }
  const kids = reader.deref(d.Kids);
  if (Array.isArray(kids)) for (const kid of kids) collectNumberTree(reader, kid, out, visited, depth + 1);
  return out;
}

function buildPageLabels(reader, catalogDict, numPages) {
  if (!catalogDict || !catalogDict.PageLabels) return null;
  const entries = collectNumberTree(reader, catalogDict.PageLabels);
  if (!entries.length) return null;
  entries.sort((a, b) => a[0] - b[0]);
  const labels = new Array(numPages).fill('');
  for (let s = 0; s < entries.length; s++) {
    const startIdx = Math.max(0, Math.floor(entries[s][0]));
    const nextIdx = s + 1 < entries.length ? Math.min(numPages, Math.floor(entries[s + 1][0])) : numPages;
    const spec = (entries[s][1] && entries[s][1].dict) || {};
    const style = spec.S && spec.S.kind === 'name' ? spec.S.value : '';
    const prefixObj = reader.deref(spec.P);
    const prefix = prefixObj && prefixObj.kind === 'string' ? prefixObj.value : '';
    const st = typeof spec.St === 'number' ? Math.max(1, Math.floor(spec.St)) : 1;
    for (let p = startIdx; p < nextIdx && p < numPages; p++) {
      const n = st + (p - startIdx);
      let numPart = '';
      if (style === 'D') numPart = String(n);
      else if (style === 'r') numPart = toRoman(n, true);
      else if (style === 'R') numPart = toRoman(n, false);
      else if (style === 'a') numPart = toAlphaLabel(n, true);
      else if (style === 'A') numPart = toAlphaLabel(n, false);
      labels[p] = prefix + numPart;
    }
  }
  return labels;
}

function collectNameTree(reader, nodeObj, map = new Map(), visited = new Set(), depth = 0) {
  if (!nodeObj || depth > MAX_PDF_DEPTH) return map;
  if (nodeObj.kind === 'ref') {
    if (visited.has(nodeObj.num)) return map;
    visited.add(nodeObj.num);
  }
  const resolved = reader.deref(nodeObj);
  const d = resolved && resolved.dict;
  if (!d) return map;
  const names = reader.deref(d.Names);
  if (Array.isArray(names)) {
    for (let i = 0; i + 1 < names.length; i += 2) {
      const kObj = reader.deref(names[i]);
      const key = kObj && kObj.kind === 'string' ? kObj.value : (kObj && kObj.kind === 'name' ? kObj.value : null);
      if (key !== null) map.set(key, names[i + 1]);
    }
  }
  const kids = reader.deref(d.Kids);
  if (Array.isArray(kids)) for (const kid of kids) collectNameTree(reader, kid, map, visited, depth + 1);
  return map;
}

function buildNamedDestLookup(reader, catalogDict) {
  const map = new Map();
  if (!catalogDict) return map;
  if (catalogDict.Dests) {
    const destsObj = reader.deref(catalogDict.Dests);
    if (destsObj && destsObj.dict) {
      for (const [k, v] of Object.entries(destsObj.dict)) map.set(k, v);
    }
  }
  if (catalogDict.Names) {
    const namesRoot = reader.deref(catalogDict.Names);
    if (namesRoot && namesRoot.dict && namesRoot.dict.Dests) {
      collectNameTree(reader, namesRoot.dict.Dests, map);
    }
  }
  return map;
}

function resolveDestPage(reader, rawDest, pageObjToPageNum, namedDests, numPages, depth = 0) {
  if (!rawDest || depth > 8) return null;
  const d = reader.deref(rawDest);
  if (!d) return null;
  if (Array.isArray(d) && d.length > 0) {
    const first = d[0];
    if (first && first.kind === 'ref') {
      return pageObjToPageNum.get(first.num) || null;
    }
    if (typeof first === 'number' && Number.isFinite(first)) {
      const p = Math.floor(first) + 1;
      return p >= 1 && p <= numPages ? p : null;
    }
    return null;
  }
  if (d.kind === 'dict' && d.dict && d.dict.D) {
    return resolveDestPage(reader, d.dict.D, pageObjToPageNum, namedDests, numPages, depth + 1);
  }
  if (d.kind === 'string' || d.kind === 'name') {
    const target = namedDests.get(d.value);
    if (target) return resolveDestPage(reader, target, pageObjToPageNum, namedDests, numPages, depth + 1);
  }
  return null;
}

function readOutlineItems(reader, firstRef, pageObjToPageNum, namedDests, numPages, depth = 0) {
  if (!firstRef || depth > 24) return [];
  const items = [];
  const seenSiblings = new Set();
  let cur = firstRef;
  while (cur) {
    if (cur.kind === 'ref') {
      if (seenSiblings.has(cur.num)) break;
      seenSiblings.add(cur.num);
    }
    const obj = reader.deref(cur);
    const d = obj && obj.dict;
    if (!d) break;
    const titleObj = reader.deref(d.Title);
    const title = titleObj && titleObj.kind === 'string' ? titleObj.value.replace(/\s+/g, ' ').trim() : '';
    let destSpec = d.Dest || null;
    if (!destSpec && d.A) {
      const act = reader.deref(d.A);
      if (act && act.dict) {
        const sType = act.dict.S && act.dict.S.kind === 'name' ? act.dict.S.value : '';
        if (!sType || sType === 'GoTo') destSpec = act.dict.D || null;
      }
    }
    const page = resolveDestPage(reader, destSpec, pageObjToPageNum, namedDests, numPages);
    const kids = d.First ? readOutlineItems(reader, d.First, pageObjToPageNum, namedDests, numPages, depth + 1) : [];
    items.push({ title, page, items: kids });
    cur = d.Next || null;
  }
  return items;
}

function inspectPdfTocBuffer(buf, fileName = 'textbook.pdf') {
  if (!buf || buf.length < 8 || buf.slice(0, 5).toString('latin1') !== '%PDF-') {
    throw new Error('Not a valid PDF file: ' + fileName);
  }
  const reader = new PdfReader(buf);
  const catalogObj = reader.rootRef ? reader.deref(reader.rootRef) : null;
  const catalogDict = (catalogObj && catalogObj.dict) || null;
  const { pageObjToPageNum, numPages } = buildPageMap(reader, catalogDict);
  const pageLabels = buildPageLabels(reader, catalogDict, numPages);
  const namedDests = buildNamedDestLookup(reader, catalogDict);
  let rawOutline = [];
  if (catalogDict && catalogDict.Outlines) {
    const outlinesObj = reader.deref(catalogDict.Outlines);
    if (outlinesObj && outlinesObj.dict && outlinesObj.dict.First) {
      rawOutline = readOutlineItems(reader, outlinesObj.dict.First, pageObjToPageNum, namedDests, numPages);
    }
  }
  const tree = buildTocTree(rawOutline, numPages, pageLabels);
  const topTitles = tree.flat.filter(n => n.depth <= 2).slice(0, 25).map(n => n.title);
  const suggestedRole = suggestTextbookRole(fileName, topTitles);
  return {
    fileName: path.basename(fileName),
    fileSize: buf.length,
    numPages,
    source: tree.flat.length ? 'outline' : 'none',
    hasBookLabels: tree.hasBookLabels,
    suggestedRole,
    roots: tree.roots,
    flat: tree.flat,
  };
}

function inspectPdfTocFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error('PDF file not found: ' + resolved);
  }
  const st = fs.statSync(resolved);
  if (!st.isFile()) {
    throw new Error('PDF file not found: ' + resolved);
  }
  // v21.10 (Phase 2): enforce the 150 MB safety cap before reading file bytes into RAM.
  if (st.size > MAX_PDF_FILE_BYTES) {
    throw new Error('PDF file exceeds 150 MB safety limit (' + (st.size / 1048576).toFixed(1) + ' MB)');
  }
  return inspectPdfTocBuffer(fs.readFileSync(resolved), path.basename(resolved));
}

// ── CLI Runner ──

function parseCli(argv) {
  const opts = { file: '', match: '', pad: 0, depth: 2, all: false, features: false, json: false, help: false };
  let afterDoubleDash = false;
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!afterDoubleDash && a === '--') { afterDoubleDash = true; continue; }
    if (!afterDoubleDash) {
      if (a === '-h' || a === '--help') { opts.help = true; continue; }
      if (a === '--all') { opts.all = true; continue; }
      if (a === '--features') { opts.features = true; continue; }
      if (a === '--json') { opts.json = true; continue; }
      if (a === '-m' || a === '--match') {
        const next = argv[++i];
        if (next === undefined) throw new Error('Missing value for ' + a);
        opts.match = opts.match ? opts.match + ', ' + next : next;
        continue;
      }
      if (a === '--pad') {
        if (seen.has('--pad')) throw new Error('Duplicate option: --pad');
        seen.add('--pad');
        const raw = argv[++i];
        if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new Error('--pad must be an integer 0..5');
        const next = Number(raw);
        if (!Number.isSafeInteger(next) || next < 0 || next > 5) throw new Error('--pad must be an integer 0..5');
        opts.pad = next;
        continue;
      }
      if (a === '--depth') {
        if (seen.has('--depth')) throw new Error('Duplicate option: --depth');
        seen.add('--depth');
        const raw = argv[++i];
        if (typeof raw !== 'string' || !/^\d+$/.test(raw)) throw new Error('--depth must be an integer 1..12');
        const next = Number(raw);
        if (!Number.isSafeInteger(next) || next < 1 || next > 12) throw new Error('--depth must be an integer 1..12');
        opts.depth = next;
        continue;
      }
      if (a.startsWith('-')) throw new Error('Unknown option: ' + a);
    }
    if (!opts.file) opts.file = a;
    else throw new Error('Unexpected positional argument: ' + a);
  }
  return opts;
}

function formatFeatureTag(feat) {
  if (feat === 'abnormal-table') return ' [Abnormal Findings]';
  if (feat === 'prototype-drug') return ' [Prototype / Drug Table]';
  if (feat === 'nursing-process') return ' [Nursing Process]';
  if (feat === 'key-concepts') return ' [Key Concepts]';
  return '';
}

function formatNodeLine(n) {
  const indent = '  '.repeat(n.depth);
  const pdfSpan = n.startPage === n.endPage ? 'PDF p. ' + n.startPage : 'PDF pp. ' + n.startPage + '-' + n.endPage;
  const bookSpan = n.bookLabelDiffers ? ' (Book ' + (n.bookStart === n.bookEnd ? 'p. ' + n.bookStart : 'pp. ' + n.bookStart + '-' + n.bookEnd) + ')' : '';
  return `${indent}- ${n.title}${formatFeatureTag(n.feature)}  ->  ${pdfSpan}${bookSpan}  [${n.pageCount} pp.]`;
}

function printHelp() {
  console.log([
    'Nursing Study Suite — Local PDF TOC Inspector & Section Slicer (0 API calls)',
    '',
    'Usage:',
    '  node tools/pdf-toc-slice.js <textbook.pdf> [options]',
    '',
    'Options:',
    '  -m, --match "<topics>"  Comma-separated exam topics, exemplars, or drug classes',
    '  --pad <0..5>            Pad each selected section end by N PDF pages (default: 0)',
    '  --features              Also include Abnormal Findings / Prototype / Nursing Process / Key Concepts',
    '                          sections inside matched chapters (or across the book if no --match)',
    '  --depth <1..12>         Max outline depth when browsing without --match (default: 2)',
    '  --all                   Print all outline levels when browsing',
    '  --json                  Print machine-readable JSON output',
    '  -h, --help              Show this help message',
    '',
    'Examples:',
    '  node tools/pdf-toc-slice.js Porth-Essentials.pdf --match "Heart Failure"',
    '  node tools/pdf-toc-slice.js McCuistion-Pharm.pdf --match "Loop Diuretics, Cardiac Glycosides"',
    '  node tools/pdf-toc-slice.js Jarvis-Assessment.pdf --match "Heart and Neck Vessels" --features',
  ].join('\n'));
}

function main() {
  const opts = parseCli(process.argv.slice(2));
  if (opts.help || !opts.file) {
    printHelp();
    process.exit(opts.help ? 0 : 1);
  }
  const report = inspectPdfTocFile(opts.file);
  const matchInfo = opts.match ? matchTocNodes(report.flat, opts.match) : { terms: [], matchedIds: new Set(), recommendedIds: new Set(), matchedTermsById: new Map() };
  const selectedIds = new Set(matchInfo.recommendedIds);

  if (opts.features) {
    if (opts.match && matchInfo.matchedIds.size > 0) {
      // Include high-yield feature sections belonging to any matched chapter/unit or matched section
      // v21.10 (Phase 2): index report.flat by ID once so ancestor lookups stay O(1) instead of O(N^2).
      const byId = new Map(report.flat.map(x => [x.id, x]));
      const matchedChapIds = new Set();
      for (const n of report.flat) {
        if (matchInfo.matchedIds.has(n.id)) {
          matchedChapIds.add(n.id);
          for (const aid of n.ancestorIds) {
            const anc = byId.get(aid);
            if (anc && anc.depth >= 1) matchedChapIds.add(aid);
          }
        }
      }
      for (const n of report.flat) {
        if (n.feature && (matchedChapIds.has(n.id) || n.ancestorIds.some(aid => matchedChapIds.has(aid)))) {
          selectedIds.add(n.id);
        }
      }
    } else {
      for (const n of report.flat) if (n.feature) selectedIds.add(n.id);
    }
  }

  const selection = resolveSelectionRanges(report.flat, selectedIds, { padEnd: opts.pad, numPages: report.numPages });

  if (opts.json) {
    console.log(JSON.stringify({
      fileName: report.fileName,
      numPages: report.numPages,
      source: report.source,
      suggestedRole: report.suggestedRole,
      matchedTerms: matchInfo.terms,
      customPages: selection.formatted,
      selectedPageCount: selection.pageCount,
      selectedSections: selection.selectedNodes.map(n => ({
        title: n.title,
        parentPath: n.parentPath,
        startPage: n.startPage,
        endPage: n.endPage,
        pageCount: n.pageCount,
        bookStart: n.bookStart,
        bookEnd: n.bookEnd,
        feature: n.feature,
      })),
      tocCount: report.flat.length,
      ...(opts.match ? {} : { toc: report.flat.filter(n => opts.all || n.depth < opts.depth) }),
    }, null, 2));
    return;
  }

  console.log(`Book:      ${report.fileName} (${report.numPages.toLocaleString()} PDF pages)`);
  console.log(`Step 01:   ${report.suggestedRole.badge} — ${report.suggestedRole.reason}`);
  console.log(`Bookmarks: ${report.flat.length ? report.flat.length + ' embedded TOC entries' : 'None found (open in Nursing Study Suite -> Knowledge Base -> Textbook TOC & section slicer for printed-TOC scan or manual page slicing)'}`);
  console.log('');

  if (!report.flat.length) return;

  if (opts.match || opts.features) {
    if (!selection.selectedNodes.length) {
      console.log(`No TOC headings matched "${opts.match}". Try broader chapter words or run without --match to browse.`);
      return;
    }
    const savedPct = Math.max(0, Math.round((1 - selection.pageCount / report.numPages) * 100));
    console.log(`Recommended Sections to Slice (${selection.selectedNodes.length}):`);
    for (const n of selection.selectedNodes) {
      const crumb = n.parentPath ? n.parentPath + ' > ' : '';
      const pdfSpan = n.startPage === n.endPage ? 'PDF p. ' + n.startPage : 'PDF pp. ' + n.startPage + '-' + n.endPage;
      const bookSpan = n.bookLabelDiffers ? ` (Book ${n.bookStart === n.bookEnd ? 'p. ' + n.bookStart : 'pp. ' + n.bookStart + '-' + n.bookEnd})` : '';
      console.log(`  * ${crumb}${n.title}${formatFeatureTag(n.feature)}`);
      console.log(`      ${pdfSpan}${bookSpan}  (${n.pageCount} pp.)`);
    }
    console.log('');
    console.log('================================================================');
    console.log(`Ctrl+P -> Save as PDF -> Pages (Custom):  ${selection.formatted}`);
    console.log(`Step 01 Page Slice (or paste directly):   ${selection.formatted}`);
    console.log(`Total Sliced Size: ${selection.pageCount} of ${report.numPages} PDF pages (${savedPct}% fewer pages${opts.pad ? ', +' + opts.pad + ' pad' : ''})`);
    console.log('================================================================');
  } else {
    const maxD = opts.all ? Infinity : opts.depth;
    const shown = report.flat.filter(n => n.depth < maxD);
    console.log(`Table of Contents (showing depth <= ${opts.all ? 'all' : opts.depth}; ${shown.length} of ${report.flat.length} entries):`);
    for (const n of shown) console.log(formatNodeLine(n));
    if (shown.length < report.flat.length) {
      console.log(`\n(${report.flat.length - shown.length} deeper sub-headings hidden — pass --all or --match "<topic>" to drill in.)`);
    }
  }
}

if (require.main === module) {
  try { main(); }
  catch (err) {
    console.error('Error: ' + (err && err.message ? err.message : String(err)));
    process.exit(1);
  }
}

module.exports = {
  MAX_PDF_FILE_BYTES,
  MAX_PDF_META_STREAM_BYTES,
  MAX_PDF_DEPTH,
  applyPdfPredictor,
  toAlphaLabel,
  parseCli,
  PdfReader,
  mergePageRanges,
  formatPageRanges,
  countPagesInRanges,
  parsePageRanges,
  detectConceptSortQBank,
  suggestTextbookRole,
  mergeConceptInput,
  inferUploadDropMeta,
  classifyTocFeature,
  buildTocTree,
  matchTocNodes,
  resolveSelectionRanges,
  inspectPdfTocBuffer,
  inspectPdfTocFile,
};
