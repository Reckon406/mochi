#!/usr/bin/env python3
"""Turn Corey's AI-generated source textures (ai-tex-src/*.jpg) into Mochi's tiered texture set in public/tex/ai/.
tileables: seam-fixed (best cross-fade band per axis), low-frequency lighting flattened, + derived normal + roughness.
  <name>_c_{512,1024,2048}.webp  colour      <name>_n_{...}.webp  normal (GL, +Y up)      <name>_r_{256,512,1024}.webp  roughness
sign_board: interior crop -> sign_board_{1024}.webp.  mountain_backdrop: mirrored to wrap, sky -> alpha -> mountains_{2048,2560,4096}.webp
Usage: python3 tools/aitex.py   (needs numpy + Pillow)"""
import numpy as np, os, sys
from PIL import Image, ImageFilter
SRC = os.path.join(os.path.dirname(__file__), '..', 'ai-tex-src'); OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'tex', 'ai')
os.makedirs(OUT, exist_ok=True)
# name: (normal strength, base roughness, flatten amount)
TILE = {'riverbank_ground': (3.5, 0.92, 0.6), 'hut_thatch': (5.0, 0.95, 0.6), 'hut_logwall': (3.0, 0.82, 0.5), 'cabin_boards': (2.5, 0.8, 0.6), 'roof_shingles': (4.0, 0.88, 0.5),
        'deck_planks': (3.0, 0.84, 0.6), 'fence_wood': (4.0, 0.9, 0.5)}

def blur(a, r):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)) if a.ndim == 2 else Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255

def seam_axis(a, axis):
    n = a.shape[axis]; best = None
    for b in range(int(n * 0.06), int(n * 0.16), 4):  # pick the cross-fade band whose two ends already look most alike
        x0 = np.take(a, range(n - b, n), axis=axis); x1 = np.take(a, range(0, b), axis=axis); d = np.abs(x0 - x1).mean()
        if best is None or d < best[0]: best = (d, b)
    b = best[1]; t = np.linspace(0, 1, b, dtype=np.float32); t = t * t * (3 - 2 * t)
    sh = [1] * a.ndim; sh[axis] = b; t = t.reshape(sh)
    head = np.take(a, range(n - b, n), axis=axis) * (1 - t) + np.take(a, range(0, b), axis=axis) * t
    rest = np.take(a, range(b, n - b), axis=axis)
    return np.concatenate([head, rest], axis=axis), b, best[0]

def save(arr, path, size, q, mode='RGB', sharpen=False):
    im = Image.fromarray(np.clip(arr * 255 + 0.5, 0, 255).astype(np.uint8), mode if arr.ndim == 3 else 'L')
    w, h = size if isinstance(size, tuple) else (size, size)
    if im.size != (w, h): im = im.resize((w, h), Image.LANCZOS)
    if sharpen: im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=60, threshold=2))
    im.save(path, 'WEBP', quality=q, method=6); return os.path.getsize(path)

