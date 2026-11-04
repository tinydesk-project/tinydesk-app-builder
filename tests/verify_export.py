"""Compile exports and exercise the real tdui.py through a scripted board transport."""
import importlib.util
import json
from pathlib import Path
import py_compile
import sys
import tempfile
import types
from collections import deque

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
FIXTURES = ROOT / 'tests' / 'fixtures'
SOURCE = ROOT / 'vendor/tinydesk/tdui.py'   # the pinned firmware (tools/sync_tinydesk.py)
OLD_SOURCE = ROOT / 'tests/reference/tdui_0.2.0.py'

# Expectations come from the supplied C table, independently of core.js.
import re
FONT = {m[0]: re.findall(r'"([.#]+)"', m[1]) for m in re.findall(
    r"\{'(.)', \{((?:\"[.#]+\"(?:, )?){5})\}\}",
    (ROOT / 'vendor/tinydesk/pyui.c').read_text())}
assert len(FONT) == 44


def big_rows(text, scale=1, width=0):
    chars = list(text[:64])
    if width:
        chars = [' '] * max(0, width-len(chars)) + chars[-width:]
    if not chars:
        return []
    pixels = [[] for _ in range(5 * scale)]
    for index, char in enumerate(chars):
        glyph = FONT.get(char.upper(), FONT['?'])
        for y, row in enumerate(pixels):
            for pixel in glyph[y // scale]:
                row.extend([pixel == '#'] * scale)
            if index < len(chars)-1:
                row.extend([False] * scale)
    return [''.join(' ▀▄█'[int(top) + 2*int(y+1 < len(pixels) and pixels[y+1][x])]
                    for x, top in enumerate(pixels[y])) for y in range(0, len(pixels), 2)]


def design_cells(obj):
    cells = [(' ', obj['fg'], obj['bg'])] * (obj['w'] * obj['h'])
    def put(x, y, text, fg, bg):
        for i, ch in enumerate(text):
            cells[y * obj['w'] + x + i] = (ch, fg, bg)
    for p in obj['paint']:
        if p['op'] == 'put':
            put(p['x'], p['y'], p['text'], p['fg'], p['bg'])
        elif p['op'] == 'big':
            for y, row in enumerate(big_rows(p['text'], p['scale'], p['width'])):
                put(p['x'], p['y'] + y, row, p['fg'], p['bg'])
        else:
            for y in range(p['y'], p['y']+p['h']):
                put(p['x'], y, p['ch']*p['w'], p['fg'], p['bg'])
    return cells


# CPython lacks micropython.const and time.ticks_*; these compatibility adapters
# leave every tdui class, event dispatcher, timer and request method untouched.
compat = types.ModuleType('micropython')
compat.const = lambda n: n
sys.modules['micropython'] = compat
import time
clock = {'now': 0}
time.ticks_ms = lambda: clock['now']
time.ticks_add = lambda a, b: a + b
time.ticks_diff = lambda a, b: a - b


class Board:
    def __init__(self, max_cells):
        self.requests = []
        self.events = deque()
        self.canvases = {}
        self.max_cells = max_cells
        module = types.ModuleType('_tdui')
        module.MAX_CELLS = max_cells
        module.MAX_PIXELS = 16384 if max_cells == 2000 else 2097152
        module.open = lambda: None
        module.send = self.send
        module.recv = lambda ms=0: self.events.popleft() if self.events else None
        sys.modules['_tdui'] = module

    def send(self, *r):
        r = tuple(r) + (0,) * max(0, 10-len(r)) + ((None,) if len(r) < 11 else ())
        self.requests.append(r)
        op, ident, win, kind, a, b, c, d, e, f, text = r
        if text is not None:
            assert len(text.encode('utf-8') if isinstance(text, str) else text) <= 1024, 'request text exceeds the transport limit'
        if op == 3 and kind == 7:
            pages = max(1, e)
            self.canvases[ident] = {'win': win, 'x': a, 'y': b, 'w': c, 'h': d,
                                   'draw': 0, 'show': 0,
                                   'pictures': [[(' ', -1, -1)] * (c*d) for _ in range(pages)]}
            assert sum(cv['w']*cv['h']*len(cv['pictures']) for cv in self.canvases.values()) <= self.max_cells
        elif ident in self.canvases:
            cv = self.canvases[ident]
            cells = cv['pictures'][cv['draw']]
            def put(x, y, text, fg, bg):
                for i, ch in enumerate(text):
                    if 0 <= x+i < cv['w'] and 0 <= y < cv['h']:
                        cells[y * cv['w'] + x+i] = (ch, fg, bg)
            if op == 17:
                cv['x'], cv['y'] = a, b
            elif op == 19:
                if a != -1:
                    assert 0 <= a < len(cv['pictures'])
                    cv['draw'] = a
                if b != -1:
                    assert 0 <= b < len(cv['pictures'])
                    cv['show'] = b
            elif op == 20:
                cv['pictures'][b] = cv['pictures'][a].copy()
            elif op == 16:
                pictures = []
                for old in cv['pictures']:
                    new = [(' ', -1, -1)] * (a*b)
                    for y in range(min(b, cv['h'])):
                        for x in range(min(a, cv['w'])):
                            new[y*a+x] = old[y*cv['w']+x]
                    pictures.append(new)
                cv.update(w=a, h=b, pictures=pictures)
            elif op == 12:
                for y in range(max(0, b), min(b+d, cv['h'])):
                    for x in range(max(0, a), min(a+c, cv['w'])):
                        cells[y * cv['w'] + x] = (text, e, f)
            elif op == 11:
                put(a, b, text, c, d)
            elif op == 21:
                for y, row in enumerate(big_rows(text, e, f)):
                    put(a, b+y, row, c, d)

    def pixel(self, win, x, y):
        result = (' ', -1, -1)
        # Reproduce the C canvas drawing order, including the fact that blank,
        # hidden canvas cells would cover earlier canvases if not moved away.
        for cv in self.canvases.values():
            if cv['win'] == win and cv['x'] <= x < cv['x'] + cv['w'] and cv['y'] <= y < cv['y'] + cv['h']:
                result = cv['pictures'][cv['show']][(y - cv['y']) * cv['w'] + x - cv['x']]
        return result


def load(name, max_cells=None):
    design = json.loads((FIXTURES / (name + '.json')).read_text(encoding='utf-8'))
    source = (FIXTURES / (name + '.py')).read_text(encoding='utf-8')
    board = Board(design['board'] if max_cells is None else max_cells)
    clock['now'] = 0
    spec = importlib.util.spec_from_file_location('tdui', SOURCE)
    api = importlib.util.module_from_spec(spec)
    sys.modules['tdui'] = api
    spec.loader.exec_module(api)
    calls = []
    api.run = lambda: calls.append(True)
    scope = {}
    exec(compile(source, name + '.py', 'exec'), scope)
    assert calls == [True], 'export must invoke tdui.run() once'
    executable = source.split('\n# tdui-editor design ')[0].rstrip()
    assert executable.endswith('tdui.run()')
    assert board.max_cells == design['board']
    return design, api, board, scope


def dispatch(api, board, op, obj, a=0, b=0, c=0, d=0, text=None):
    board.events.append((op, obj.id, a, b, c, d, text))
    api.poll(0)
    assert not board.events, 'the real poll() must consume the scripted event'


def paint_requests(board, ident):
    return [r for r in board.requests if r[1] == ident and r[0] in (11, 12)]


def groups(win):
    result = []
    for obj in win['widgets']:
        if obj['type'] != 'canvas':
            continue
        match = next((g for g in result if obj['page'] is not None and g[0]['page'] is not None
                      and all(obj[k] == g[0][k] for k in ('x','y','w','h'))
                      and not any(o['page'] == obj['page'] for o in g)), None)
        if match is None:
            result.append([obj])
        else:
            match.append(obj)
    return result


def check_paint(design, board, scope):
    for win in design['windows']:
        for group in groups(win):
            for page, obj in enumerate(group):
                cv = board.canvases[scope[obj['name']].id]
                if scope['_TD_PAGES']:
                    assert cv['pictures'][page] == design_cells(obj), obj['name']
                elif obj['visible'] and obj['page'] in (None, win['initialPage']):
                    assert cv['pictures'][0] == design_cells(obj), obj['name']


def check_hidden_canvases(design, board, scope, page):
    for win in design['windows']:
        for group in groups(win):
            active = any(o['visible'] and o['page'] in (None, page) for o in group)
            for obj in group:
                if scope['_TD_PAGES'] and active:
                    continue
                if not scope['_TD_PAGES'] and obj['visible'] and obj['page'] in (None, page):
                    continue
                cv = board.canvases[scope[obj['name']].id]
                assert (cv['x'], cv['y']) == (1000, 1000), obj['name']
                if not scope['_TD_PAGES']:
                    assert all(ch == ' ' for ch, fg, bg in cv['pictures'][0]), obj['name']


def switch(design, board, scope, page):
    start = len(board.requests)
    scope['show_page'](page)
    sent = board.requests[start:]
    if scope['_TD_PAGES']:
        assert not any(r[0] in (11,12,21) for r in sent), 'cached pages must not repaint'
        win = design['windows'][0]
        ident = next(p['id'] for p in win['pages'] if p['name'] == page)
        shared = [g for g in groups(win) if len(g)>1 and any(o['visible'] and o['page']==ident for o in g)]
        assert len([r for r in sent if r[0]==19]) == len(shared), sent
        for group in shared:
            assert len([r for r in sent if r[0]==19 and r[1]==scope[group[0]['name']].id]) == 1
    else:
        assert not any(r[0] in (19,20,21) for r in sent)
    win = design['windows'][0]
    ident = next(p['id'] for p in win['pages'] if p['name'] == page)
    check_hidden_canvases(design, board, scope, ident)
    for obj in win['widgets']:
        if obj['type']=='canvas' and obj['visible'] and obj['page'] in (None,ident):
            cv=board.canvases[scope[obj['name']].id]
            assert cv['pictures'][cv['show']] == design_cells(obj), obj['name']

def verify():
    output = ROOT / '.test-output'
    output.mkdir(exist_ok=True)
    try:
        with tempfile.TemporaryDirectory(prefix='python-', dir=str(output)) as temp:
            Path(temp).resolve().relative_to(ROOT.resolve())
            for file in FIXTURES.glob('*.py'):
                py_compile.compile(str(file), cfile=str(Path(temp) / (file.stem + '.pyc')), doraise=True)
    finally:
        try:
            output.rmdir()  # Remove only an empty output folder; retain unrelated artifacts.
        except OSError:
            pass

    design, api, board, s = load('example')
    check_paint(design, board, s)
    dispatch(api, board, api._EV_CLICK, s['refresh'])
    assert s['memory'].value == 70
    assert s['load_label'].text == 'Memory usage   70%'
    assert s['footnote'].text == 'Updated successfully.'
    dispatch(api, board, api._EV_CLICK, s['close_button'])
    assert not s['win'].is_open

    design, api, board, s = load('all_widgets')
    check_paint(design, board, s)
    assert s['device_name'].text == 'Quotes: "hello" \\ path'
    seen = set()
    for win in design['windows']:
        for o in [win] + win['widgets']:
            for event in o['events']:
                if event == 'on_close' or o['name'] == 'close_button':
                    continue
                obj = s[o['name']]
                if event in ('on_click', 'on_enter', 'on_activate'):
                    dispatch(api, board, api._EV_CLICK, obj, a=1)
                elif event in ('on_change', 'on_select'):
                    dispatch(api, board, api._EV_CHANGE, obj, a=1, text='changed text')
                elif event == 'on_mouse':
                    dispatch(api, board, api._EV_MOUSE, obj, a=2, b=1, c=1, d=0)
                elif event == 'on_key':
                    dispatch(api, board, api._EV_KEY, obj, a=ord('a'))
                elif event == 'on_resize':
                    dispatch(api, board, api._EV_RESIZE, obj, a=62, b=19)
                else:
                    raise AssertionError('Unhandled fixture event: ' + event)
                seen.add(event)
                if o['name'] == 'refresh':
                    assert s['memory'].value == 70
                else:
                    assert s['footnote'].text == event + ' fired', event
    assert seen == {'on_click', 'on_enter', 'on_activate', 'on_change', 'on_select', 'on_mouse', 'on_key', 'on_resize'}
    assert s['device_name'].text == 'changed text'
    assert s['devices'].selected == 1
    clock['now'] = 250
    api.poll(0)
    assert s['footnote'].text == 'once fired'
    assert len(api._timers) == 1
    before = s['memory'].value
    for now in (1000, 2000):
        clock['now'] = now
        api.poll(0)
    assert s['memory'].value == before + 2, 'every() must fire repeatedly'
    dispatch(api, board, api._EV_CLOSE, s['win'])
    assert s['footnote'].text == 'on_close fired'

    design, api, board, s = load('two_pages')
    check_paint(design, board, s)
    check_hidden_canvases(design, board, s, 'main')
    assert s['main_label'].visible and not s['settings_label'].visible
    assert s['next_page'].visible
    assert board.pixel(s['win'].id, 3, 4) == ('M', 115, 234)
    dispatch(api, board, api._EV_CLICK, s['_td_tab_win_1'])
    check_hidden_canvases(design, board, s, 'settings')
    assert not s['main_label'].visible and s['settings_label'].visible
    assert board.pixel(s['win'].id, 3, 4) == ('S', 214, 234)
    s['show_page']('Main')
    check_hidden_canvases(design, board, s, 'main')
    assert board.pixel(s['win'].id, 3, 4) == ('M', 115, 234), 'later hidden canvas must not cover Main'
    dispatch(api, board, api._EV_CLICK, s['next_page'])
    check_hidden_canvases(design, board, s, 'settings')
    assert s['settings_label'].visible and board.pixel(s['win'].id, 3, 4)[0] == 'S'
    dispatch(api, board, api._EV_CLICK, s['_td_tab_win_0'])
    check_hidden_canvases(design, board, s, 'main')
    assert s['main_label'].visible and board.pixel(s['win'].id, 3, 4)[0] == 'M'
    try:
        s['show_page']('missing')
        raise AssertionError('unknown pages must be refused')
    except ValueError:
        pass

    design, api, board, s = load('fullscreen')
    assert api.MAX_CELLS == 32000 and api._cells == 3000
    check_paint(design, board, s)
    assert board.pixel(s['win'].id, 1, 1)[0] == 'F'
    try:
        load('fullscreen', max_cells=2000)
        raise AssertionError('older firmware should be refused before creating the design')
    except OSError as exc:
        assert 'Design needs 3000 canvas cells' in str(exc)
    for fixture in ('six_page_hmi', 'mixed_pages'):
        design, api, board, s = load(fixture)
        check_paint(design, board, s)
        for page in design['windows'][0]['pages'] * 2:
            switch(design, board, s, page['name'])
        if fixture == 'mixed_pages':
            switch(design, board, s, 'Main')
            dispatch(api, board, api._EV_MOUSE, s['main_canvas'])
            assert s['main_label'].text == 'mouse 0'
            switch(design, board, s, 'Settings')
            dispatch(api, board, api._EV_MOUSE, s['settings_canvas'])
            assert s['main_label'].text == 'mouse 1'
    design, api, board, s = load('two_pages')
    main, settings = s['main_canvas'], s['settings_canvas']
    target = s['canvas_page'](main, 'Settings')
    target.put(0,0,'DYNAMIC',81,234)
    if s['_TD_PAGES']:
        assert main is settings is target
        cv = board.canvases[main.id]
        assert cv['show']==0 and cv['draw']==1
        assert cv['pictures'][0][0][0]=='.', 'hidden drawing must leave shown picture alone'
        s['show_page']('Settings')
        assert cv['draw']==cv['show']==1
        assert board.pixel(s['win'].id,2,3)==('D',81,234), 'dynamic edits must survive switching'
        settings.copy_page(1,0)
        assert cv['pictures'][0]==cv['pictures'][1]
        settings.draw_to(0)
        settings.put(0,0,'X',81,234)
        assert cv['pictures'][0][0][0]=='X' and cv['pictures'][1][0][0]=='D', 'copy must be independent'
        old = [picture.copy() for picture in cv['pictures']]
        settings.resize(22,4)
        for page in range(2):
            for y in range(3):
                assert cv['pictures'][page][y*22:y*22+20]==old[page][y*20:y*20+20]
        assert api.big_size('12:30',2)==(34,5)
    else:
        assert main is not settings and target is settings
        s['show_page']('Settings')
        assert board.pixel(s['win'].id,2,3)[0]=='.', 'legacy fallback repaints the static design'
    try:
        s['canvas_page'](main,'missing')
        raise AssertionError('unknown canvas page must fail')
    except ValueError:
        pass


if __name__ == '__main__':
    verify()
    SOURCE = OLD_SOURCE
    verify()
    print('PASS: %d exports compile; new and 0.2.0 APIs, events, timers, cached pages, big text, copy and resize verified.' % len(list(FIXTURES.glob('*.py'))))
