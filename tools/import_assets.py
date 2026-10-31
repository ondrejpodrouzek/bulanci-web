#!/usr/bin/env python3
"""Build dist/assets from your own copy of bulanci.exe. The game's art, sound and texts are
not part of this repository; the EXE is only read, never run.

    pip install -r tools/requirements.txt
    python tools/import_assets.py path/to/bulanci.exe [output, default dist/assets]

For development only: players import their EXE in the browser (dist/import.html). Assets
written here land in dist/assets, are ignored by Git and must not be published.

Overlay: 'GZIP', u32 packed size, u32 0, then blocks that each hold 32 KiB of the archive,
as a zlib stream, or stored as is when zlib did not help. Archive: u32 count, u32 32, then
count records (u32 90, id, type, offset, 0, size) and the data; every entry starts with its u32
type, then size bytes. Resource numbers below are id - 65536.
"""
from pathlib import Path
import hashlib, io, json, struct, sys, wave, zlib
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from history_pages import decode_page

ROOT = Path(__file__).resolve().parent.parent
BLOCK = 0x8000
# SHA-256 of the v1.80 EXE this importer was verified against; another build only warns.
KNOWN_EXE = '2992cca12ec9ff452894045729ebf776a335e1dfcd9281260be6d8d9f6648e39'
BITMAPS = [19, 20, 21, 23, 24, 25, 26, 30, 31, 32, *range(34, 55), *range(67, 74), *range(75, 113),
           116, 117, 147, 148, *range(150, 165), 172, 12288, 12290, 12292, 12294]
JPEGS = {310: 'disco.jpg', 314: 'title.jpg', 315: 'menu.jpg', 313: 'original/menu-night.jpg',
         316: 'original/menu-start.jpg', 317: 'original/menu-history.jpg', 318: 'original/menu-exit.jpg'}
FILMS = (12289, 12291, 12293, 12295)
FILM_COLUMNS = 10


def section_table(exe):
    pe = struct.unpack_from('<I', exe, 0x3c)[0]
    count = struct.unpack_from('<H', exe, pe + 6)[0]
    table = pe + 24 + struct.unpack_from('<H', exe, pe + 20)[0]
    return [struct.unpack_from('<IIII', exe, table + i * 40 + 8) for i in range(count)]


def unpack_archive(exe):
    pos = max(raw + size for _, _, size, raw in section_table(exe))
    if exe[pos:pos + 4] != b'GZIP':
        raise SystemExit('Tohle není bulanci.exe: chybí datový archiv hry.')
    pos += 12
    out = bytearray()
    while pos < len(exe):
        z = zlib.decompressobj()
        try:
            part = z.decompress(exe[pos:pos + BLOCK + 2048])
            if not z.eof or len(part) != BLOCK and pos + BLOCK + 2048 < len(exe):
                raise zlib.error('not a whole block')
            pos += min(BLOCK + 2048, len(exe) - pos) - len(z.unused_data)
        except zlib.error:
            part = exe[pos:pos + BLOCK]
            pos += len(part)
        out += part
    count = struct.unpack_from('<I', out)[0]
    base = 8 + count * 24
    res = {}
    for i in range(count):
        _, ident, kind, offset, _, size = struct.unpack_from('<6I', out, 8 + i * 24)
        res[ident - 65536] = (kind, bytes(out[base + offset:base + offset + size + 4]))
    return res


def base_palette(exe):
    """Table at VA 0x4aeb20, BGRA (palette initialisation 0x413237)."""
    rva = 0xaeb20
    for virtual_size, va, size, raw in section_table(exe):
        if va <= rva < va + max(virtual_size, size):
            at = raw + rva - va
            return [tuple(exe[at + i * 4:at + i * 4 + 3][::-1]) for i in range(256)]
    raise SystemExit('Paleta v EXE nenalezena.')


