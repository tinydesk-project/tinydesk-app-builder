"""Copy the TinyDesk files App Builder builds against into vendor/tinydesk.

    python tools/sync_tinydesk.py ../tinydesk          # copy, record the commit
    python tools/sync_tinydesk.py --check              # copies unchanged?
    python tools/sync_tinydesk.py --check ../tinydesk  # and equal to that checkout?

The Builder does not change these files; it pins them. vendor/tinydesk/
SOURCE.json names the TinyDesk commit they came from and their SHA-256, so
a test can tell when a copy was edited by hand or is older than a checkout.
Update them with this script when TinyDesk's tdui changes, then run the
tests (the tdui contract may have new requests or capabilities).
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
VENDOR = ROOT / 'vendor' / 'tinydesk'
# name in vendor/tinydesk -> path in the TinyDesk repository
FILES = {
    'tdui_contract.json': 'ports/common/python/tdui_contract.json',
    'tdui.py': 'ports/common/python/modules/tdui.py',
    'pyui.c': 'apps/pyui.c',
    'tdsh_ftp.c': 'third_party/tdsh/ports/esp_idf/components/tdsh/src/tdsh_ftp.c',
}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def git(repo, *args):
    return subprocess.run(['git', '-C', str(repo), *args], capture_output=True, text=True,
                          check=True).stdout.strip()


def sync(repo):
    VENDOR.mkdir(parents=True, exist_ok=True)
    files = {}
    for name, rel in FILES.items():
        data = (repo / rel).read_bytes().replace(b'\r\n', b'\n')
        (VENDOR / name).write_bytes(data)
        files[name] = {'from': rel, 'sha256': sha(data)}
    dirty = git(repo, 'status', '--porcelain', '--', *FILES.values())
    source = {
        'repository': 'https://github.com/tinydesk-project/tinydesk',
        'commit': git(repo, 'rev-parse', 'HEAD'),
        'describe': git(repo, 'describe', '--always', '--tags', '--dirty'),
        'modified': bool(dirty),
        'files': files,
    }
    (VENDOR / 'SOURCE.json').write_text(json.dumps(source, indent=2) + '\n', encoding='utf-8')
    print('vendor/tinydesk from %s%s' % (source['describe'], ' (with uncommitted changes)' if dirty else ''))


def check(repo):
    source = json.loads((VENDOR / 'SOURCE.json').read_text(encoding='utf-8'))
    problems = []
    for name, rel in FILES.items():
        data = (VENDOR / name).read_bytes().replace(b'\r\n', b'\n')
        if sha(data) != source['files'][name]['sha256']:
            problems.append('%s was changed here; run tools/sync_tinydesk.py instead' % name)
        if repo and (repo / rel).read_bytes().replace(b'\r\n', b'\n') != data:
            problems.append('%s differs from %s' % (name, repo / rel))
    for p in problems:
        print('sync_tinydesk:', p)
    if not problems:
        print('sync_tinydesk: vendor/tinydesk matches %s' % source['describe'])
    return 1 if problems else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('repo', nargs='?', type=Path, help='a TinyDesk checkout')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    if args.check:
        return check(args.repo)
    if not args.repo:
        parser.error('give the TinyDesk checkout to copy from')
    sync(args.repo.resolve())
    return 0


if __name__ == '__main__':
    sys.exit(main())
