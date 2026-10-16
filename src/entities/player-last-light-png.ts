/** Decode this export's non-interlaced RGBA8 data PNG without canvas alpha
 * premultiplication. Material alpha stores emission; alpha-zero RGB is data. */
export async function decodeLastLightDataPng(bytes: Uint8Array): Promise<{ width: number; height: number; data: Uint8Array }> {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (bytes.length < 33 || signature.some((value, index) => bytes[index] !== value)) throw new Error('Invalid player data PNG');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0, end = false;
  const compressed: Uint8Array<ArrayBuffer>[] = [];
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = view.getUint32(offset), start = offset + 8;
    if (length > bytes.length - offset - 12) throw new Error('Truncated player data PNG');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, start));
    if (type === 'IHDR') {
      width = view.getUint32(start); height = view.getUint32(start + 4);
      if (length !== 13 || bytes[start + 8] !== 8 || bytes[start + 9] !== 6 || bytes[start + 10] !== 0
        || bytes[start + 11] !== 0 || bytes[start + 12] !== 0 || width !== 832 || height !== 640)
        throw new Error('Player data PNG must be the exported non-interlaced RGBA8 atlas');
    } else if (type === 'IDAT') compressed.push(new Uint8Array(bytes.slice(start, start + length)));
    else if (type === 'IEND') { end = true; break; }
    offset += length + 12;
  }
  if (!width || !height || !end || !compressed.length) throw new Error('Incomplete player data PNG');
  const stream = new Blob(compressed).stream().pipeThrough(new DecompressionStream('deflate'));
  const raw = new Uint8Array(await new Response(stream).arrayBuffer()), stride = width * 4;
  if (raw.length !== (stride + 1) * height) throw new Error('Player data PNG scanline size mismatch');
  const output = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    if (filter > 4) throw new Error('Unknown player PNG filter');
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x, a = x >= 4 ? output[index - 4]! : 0;
      const b = y ? output[index - stride]! : 0, c = y && x >= 4 ? output[index - stride - 4]! : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >>> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      output[index] = (raw[y * (stride + 1) + 1 + x]! + predictor) & 255;
    }
  }
  return { width, height, data: output };
}