def player_palette(base, rgb):
    """Channel interpolation of 0x413220: 112..126 highlights, 127 colour, 128..151 shadows."""
    palette = list(base)
    palette[127] = tuple(rgb)
    for i, k in enumerate(range(15, 0, -1), 112):
        palette[i] = tuple(c + (255 - c) * k // 15 for c in rgb)
    for i, k in enumerate(range(1, 25), 128):
        palette[i] = tuple(c - c * k // 24 for c in rgb)
    return palette


def decode_full(data):
    out = bytearray()
    i = 0
    while i < len(data):
        n = struct.unpack_from('<b', data, i)[0]
        i += 1
        if n >= 0:
            if n == 0:
                n = struct.unpack_from('<H', data, i)[0]
                i += 2
            out.extend([data[i]] * (n + 1))
            i += 1
        else:
            out.extend(data[i:i - n])
            i -= n
    return out


def decode_delta(data, previous):
    out = bytearray(previous)
    i = dest = 0
    while i < len(data):
        skip = data[i]
        i += 1
        if skip == 255:
            skip = struct.unpack_from('<H', data, i)[0]
            i += 2
        dest += skip
        n = struct.unpack_from('<b', data, i)[0]
        i += 1
        if n == 0:
            continue
        if n == -128:
            n = struct.unpack_from('<h', data, i)[0]
            i += 2
        if n >= 0:
            out[dest:dest + n + 1] = bytes([data[i]]) * (n + 1)
            i += 1
            dest += n + 1
        else:
            out[dest:dest - n] = data[i:i - n]
            i -= n
            dest -= n
    return out


def decode_palette(data, palette):
    palette = list(palette)
    i = dest = 0
    while i < len(data):
        dest += data[i]
        n = data[i + 1] + 1
        i += 2
        for _ in range(n):
            b, g, r = data[i:i + 3]
            i += 3
            palette[dest] = (r, g, b)
            dest += 1
    return palette


def decode_animation(data, base):
    """t52 frames: chunks 0/4 indices, 9 palette, 14/15 alpha plane (0x432d4f)."""
    key, w, h, mode, _, count = struct.unpack_from('<6I', data, 16)
    assert mode == 3
    pixels = bytearray([key if key < 256 else 0]) * (w * h)
    palette = list(base)
    alpha = None
    frames = []
    pos = 40
    for _ in range(count):
        length = struct.unpack_from('<I', data, pos)[0]
        at = pos + 5
        for _ in range(data[pos + 4]):
            size = struct.unpack_from('<I', data, at)[0]
            kind = data[at + 4]
            payload = data[at + 5:at + size]
            if kind == 0:
                pixels = decode_full(payload)
            elif kind == 4:
                pixels = decode_delta(payload, pixels)
            elif kind == 9:
                palette = decode_palette(payload, palette)
            elif kind == 14:
                alpha = decode_full(payload)
            elif kind == 15:
                alpha = decode_delta(payload, alpha)
            at += size
        frames.append((bytes(pixels), palette, bytes(alpha) if alpha else None))
        pos += length
    return w, h, key, frames


def atlas(animation, palette=None):
    w, h, key, frames = animation
    out = Image.new('RGBA', (w * len(frames), h))
    for f, (pixels, own, alpha) in enumerate(frames):
        pal = palette or own
        rgba = bytearray()
        for i, v in enumerate(pixels):
            rgba += bytes((*pal[v], 0 if v == key else alpha[i] if alpha else 255))
        out.paste(Image.frombytes('RGBA', (w, h), bytes(rgba)), (f * w, 0))
    return out


def decode_bitmap(d):
    """t28: mode 5 BGR24; modes 3/2/1/0 palette at 8/4/2/1 bpp, index key, optional alpha plane."""
    _, w, h, mode, stride, key = struct.unpack_from('<6I', d)
    if mode == 5:
        im = Image.frombytes('RGB', (w, h), d[30:], 'raw', 'BGR', stride, 1).convert('RGBA')
        if key != 0xffffffff:
            rgb = ((key >> 16) & 255, (key >> 8) & 255, key & 255)
            px = im.load()
            for y in range(h):
                for x in range(w):
                    if px[x, y][:3] == rgb:
                        px[x, y] = (*rgb, 0)
        return im
    count = struct.unpack_from('<I', d, 25)[0]
    pal = [tuple(d[30 + i * 4:33 + i * 4][::-1]) for i in range(count)]
    off = 30 + count * 4
    bpp = {3: 8, 2: 4, 1: 2, 0: 1}[mode]
    per = 8 // bpp
    alpha = off + stride * h if len(d) - off - stride * h else None
    rgba = bytearray()
    for y in range(h):
        for x in range(w):
            b = d[off + y * stride + x // per]
            v = (b >> (8 - bpp * (x % per + 1))) & ((1 << bpp) - 1)
            a = 0 if v == key else (d[alpha + y * w + x] if alpha else 255)
            rgba += bytes((*(pal[v] if v < count else (255, 0, 255)), a))
    return Image.frombytes('RGBA', (w, h), bytes(rgba))


def export_font(n, d, out):
    _, w, h, mode, stride, _ = struct.unpack_from('<6I', d)
    count = struct.unpack_from('<I', d, 25)[0]
    pal = [tuple(d[30 + i * 4:33 + i * 4][::-1]) for i in range(count)]
    off = 30 + count * 4
    bpp = {0: 1, 1: 2}[mode]
    per = 8 // bpp
    end = off + stride * h
    im = Image.new('RGBA', (w, h))
    px = im.load()
    for y in range(h):
        for x in range(w):
            v = (d[off + y * stride + x // per] >> (8 - bpp * (x % per + 1))) & ((1 << bpp) - 1)
            px[x, y] = (*pal[v], 0 if v == 0 else 255)
    im.save(out / f'{n}.png')
    line, cell = struct.unpack_from('<2I', d, end)
    glyphs = {}
    for code in range(256):
        x, gw, top, bottom = struct.unpack_from('<HBBB', d, end + 8 + code * 5)
        ch = bytes([code]).decode('cp1250', errors='ignore')
        if ch and (gw or code == 0x20):
            glyphs[ch] = [x, gw, top, bottom]
    meta = dict(resource=n, width=w, height=h, line=line, cell=cell, glyphs=glyphs)
    (out / f'{n}.json').write_text(json.dumps(meta, ensure_ascii=False), encoding='utf8')


def export_film(film, d, out):
    _, _, w, h, _, _, count, _ = struct.unpack_from('<8I', d)
    channels, bits = struct.unpack_from('<HH', d, 32)
    rate = struct.unpack_from('<I', d, 36)[0]
    pos, frames, pcm = 40, [], bytearray()
    while pos < len(d):
        n = struct.unpack_from('<I', d, pos)[0]
        chunk = d[pos + 4:pos + 4 + n]
        pos += 4 + n
        if chunk[:2] == b'\xff\xd8':
            frames.append(Image.open(io.BytesIO(chunk)).convert('RGB'))
        else:
            pcm += chunk
    sheet = Image.new('RGB', (FILM_COLUMNS * w, -(-count // FILM_COLUMNS) * h))
    for i, f in enumerate(frames):
        sheet.paste(f, ((i % FILM_COLUMNS) * w, (i // FILM_COLUMNS) * h))
    sheet.save(out / f'{film}-frames.jpg', quality=90)
    with wave.open(str(out / f'{film}.wav'), 'wb') as wv:
        wv.setnchannels(channels)
        wv.setsampwidth(bits // 8)
        wv.setframerate(rate)
        wv.writeframes(bytes(pcm))


def export_samples(res, out):
    """Banks t67 cut the PCM of a t43 into clips; the manifest is read by the audio catalogue."""
    manifest = {}
    for n, (kind, bank) in sorted(res.items()):
        if kind != 67:
            continue
        source = struct.unpack_from('<H', bank, 4)[0]
        count = struct.unpack_from('<I', bank, 12)[0]
        lengths = struct.unpack_from(f'<{count}I', bank, 16)
        data = res[source][1]
        channels, bits, rate = struct.unpack_from('<HHI', data, 8)
        pos = 16
        pcm = data[pos:]
        pos = 0
        for i, length in enumerate(lengths):
            name = f'{n}-{i}.wav'
            with wave.open(str(out / name), 'wb') as w:
                w.setnchannels(channels)
                w.setsampwidth(bits // 8)
                w.setframerate(rate)
                w.writeframes(pcm[pos:pos + length])
            manifest[name] = dict(bank=n, source=source, sample=i, byte_offset=pos, bytes=length,
                                  seconds=length / (channels * bits / 8 * rate))
            pos += length
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf8')


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    exe = Path(sys.argv[1]).read_bytes()
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'dist/assets'
    digest = hashlib.sha256(exe).hexdigest()
    if digest != KNOWN_EXE:
        print(f'Pozor: jiná verze EXE než ověřená ({digest}); pokračuji.')
    res = unpack_archive(exe)
    base = base_palette(exe)
    original = out / 'original'
    dirs = {name: original / name for name in ('sprites', 'ui', 'fonts', 'audio', 'music', 'history')}
    for d in dirs.values():
        d.mkdir(parents=True, exist_ok=True)
    metadata = json.loads((ROOT / 'dist/assets/original/sprites/manifest.json').read_text(encoding='utf8'))

    print('Bitmapy…', flush=True)
    index = {}
    for n, (kind, d) in sorted(res.items()):
        if kind == 28:
            im = decode_bitmap(d)
            im.save(dirs['ui'] / f'{n}.png')
            index[n] = dict(width=im.width, height=im.height, mode=struct.unpack_from('<I', d, 12)[0])
            if n in BITMAPS:
                im.save(original / f'{n}.png')
    (dirs['ui'] / 'index.json').write_text(json.dumps(index), encoding='utf8')
    # Bitmap 29 has no palette of its own: CBulPicture draws it through the player's (0x40b050).
    d = res[29][1]
    w, h, stride = *struct.unpack_from('<II', d, 4), struct.unpack_from('<I', d, 16)[0]
    for i, rgb in enumerate(metadata['original_player_colors']):
        pal = player_palette(base, rgb)
        rgba = bytearray()
        for y in range(h):
            for x in range(w):
                rgba += bytes((*pal[d[30 + y * stride + x]], 255))
        Image.frombytes('RGBA', (w, h), bytes(rgba)).save(dirs['ui'] / f'29-c{i}.png')
    for n, name in JPEGS.items():
        (out / name).write_bytes(res[n][1][4:])
    # Home-screen icons: the middle square of the title picture.
    title = Image.open(io.BytesIO(res[314][1][4:])).convert('RGB')
    side = min(title.size)
    square = title.crop(((title.width - side) // 2, (title.height - side) // 2,
                         (title.width + side) // 2, (title.height + side) // 2))
    for size in (180, 512):
        square.resize((size, size), Image.LANCZOS).save(out / f'icon-{size}.png')

    print('Sprity (pár minut)…', flush=True)
    variants = {name: rgb for name, rgb in metadata['player_color_variants'].items()}
    undead = metadata['undead_variant']
    wanted = {}
    for n in metadata['player_color_variant_resources']:
        wanted.setdefault(n, {}).update(variants)
    for n in metadata['original_color_variant_resources']:
        wanted.setdefault(n, {}).update({f'c{i}': c for i, c in enumerate(metadata['original_player_colors'])})
    for n in undead['resources']:
        wanted.setdefault(n, {})['undead'] = undead['rgb']
    sprites = dirs['sprites']
    for n in (n for n, (kind, _) in sorted(res.items()) if kind == 52):
        animation = decode_animation(res[n][1], base)
        atlas(animation).save(sprites / f'{n}-sheet.png')
        w, h, key, frames = animation
        atlas((w, h, key, frames[:1])).save(sprites / f'{n}.png')
        for name, rgb in wanted.get(n, {}).items():
            atlas(animation, player_palette(base, rgb)).save(sprites / f'{n}-{name}-sheet.png')
    (sprites / 'base-palette.json').write_text(json.dumps(base), encoding='utf8')

    print('Písma, zvuky, texty, filmy…', flush=True)
    for n in (174, 175, 176):
        export_font(n, res[n][1], dirs['fonts'])
    export_samples(res, dirs['audio'])
    for n, (kind, d) in res.items():
        if kind == 48:
            (dirs['music'] / f'{n}.mp3').write_bytes(d[20:])
    poems = [dict(resource=n, text=d[8:].decode('utf-16le')) for n, (kind, d) in sorted(res.items()) if kind == 2043]
    (original / 'poems.json').write_text(json.dumps(poems, ensure_ascii=False, indent=1), encoding='utf8')
    pages = [dict(resource=n, items=decode_page(res[n][1])) for n in (307, 308, 309)]
    (dirs['history'] / 'pages.json').write_text(json.dumps(pages, ensure_ascii=False, indent=1), encoding='utf8')
    for film in FILMS:
        export_film(film, res[film][1], dirs['history'])
    mark = 'Cílem projektu'.encode('utf-16le')
    start = exe.index(mark) - 8
    end = start
    while exe[end:end + 2] != b'\0\0':
        end += 2
    (original / 'exit-text.json').write_text(json.dumps(dict(text=exe[start:end].decode('utf-16le')), ensure_ascii=False), encoding='utf8')
    print('Hotovo:', out)


if __name__ == '__main__':
    main()
