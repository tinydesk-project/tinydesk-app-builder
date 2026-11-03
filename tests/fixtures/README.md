# Test fixtures

Each current-format `.json` is the complete design for the corresponding canonical `.py` export. Node tests check that regeneration is identical. Python tests compile and run these bundled exports independently of Node.

- `example`: Device Monitor and its functional Refresh/Close handlers.
- `all_widgets`: every widget, all event signatures, both timer types, and quoted/backslash text.
- `two_pages`: page navigation, an All pages button, generated tabs, and two overlapping canvases.
- `fullscreen`: a 100×30 canvas on the 32,000-cell target.
- `six_page_hmi`: six 100×30 pictures with big numbers, sharing one paged canvas on the new API.
- `mixed_pages`: shared, unshared, All pages and hidden canvases, partial rectangle membership, and per-page mouse callbacks.
- `long_strings`: maximum-length identifiers, generated tabs, quoted page names, and split escaped/Unicode literals.
- `legacy.py`: the original single-line metadata format, preserved as an import compatibility fixture.

`tests/reference/tdui.py` is an unmodified copy of the new supplied `reference/tdui.py`. The verifier checks that these match and runs the same exports with both this module and the round-3 snapshot `tests/reference/tdui_0.2.0.py`.