def tileable(name, strength, rough0, flat):
    a = np.asarray(Image.open(f'{SRC}/{name}.jpg').convert('RGB')).astype(np.float32) / 255
    # flatten big lighting gradients (keeps local detail)
    lo = blur(a, a.shape[0] / 8); mean = a.reshape(-1, 3).mean(0); a = np.clip(a * (1 - flat) + a / np.maximum(lo, 0.03) * mean * flat, 0, 1)
    a, bx, dx = seam_axis(a, 1); a, by, dy = seam_axis(a, 0)
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((1024, 1024), Image.LANCZOS)).astype(np.float32) / 255
    lum = a @ np.array([0.299, 0.587, 0.114], np.float32)
    # height = high-passed luminance (dark grooves = low); wrap-around gradient so the normal map tiles too
    hgt = lum - blur(lum, 24) * 0.85; hgt = blur(hgt * 0.5 + 0.5, 1.0) * 2 - 1
    gx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5; gy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5
    nx, ny, nz = -gx * strength, gy * strength, np.ones_like(gx); ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    nrm = np.stack([nx / ln, ny / ln, nz / ln], -1) * 0.5 + 0.5
    rough = np.clip(rough0 + (0.5 - (lum - blur(lum, 16) + 0.5)) * 0.5, 0.35, 1.0)
    sz = {}
    for s in (512, 1024, 2048):
        sz[f'c{s}'] = save(a, f'{OUT}/{name}_c_{s}.webp', s, 82, sharpen=s > 1024)
        sz[f'n{s}'] = save(nrm, f'{OUT}/{name}_n_{s}.webp', s, 88, sharpen=False)
        sz[f'r{s // 2}'] = save(rough, f'{OUT}/{name}_r_{s // 2}.webp', s // 2, 70)
    print(name, f'seam band x={bx}px (diff {dx:.3f}) y={by}px (diff {dy:.3f})', {k: f'{v / 1024:.0f}K' for k, v in sz.items()})

def sign_board():
    im = Image.open(f'{SRC}/sign_board.jpg').convert('RGB'); w, h = im.size
    inner = im.crop((int(w * 0.075), int(h * 0.12), int(w * 0.925), int(h * 0.88)))  # inside the routed frame; Mochi draws its own bevel/burn
    print('sign_board', save(np.asarray(inner).astype(np.float32) / 255, f'{OUT}/sign_board_1024.webp', (1024, 512), 84) // 1024, 'K')

def mountains():
    a = np.asarray(Image.open(f'{SRC}/mountain_backdrop.jpg').convert('RGB')).astype(np.float32) / 255; H, W, _ = a.shape
    # sky mask: per column, the sky is the smooth run from the top; it ends at the first strong edge (ridge line)
    lum = blur(a @ np.array([0.299, 0.587, 0.114], np.float32), 0.8)
    edge = np.maximum(np.abs(np.roll(lum, -1, 0) - lum), np.abs(np.roll(lum, -1, 1) - lum)); edge[-1] = 1; edge[:, -1] = edge[:, -2]
    alpha = np.ones((H, W), np.float32); tops = np.zeros(W, int)
    for x in range(W):
        e = edge[:, x] > 0.018; y = 2
        while y < H - 2 and not (e[y] and e[y + 1]): y += 1
        tops[x] = y
    tops = np.minimum(tops, np.convolve(np.pad(tops, 2, mode='edge'), np.ones(5) / 5, 'valid').astype(int) + 2)  # kill 1-px spikes
    for x in range(W): alpha[:tops[x], x] = 0
    alpha = blur(alpha, 1.0); alpha = np.clip((alpha - 0.2) / 0.6, 0, 1)
    rgba = np.concatenate([a, alpha[..., None]], -1)
    strip, b, d = seam_axis(rgba, 1)  # cross-fade the two ends so the strip wraps (no mirror symmetry)
    print('mountains wrap band', b, 'px diff', round(float(d), 3), 'tops', int(tops.min()), int(tops.max()))
    h0 = strip.shape[0]; w0 = strip.shape[1]
    for (w, sh) in ((2048, False), (2560, False), (4096, True)):
        h = round(w * h0 / w0 / 8) * 8
        im = Image.fromarray(np.clip(strip * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA').resize((w, h), Image.LANCZOS)
        if sh: im = im.filter(ImageFilter.UnsharpMask(radius=1.6, percent=50, threshold=2))
        p = f'{OUT}/mountains_{w}.webp'; im.save(p, 'WEBP', quality=80, method=6); print('mountains', w, 'x', h, os.path.getsize(p) // 1024, 'K')

def sky_alpha(a, thr=0.018):
    H, W, _ = a.shape; lum = blur(a @ np.array([0.299, 0.587, 0.114], np.float32), 0.8)
    edge = np.maximum(np.abs(np.roll(lum, -1, 0) - lum), np.abs(np.roll(lum, -1, 1) - lum)); edge[-1] = 1; edge[:, -1] = edge[:, -2]
    tops = np.zeros(W, int)
    for x in range(W):
        e = edge[:, x] > thr; y = 2
        while y < H - 2 and not (e[y] and e[y + 1]): y += 1
        tops[x] = y
    pad = np.pad(tops, 6, mode='edge'); med = np.array([np.median(pad[i:i + 13]) for i in range(W)]).astype(int)  # drop specks/spikes in the sky
    tops = np.where(np.abs(tops - med) > 6, med, tops)
    alpha = (np.arange(H)[:, None] >= tops[None, :]).astype(np.float32)
    alpha = np.clip((blur(alpha, 1.0) - 0.2) / 0.6, 0, 1); return alpha, tops

def grade(a, contrast=1.18, sat=1.15, gamma=1.06):
    m = a.reshape(-1, 3).mean(0); a = np.clip((a - m) * contrast + m, 0, 1); l = (a @ np.array([0.299, 0.587, 0.114], np.float32))[..., None]
    return np.clip(l + (a - l) * sat, 0, 1) ** gamma

def ring():
    """360° Bitterroot/Sapphire backdrop: west half = old backdrop | mtn_west_b (Trapper, WSW) | mtn_west_a | flipped old; east = Sapphires.
    Strip x = bearing clockwise from north. Exported as 6 arcs of 60°: ring_<k>_<w>.webp (k=0 starts at north)."""
    WT, HT, BASE = 12288, 592, 548  # ~0.95 m per px on the 1850 m ring (High); BASE = valley-floor row (~5 m)
    acc = np.zeros((HT, WT, 4), np.float32); wsum = np.zeros((HT, WT, 1), np.float32)
    def seg(name, b0, b1, peak_m, flip=False, thr=0.018):
        a = np.asarray(Image.open(f'{SRC}/{name}.jpg').convert('RGB')).astype(np.float32) / 255
        al, tops = sky_alpha(a, thr); top = int(np.percentile(tops, 2)); a = grade(a)
        rgba = np.concatenate([a, al[..., None]], -1)[max(0, top - 6):]
        if flip: rgba = rgba[:, ::-1]
        hpx = int(peak_m / 0.946); wpx = int((b1 - b0) / 360 * WT)
        im = Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA').resize((wpx, hpx), Image.LANCZOS); r = np.asarray(im).astype(np.float32) / 255
        y0 = BASE - hpx; x0 = int(b0 / 360 * WT); F = int(10 / 360 * WT)  # 10° cross-fade at each end
        w = np.ones(wpx, np.float32); ramp = np.linspace(0, 1, F); w[:F] = np.minimum(w[:F], ramp); w[-F:] = np.minimum(w[-F:], ramp[::-1])
        xs = (np.arange(wpx) + x0) % WT; yy = slice(max(0, y0), BASE); ry = slice(max(0, -y0), hpx)
        pm = r[ry].copy(); pm[..., :3] *= pm[..., 3:]; acc[yy, xs] += pm * w[None, :, None]; wsum[yy, xs] += w[None, :, None]
        # under the base: continue the bottom rows (dark valley/forest) down to the ring floor, fading
        bot = r[-1:].repeat(HT - BASE, 0); fade = np.linspace(1, 0.2, HT - BASE)[:, None, None]; bot = bot.copy(); bot[..., 3:] *= fade
        bot[..., :3] *= bot[..., 3:]; acc[BASE:, xs] += bot * w[None, :, None]; wsum[BASE:, xs] += w[None, :, None]
        print('  ring seg', name, 'flip' if flip else '', f'{b0}-{b1}°', 'peak', peak_m, 'm')
    seg('mountain_backdrop', 178, 236, 300)
    seg('mtn_west_b', 222, 276, 380)
    seg('mtn_west_a', 264, 322, 360)
    seg('mountain_backdrop', 308, 364, 280, flip=True)
    seg('mtn_east', 350, 448, 170, thr=0.012)          # 350°..88° (wraps)
    seg('mtn_east', 76, 192, 150, flip=True, thr=0.012)
    out = np.empty_like(acc); out[..., :3] = acc[..., :3] / np.maximum(acc[..., 3:], 1e-4); out[..., 3:] = acc[..., 3:] / np.maximum(wsum, 1.0)  # premultiplied blend; partial cover fades
    for k in range(6):
        sl = out[:, k * WT // 6:(k + 1) * WT // 6]; im = Image.fromarray(np.clip(sl * 255 + 0.5, 0, 255).astype(np.uint8), 'RGBA')
        for w in (1024, 2048):
            p = f'{OUT}/ring_{k}_{w}.webp'; im.resize((w, round(HT * w / 2048)), Image.LANCZOS).save(p, 'WEBP', quality=82, method=6)
    tot = {w: sum(os.path.getsize(f'{OUT}/ring_{k}_{w}.webp') for k in range(6)) // 1024 for w in (1024, 2048)}
    print('ring arcs', tot, 'K'); prev = Image.fromarray(np.clip(out * 255, 0, 255).astype(np.uint8), 'RGBA'); bg = Image.new('RGBA', prev.size, (120, 160, 220, 255)); bg.alpha_composite(prev); bg.convert('RGB').resize((2048, 99)).save('/tmp/ring_preview.png')

only = sys.argv[1:]
for k, v in TILE.items():
    if not only or k in only: tileable(k, *v)
if not only or 'sign_board' in only: sign_board()
if 'mountains' in only: mountains()
if not only or 'ring' in only: ring()
