"""Serve Studio with a real TinyDesk/MicroPython simulation on loopback."""
import argparse
import base64
import json
import re
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import secrets
import queue
import shutil
import subprocess
import tempfile
import threading
import time
from app_package import build as build_package, compile_source

ROOT = Path(__file__).resolve().parents[1]


class Simulation:
    def __init__(self, runtime, project_dirs=()):
        self.runtime = str(runtime.resolve())
        self.lock = threading.Lock()
        self.process = self.work = None
        self.offset = 0
        self.project_dirs = [Path(p).resolve() for p in project_dirs]
        self.session = None

    def stop(self):
        self.session = None
        if self.process:
            self.process.terminate()
            self.process.wait(timeout=5)
            self.process.stdin.close()
            self.process.stdout.close()
            self.process = None
        if self.work:
            self.work.cleanup()
            self.work = None

    def exchange(self, actions):
        if not self.process or self.process.poll() is not None:
            raise ValueError('Simulation stopped. Run it again.')
        self.process.stdin.write(('\n'.join(actions+['save=terminal.bin','cells=frame.bin','done'])+'\n').encode())
        self.process.stdin.flush()
        # The simulator keeps advancing timers while awaiting further input.
        # All actions are bounded and come from this helper, not shell text.
        deadline = time.monotonic()+15
        try:
            while self.lines.get(timeout=max(.01,deadline-time.monotonic())).strip()!=b'SIM_READY':
                if self.process.poll() is not None or time.monotonic()>deadline:
                    raise queue.Empty()
        except queue.Empty:
            self.stop()
            raise ValueError('Simulator timed out. Check for blocking Python handlers and rerun.')
        data = (Path(self.work.name)/'terminal.bin').read_bytes()
        if len(data)>64*1024*1024:
            self.stop()
            raise ValueError('Simulation output limit reached. Run again.')
        chunk, self.offset = data[self.offset:], len(data)
        frame=Path(self.work.name)/'frame.bin'
        if not frame.is_file():
            self.stop()
            raise ValueError('This tdsim build cannot capture native frames. Rebuild tdsim, then restart the helper.')
        return {'output':base64.b64encode(chunk).decode(),'frame':base64.b64encode(frame.read_bytes()).decode()}

    def start(self, body):
        self.stop()
        if body.get('protocol', 2) not in (2,3):
            raise ValueError('Reload App Builder to use the current simulation helper.')
        source, cols, rows = body['source'], int(body['cols']), int(body['rows'])
        if not isinstance(source,str) or len(source)>5_000_000 or not 20<=cols<=300 or not 5<=rows<=150:
            raise ValueError('Invalid simulation source or dimensions.')
        self.work = tempfile.TemporaryDirectory(prefix='tinydesk-studio-')
        root = Path(self.work.name)/'tinydesk_fs/root'
        root.mkdir(parents=True)
        for p in (ROOT/'examples').iterdir():
            if p.suffix in ('.py','.ppm','.pgm','.bmp','.tdfont'):
                shutil.copyfile(p,root/p.name)
        for directory in self.project_dirs:
            for p in directory.iterdir():
                if p.is_file() and p.suffix in ('.py','.mpy','.ppm','.pgm','.bmp','.tdfont'):
                    shutil.copyfile(p,root/p.name)
        for item in body.get('assets',[]):
            from app_package import safe_name
            name=safe_name(item['name'])
            if not item['data']:continue # extracted-package metadata is not a file
            data=base64.b64decode(item['data'],validate=True)
            if len(data)>4*1024*1024:raise ValueError('Simulation asset exceeds 4 MiB')
            (root/name).write_bytes(data)
        for item in body.get('binaries',[]):
            from app_package import safe_name
            name=safe_name(item['name'])
            if not item['data']:continue
            data=base64.b64decode(item['data'],validate=True)
            if not name.endswith('.mpy') or len(data)<4 or len(data)>2*1024*1024 or data[:2]!=b'M\x06':raise ValueError('Invalid compiled simulation dependency')
            (root/name).write_bytes(data)
        # Exported apps resolve resources relative to their entry file. Check
        # the same flat names before launch, rather than displaying a blank
        # app or a MicroPython image-load traceback after starting the terminal.
        from app_package import safe_name
        for path in body.get('paths', []):
            name=safe_name(path.rsplit('/', 1)[-1])
            if not (root/name).is_file() or not (root/name).stat().st_size:
                kind='font' if name.lower().endswith('.tdfont') else 'image'
                raise ValueError('Missing simulation '+kind+': '+name+'. Import it in App Builder or supply --project-dir PATH when starting the helper.')
        for module in body.get('modules', []):
            name=safe_name(module)
            if not any((root/(name+suffix)).is_file() for suffix in ('.py', '.mpy')):
                raise ValueError('Missing simulation module: '+name+'. Import its compiled dependency or supply --project-dir PATH.')
        (root/'studio_app.py').write_text(source,encoding='utf-8')
        self.offset = 0
        self.session=secrets.token_hex(16)
        self.process = subprocess.Popen([self.runtime,'size=%dx%d'%(cols,rows),
            'sixel=%dx%d'%((10,20) if cols==80 and rows==24 else (8,16)),
            'auth=off',
            'wait=500','key=Enter','wait=700','type=py -m 1024 /root/studio_app.py\\r',
            'wait=2500','interactive'],cwd=self.work.name,stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
        self.lines=queue.Queue()
        def read_output(process,lines):
            for line in iter(process.stdout.readline,b''):
                lines.put(line)
        threading.Thread(target=read_output,args=(self.process,self.lines),daemon=True).start()
        result=self.exchange([])
        result['session']=self.session
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    executable='tdsim.exe' if __import__('os').name=='nt' else 'tdsim'
    # A stale build/tdsim may predate interactive mode. Prefer the newest
    # available host build instead of silently selecting an older binary.
    choices=list((ROOT.parent/'tinydesk').glob('build*/'+executable))
    runtime=max(choices,key=lambda p:p.stat().st_mtime) if choices else Path(shutil.which('tdsim') or ROOT.parent/'tinydesk/build'/executable)
    parser.add_argument('--runtime',type=Path,default=runtime)
    parser.add_argument('--port',type=int,default=8773)
    parser.add_argument('--project-dir',type=Path,action='append',default=[],help='Local private dependencies; never included in Studio itself.')
    parser.add_argument('--compiler',type=Path,help='Matching native mpy-cross for binary app export.')
    args = parser.parse_args()
    if args.compiler is None:
        candidates=list((ROOT.parent/'tinydesk').glob('build*/compiler/mpy_cross/mpy-cross.exe'))
        candidate=max(candidates,key=lambda p:p.stat().st_mtime) if candidates else None
        found=shutil.which('mpy-cross')
        if found:args.compiler=Path(found)
        elif candidate is not None:args.compiler=candidate
    if not args.runtime.is_file():
        parser.error('Build TinyDesk tdsim first, or supply --runtime PATH.')
    token = secrets.token_urlsafe(32)
    sim = Simulation(args.runtime,args.project_dir)

    class Handler(SimpleHTTPRequestHandler):
        def log_message(self,format,*values):
            # Polls must not fill a redirected stderr pipe and stall HTTP.
            if not self.path.startswith('/simulation/'):
                super().log_message(format,*values)
        def __init__(self,*a,**kw):
            super().__init__(*a,directory=str(ROOT),**kw)

        def end_headers(self):
            self.send_header('Cache-Control','no-store')
            super().end_headers()

        def do_GET(self):
            if self.path.split('?')[0] in ('/','/index.html'):
                data = (ROOT/'index.html').read_text(encoding='utf-8').replace('<head>','<head><meta name="studio-simulation-token" content="'+token+'"><meta name="studio-simulation-protocol" content="3">').encode()
                self.send_response(200)
                self.send_header('Content-Type','text/html; charset=utf-8')
                self.send_header('Cache-Control','no-store')
                self.end_headers()
                self.wfile.write(data)
            else:
                super().do_GET()

        def do_POST(self):
            origin = self.headers.get('Origin')
            if self.headers.get('Host') not in ('127.0.0.1:'+str(args.port),'localhost:'+str(args.port)) or origin not in ('http://127.0.0.1:'+str(args.port),'http://localhost:'+str(args.port)) or not secrets.compare_digest(self.headers.get('X-Studio-Token',''),token):
                # Drain bounded request bodies so Windows does not reset the
                # socket with unread bytes before the 403 reaches the client.
                try:
                    n=int(self.headers.get('Content-Length','0'))
                    if 0<n<=6_000_000:self.rfile.read(n)
                except ValueError:pass
                self.send_error(403)
                return
            try:
                n = int(self.headers.get('Content-Length','0'))
                if not 0<n<=6_000_000:
                    raise ValueError('Invalid request size.')
                body = json.loads(self.rfile.read(n))
                with sim.lock:
                    if self.path in ('/simulation/input','/simulation/poll','/simulation/stop') and body.get('session')!=sim.session:
                        raise ValueError('This simulation session ended or was replaced. Run simulation again.')
                    if self.path=='/simulation/start': result=sim.start(body)
                    elif self.path=='/compiler/compile':
                        if args.compiler is None:raise ValueError('Start the helper with --compiler PATH_TO_MPY_CROSS.')
                        binary=compile_source(args.compiler,body['source'],body.get('filename','app.py'))
                        result={'binary':base64.b64encode(binary).decode()}
                    elif self.path=='/package/build':
                        if args.compiler is None:raise ValueError('Start the helper with --compiler PATH_TO_MPY_CROSS.')
                        assets={name:base64.b64decode(value,validate=True) for name,value in body.get('assets',{}).items() if value}
                        binaries={name:base64.b64decode(value,validate=True) for name,value in body.get('binaries',{}).items() if value}
                        modules={}
                        directories=[ROOT/'examples',ROOT.parent/'tinydesk/examples/python',*sim.project_dirs]
                        for asset in body.get('paths',[]):
                            name=Path(asset).name
                            if name in assets:continue
                            candidates=[folder/name for folder in directories if (folder/name).is_file()]
                            if not candidates:raise ValueError('Missing package asset: '+name+'. Import it in Studio or supply --project-dir.')
                            assets[name]=candidates[-1].read_bytes()
                        for name in body['project'].get('modules',[]):
                            from app_package import safe_name
                            safe_name(name)
                            if name+'.mpy' in binaries:continue
                            for directory in reversed(directories):
                                source=directory/(name+'.py');compiled=directory/(name+'.mpy')
                                if source.is_file():
                                    modules[source.name]=source.read_text(encoding='utf-8')
                                    break
                                if compiled.is_file():
                                    binaries[compiled.name]=compiled.read_bytes()
                                    break
                            else:raise ValueError('Missing application module '+name+'. Supply --project-dir.')
                        binary=build_package(args.compiler,body['project'],body['source'],assets,modules,binaries)
                        from app_package import deployment
                        filename=re.sub(r'[^a-zA-Z0-9_-]','_',body['project']['name'])+'.tdapp'
                        result={'binary':base64.b64encode(binary).decode(),'deployment':deployment(binary,filename)}
                    elif self.path=='/simulation/input':
                        value=body.get('data','')
                        if not isinstance(value,str) or len(value)>8192:
                            raise ValueError('Input too large.')
                        result=sim.exchange(['input='+value.encode().hex()])
                    elif self.path=='/simulation/poll': result=sim.exchange([])
                    elif self.path=='/simulation/stop': sim.stop();result={}
                    else: raise ValueError('Unknown operation.')
                data=json.dumps(result).encode()
                self.send_response(200)
            except Exception as e:
                data=json.dumps({'error':str(e)}).encode()
                self.send_response(400)
            self.send_header('Content-Type','application/json')
            self.end_headers()
            self.wfile.write(data)

    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print('TinyDesk App Builder + real runtime simulation: http://127.0.0.1:%d/'%args.port,flush=True)
    print('Runtime: '+str(args.runtime.resolve()),flush=True)
    try: server.serve_forever()
    finally: sim.stop();server.server_close()


if __name__=='__main__':
    main()
