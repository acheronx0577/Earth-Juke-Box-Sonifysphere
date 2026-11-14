/**
 * Minimal GRIB2 decoder for ONE message packed with Data Representation Template 5.3
 * (complex packing + spatial differencing), which is how NOAA GFS pgrb2 files pack 10 m U/V.
 * Follows WMO FM 92 GRIB Edition 2, Code Table 5.0 / Template 5.3 / Template 7.3, and the reference
 * unpacking in NCEP g2clib (comunpack.c). Also supports Template 5.0 (simple packing).
 * No bitmap support (GFS 10 m wind has none; a bitmap throws).
 */

class BitReader {
  private bit = 0;
  constructor(private readonly bytes: Uint8Array, private pos: number) {}
  read(nbits: number): number {
    let value = 0;
    for (let i = 0; i < nbits; i += 1) {
      const byte = this.bytes[this.pos + (this.bit >> 3)];
      const b = (byte >> (7 - (this.bit & 7))) & 1;
      value = value * 2 + b;
      this.bit += 1;
    }
    return value;
  }
  align(): void {
    this.bit = (this.bit + 7) & ~7;
  }
  get bytePos(): number {
    return this.pos + (this.bit >> 3);
  }
}

const u16 = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
/** GRIB2 signed integers are sign-magnitude. */
const s16 = (b: Uint8Array, o: number) => {
  const v = u16(b, o);
  return v & 0x8000 ? -(v & 0x7fff) : v;
};
function sN(b: Uint8Array, o: number, n: number): number {
  let v = 0;
  for (let i = 0; i < n; i += 1) v = v * 256 + b[o + i];
  const signBit = 2 ** (8 * n - 1);
  return v >= signBit ? -(v - signBit) : v;
}
const f32 = (b: Uint8Array, o: number) => new DataView(b.buffer, b.byteOffset + o, 4).getFloat32(0, false);

export interface Grib2Field {
  readonly ni: number;
  readonly nj: number;
  readonly values: Float32Array;
}

export function decodeGrib2(message: Uint8Array): Grib2Field {
  if (String.fromCharCode(...message.subarray(0, 4)) !== "GRIB" || message[7] !== 2) throw new Error("not a GRIB2 message");
  let offset = 16;
  let ni = 0;
  let nj = 0;
  let sec5: { template: number; o: number; npts: number } | null = null;
  let sec7 = -1;
  while (offset < message.length - 4) {
    if (message[offset] === 0x37 && message[offset + 1] === 0x37 && message[offset + 2] === 0x37 && message[offset + 3] === 0x37) break;
    const length = u32(message, offset);
    const num = message[offset + 4];
    if (num === 3) {
      const template = u16(message, offset + 12);
      if (template !== 0) throw new Error(`grid template ${template} not supported`);
      ni = u32(message, offset + 30);
      nj = u32(message, offset + 34);
    } else if (num === 5) {
      sec5 = { template: u16(message, offset + 9), o: offset, npts: u32(message, offset + 5) };
    } else if (num === 6) {
      if (message[offset + 5] !== 255) throw new Error("bitmaps not supported");
    } else if (num === 7) {
      sec7 = offset;
    }
    offset += length;
  }
  if (!sec5 || sec7 < 0) throw new Error("incomplete GRIB2 message");
  const s = sec5.o;
  const R = f32(message, s + 11);
  const E = s16(message, s + 15);
  const D = s16(message, s + 17);
  const nbits = message[s + 19];
  const scaleE = 2 ** E;
  const scaleD = 10 ** -D;
  const npts = sec5.npts;
  const out = new Float32Array(npts);
  const data = sec7 + 5;

  if (sec5.template === 0) {
    const reader = new BitReader(message, data);
    for (let i = 0; i < npts; i += 1) out[i] = (R + (nbits ? reader.read(nbits) : 0) * scaleE) * scaleD;
    return { ni, nj, values: out };
  }
  if (sec5.template !== 3 && sec5.template !== 2) throw new Error(`data template 5.${sec5.template} not supported`);

  const missingMgmt = message[s + 22];
  if (missingMgmt !== 0) throw new Error("missing-value management not supported");
  const ng = u32(message, s + 31);
  const widthRef = message[s + 35];
  const widthBits = message[s + 36];
  const lenRef = u32(message, s + 37);
  const lenInc = message[s + 41];
  const lastLen = u32(message, s + 42);
  const lenBits = message[s + 46];
  const order = sec5.template === 3 ? message[s + 47] : 0;
  const nDesc = sec5.template === 3 ? message[s + 48] : 0;

  let pos = data;
  let ival1 = 0;
  let ival2 = 0;
  let minsd = 0;
  if (order > 0) {
    ival1 = sN(message, pos, nDesc);
    pos += nDesc;
    if (order === 2) {
      ival2 = sN(message, pos, nDesc);
      pos += nDesc;
    }
    minsd = sN(message, pos, nDesc);
    pos += nDesc;
  }
  const reader = new BitReader(message, pos);
  const refs = new Array<number>(ng);
  for (let g = 0; g < ng; g += 1) refs[g] = reader.read(nbits);
  reader.align();
  const widths = new Array<number>(ng);
  for (let g = 0; g < ng; g += 1) widths[g] = widthRef + reader.read(widthBits);
  reader.align();
  const lens = new Array<number>(ng);
  for (let g = 0; g < ng; g += 1) lens[g] = lenRef + reader.read(lenBits) * lenInc;
  lens[ng - 1] = lastLen;
  reader.align();

  const ifld = new Float64Array(npts);
  let n = 0;
  for (let g = 0; g < ng; g += 1) {
    const w = widths[g];
    for (let k = 0; k < lens[g] && n < npts; k += 1) ifld[n++] = refs[g] + (w ? reader.read(w) : 0);
  }
  if (order === 1) {
    ifld[0] = ival1;
    for (let i = 1; i < npts; i += 1) ifld[i] = ifld[i] + minsd + ifld[i - 1];
  } else if (order === 2) {
    ifld[0] = ival1;
    ifld[1] = ival2;
    for (let i = 2; i < npts; i += 1) ifld[i] = ifld[i] + minsd + 2 * ifld[i - 1] - ifld[i - 2];
  }
  for (let i = 0; i < npts; i += 1) out[i] = (R + ifld[i] * scaleE) * scaleD;
  return { ni, nj, values: out };
}
