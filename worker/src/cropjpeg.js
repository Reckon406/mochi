// Crop the Pollinations logo strip off the bottom of a JPEG (nologo is ignored on the classic free API).
import { decode, encode } from 'jpeg-js';

export const ART_W = 512;
export const ART_H = 640;
// Logo sits in the bottom-right ~24-32px; 40px leaves a little margin.
export const LOGO_STRIP = 40;

export function cropPollinationsLogo(buf, strip = LOGO_STRIP) {
  const src = buf instanceof ArrayBuffer ? new Uint8Array(buf) : new Uint8Array(buf);
  const img = decode(src, { useTArray: true });
  const w = img.width, h = img.height;
  const cut = Math.min(Math.max(0, strip | 0), Math.max(0, h - 16));
  if (!cut) return src;
  const nh = h - cut;
  const out = new Uint8Array(w * nh * 4);
  out.set(img.data.subarray(0, w * nh * 4));
  const enc = encode({ data: out, width: w, height: nh }, 90);
  return enc.data instanceof Uint8Array ? enc.data : new Uint8Array(enc.data);
}
