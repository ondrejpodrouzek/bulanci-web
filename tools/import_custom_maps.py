"""Add-on levels (.eap) for the web, development import.

The EXE loads every *.eap beside it (string '@%s\\*.eap'). An .eap is the archive of the EXE overlay:
one resource file t94 (level name, author), t21 JPEGs (picture of the loading screen, ground), t48
music, t28 bitmaps and one t2026 level script. Ids start at 100000; the script names them directly.

Usage: import_custom_maps.py <folder with .eap files> [analysis folder]

Writes dist/assets/custom/NN/* (art, stays out of Git) and dist/assets/custom/maps.json (numbers,
kept in Git like assets/original/maps.json). The script is read, not run:
  create_bitmap / create_obstacle   layers and walls on layers 0 floor, 1 depth-sorted, 2 top
  native_63(obstacle, 1)            shots fly through
  native_31(object, z)              depth correction
  native_66(x, y)                   CMina (0x41cce0): centred on x, bottom edge y - 2
  native_64()                       the four Exitus undead (0x420550)
  native_65(colour, 1, speed, gun)  walker id 0x24.. (0x41f5d0); gun < 0 draws from 0x482918
  native_53(i, l, t, r, b, flags)   region; entry point 7 is "somebody came in", usually try_move
"""
import json, re, struct, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tools'))
from import_assets import decode_bitmap

MINE_H = 18
MINE_W = 31


def unpack(data, analysis):
    sys.path.insert(0, str(analysis))
    import extract_exe_archive as x
    x.overlay_offset = lambda _: 0
    return {i: (k, d) for i, k, d in x.entries(x.unpack(data))}


def const(n):
    v = n.get('value') if n.get('name') == 'const' else None
    return None if v is None else v - 0x100000000 if v >= 0x80000000 else v


def flatten(n):
    yield n
    for a in n.get('args', []):
        yield from flatten(a)


def build_block(script):
    return next(b for b in script['blocks'] if any(e.get('name') == 'set_background' for e in b['expressions']))


def targets_in(block_at, blocks, seen=None):
    """Destinations of try_move (function 0) reachable from a block, in order."""
    seen = seen if seen is not None else set()
    out = []
    if block_at in seen or block_at not in blocks:
        return out
    seen.add(block_at)
    for e in blocks[block_at]['expressions']:
        for n in flatten(e):
            if n.get('name') == 'call' and n.get('target') == 0:
                x, y = const(n['args'][1]), const(n['args'][2])
                if x is not None and y is not None and {'x': x, 'y': y} not in out:
                    out.append({'x': x, 'y': y})
            elif n.get('name') == 'call':
                for t in targets_in(n['target'], blocks, seen):
                    if t not in out:
                        out.append(t)
            elif n.get('name') == 'switch':
                for c in n['cases']:
                    for t in targets_in(c['target'], blocks, seen):
                        if t not in out:
                            out.append(t)
    return out


def region_targets(script, blocks, index):
    enter = next((b for b in script['blocks'] if b['at'] == script['entry_points'][7]), None)
    if not enter:
        return []
    for e in enter['expressions']:
        if e.get('name') == 'switch':
            for c in e['cases']:
                if c['value'] == index:
                    return targets_in(c['target'], blocks)
    return []


