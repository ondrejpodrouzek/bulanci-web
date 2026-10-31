"""Decode the Historie pages (t2050) of CHistoryDlg, a CDSScript program for a page VM.

Expression grammar of the level VM plus the page opcodes 0x2d..0x34 (table 0x4af7ac):
  0x2d label(x, y, text, align) + u32 font        0x2e textbox(x, y, w, h, text, a) + u32 font, b
  0x2f bitmap(x, y) + u32 resource                0x30 colors(obj, n:byte, n colours)
  0x31 (a, b) -> a                                0x32 set_byte(obj, v)
  0x33 insert(obj)                                0x34 object(x, y) + u32 resource, a, b
"""
from pathlib import Path
import json, struct

HANDLERS = json.loads((Path(__file__).resolve().parent / 'level-vm-handlers.json').read_text())
ARITY = {int(op): h['arity_first_return'] for op, h in HANDLERS.items()}
ARITY.update({0x49: 5, 0x53: 6})
NAMES = {0: 'const', 0x11: 'return'}


class PageParser:
    def __init__(self, data, pos):
        self.d = data
        self.p = pos

    def byte(self):
        v = self.d[self.p]
        self.p += 1
        return v

    def u32(self):
        v = struct.unpack_from('<I', self.d, self.p)[0]
        self.p += 4
        return v

    def expr(self, depth=0):
        assert depth < 150
        at = self.p
        op = self.byte()
        n = {'at': at, 'opcode': op, 'name': NAMES.get(op, f'native_{op:02x}')}
        e = lambda: self.expr(depth + 1)
        if op == 0x2d:
            n.update(name='label', args=[e(), e(), e(), e()], font=self.u32() - 65536)
        elif op == 0x2e:
            n.update(name='textbox', args=[e() for _ in range(6)], font=self.u32() - 65536)
            n['args'].append(e())
        elif op == 0x2f:
            n.update(name='bitmap', args=[e(), e()], resource=self.u32() - 65536)
        elif op == 0x30:
            n.update(name='colors', args=[e()])
            n['args'] += [e() for _ in range(self.byte())]
        elif op == 0x31:
            n.update(name='pair', args=[e(), e()])
        elif op == 0x32:
            n.update(name='set_byte', args=[e(), e()])
        elif op == 0x33:
            n.update(name='insert', args=[e()])
        elif op == 0x34:
            n.update(name='object', args=[e(), e()], resource=self.u32() - 65536)
            n['args'] += [e(), e()]
        elif op == 0:
            n['value'] = self.u32()
        elif op == 27:
            n['name'] = 'string'
            start = self.p
            while self.d[self.p:self.p + 2] != b'\0\0':
                self.p += 2
            n['value'] = self.d[start:self.p].decode('utf-16le')
            self.p += 2
        elif op in ARITY:
            n['args'] = [e() for _ in range(ARITY[op])]
        else:
            raise ValueError(f'Unknown opcode {op:02x} at {at:x}')
        return n


def value(n):
    if n['name'] == 'const':
        v = n['value']
        return v - (1 << 32) if v >= 1 << 31 else v
    if n['name'] == 'string':
        return n['value']
    raise ValueError(n['name'])


def element(n):
    """Flatten insert(colors(set_byte(...(widget)))) into one dict."""
    out = {}
    while True:
        if n['name'] == 'insert':
            n = n['args'][0]
        elif n['name'] == 'colors':
            out['colors'] = [value(a) for a in n['args'][1:]]
            n = n['args'][0]
        elif n['name'] == 'set_byte':
            out['byte'] = value(n['args'][1])
            n = n['args'][0]
        elif n['name'] == 'pair':
            out['pair'] = value(n['args'][1])
            n = n['args'][0]
        else:
            break
    out['kind'] = n['name']
    out['args'] = [value(a) for a in n.get('args', [])]
    for k in ('font', 'resource'):
        if k in n:
            out[k] = n[k]
    return out


def decode_page(raw):
    _, size, _, _ = struct.unpack_from('<4I', raw)
    code = raw[16:16 + size]
    p = PageParser(code, struct.unpack_from('<I', raw, 16 + size)[0])
    p.byte()  # locals
    items = []
    while p.p < len(code):
        n = p.expr()
        if n['name'] == 'return':
            break
        items.append(element(n))
    return items
