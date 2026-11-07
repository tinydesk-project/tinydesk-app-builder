"""Which TinyDesk simulator (tdsim) the tests run apps in.

TDSIM names one; otherwise the newest build*/tdsim of a TinyDesk checkout
beside App Builder (tinydesk-ux, then tinydesk). Generated apps import
TinyDesk's frozen tdapp library, so the simulator must be TinyDesk 0.3 or
later (or export with embedRuntime).
"""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def tdsim():
    if os.environ.get('TDSIM'):
        return Path(os.environ['TDSIM'])
    name = 'tdsim.exe' if os.name == 'nt' else 'tdsim'
    found = [p for repo in ('tinydesk-ux', 'tinydesk') for p in (ROOT.parent / repo).glob('build*/' + name)]
    if not found:
        raise SystemExit('Build TinyDesk tdsim first, or set TDSIM.')
    return max(found, key=lambda p: p.stat().st_mtime)