def convert(number, resources, decode, out):
    script_id, script_data = next((i, d) for i, (k, d) in resources.items() if k == 2026)
    path = out / 'script.bin'
    path.write_bytes(script_data)
    script = decode(_named(path, script_id))
    blocks = {b['at']: b for b in script['blocks']}
    build = build_block(script)
    info = next(d for k, d in resources.values() if k == 94)
    name_len = struct.unpack_from('<I', info, 8)[0]
    name = info[12:12 + name_len * 2].decode('utf-16le').lstrip('_').replace('_', ' ')
    author_at = 12 + name_len * 2
    author_len = struct.unpack_from('<I', info, author_at)[0]
    author = info[author_at + 4:author_at + 4 + author_len * 2].decode('utf-16le')

    def bitmap_src(res):
        n = res - 65536
        kind, data = resources[n]
        if kind == 21:
            file = f'{res}.jpg'
            (out / file).write_bytes(data[4:])
        else:
            file = f'{res}.png'
            decode_bitmap(data).save(out / file)
        return f'assets/custom/{number:02}/{file}'

    layers, obstacles, mines, walkers, regions = [], [], [], [], []
    undead, layer, picture, music = False, 0, None, None
    done = {}

    def place(node):
        nonlocal layer
        name_ = node.get('name')
        args = node.get('args', [])
        if name_ == 'create_obstacle':
            l, t, r, b = (const(a) for a in args)
            obstacles.append({'x': l, 'y': t, 'w': r - l, 'h': b - t})
        elif name_ == 'native_63':
            place(args[0])
            if const(args[1]):
                obstacles[-1]['solidForProjectiles'] = False
        elif name_ == 'create_bitmap':
            res = node['resource']
            src = done.setdefault(res, bitmap_src(res) if res >= 100000 else None)
            entry = {'x': const(args[0]), 'y': const(args[1]), 'fg': layer >= 1}
            if src:
                entry['src'] = src
            else:
                entry['resource'] = res - 65536
            if layer >= 2:
                entry['overlay'] = True
            layers.append(entry)
        elif name_ == 'native_31':
            place(args[0])
            layers[-1]['z'] = const(args[1])
        elif name_ == 'native_66':
            x, y = const(args[0]), const(args[1])
            mines.append({'x': x - MINE_W // 2, 'y': y - MINE_H - 2})
        else:
            raise ValueError(f'{name}: unknown object {name_}')

    for e in build['expressions']:
        n = e.get('name')
        if n == 'native_34':
            layer = const(e['args'][0])
        elif n == 'insert_scene':
            place(e['args'][0])
        elif n == 'set_background':
            picture = bitmap_src(e['resource'])
        elif n == 'set_audio':
            res = e['resources'][0]
            (out / 'music.mp3').write_bytes(resources[res - 65536][1][20:])
            music = f'assets/custom/{number:02}/music.mp3'
        elif n == 'native_64':
            undead = True
        elif n == 'native_65':
            c, _, speed, gun = (const(a) for a in e['args'])
            walkers.append({'colorIndex': c, 'speed': speed, 'weapon': gun})
        elif n == 'native_53':
            i, l, t, r, b, flags = (const(a) for a in e['args'])
            regions.append({'x': l, 'y': t, 'w': r - l, 'h': b - t, 'flags': flags,
                            'targets': region_targets(script, blocks, i)})
    return {'name': name, 'author': author, 'custom': True, 'source_resource': 1000 + number, 'picture': picture,
            'music': music, 'undead': undead, 'layers': layers, 'obstacles': obstacles, 'animations': [],
            'mines': mines, 'walkers': walkers, 'regions': regions}


def _named(path, script_id):
    named = path.with_name(f'{script_id}_script.bin')
    path.replace(named)
    return named


def main(folder, analysis=None):
    analysis = Path(analysis) if analysis else ROOT.parent.parent / 'analysis'
    sys.path.insert(0, str(analysis))
    from decode_level_specials import decode
    base = ROOT / 'dist/assets/custom'
    maps = {}
    for number, file in enumerate(sorted(Path(folder).glob('*.eap')), 1):
        out = base / f'{number:02}'
        out.mkdir(parents=True, exist_ok=True)
        resources = unpack(file.read_bytes(), analysis)
        entry = convert(number, resources, decode, out)
        for leftover in out.glob('*_script.bin'):
            leftover.unlink()
        maps[f'custom{number:02}'] = entry
        print(file.name, '->', entry['name'], f"{len(entry['layers'])} vrstev, {len(entry['obstacles'])} překážek, "
              f"{len(entry['mines'])} min, {len(entry['walkers'])} chodců, {len(entry['regions'])} regionů, "
              f"undead {entry['undead']}")
    (base / 'maps.json').write_text(json.dumps(maps, ensure_ascii=False, indent=1), encoding='utf8')


if __name__ == '__main__':
    main(*sys.argv[1:])
