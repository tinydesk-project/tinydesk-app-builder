"""TDAPP v1: MicroPython bootstrap + checked files + JSON manifest + footer.

The bootstrap is ordinary bytecode; TinyDesk's py command loads .tdapp in
the same way as .mpy. The footer permits Studio to recover JSON and assets
without executing untrusted application code.
"""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import tempfile

FOOTER=b'TDAPP001'
MAX_SIZE=16*1024*1024
MAX_FILES=128
BOOTSTRAP=r'''
import os, sys, json, hashlib, binascii
import tdui

def _tdapp_run():
    path = __file__
    def digest(data):
        return binascii.hexlify(hashlib.sha256(data).digest()).decode()
    def number(data):
        return sum(data[i] << (i*8) for i in range(4))
    with open(path,'rb') as f:
        f.seek(0,2)
        size=f.tell()
        if size<16 or size>16777216:
            raise ValueError('Invalid TDAPP size')
        f.seek(size-16)
        tail=f.read(16)
        offset,length=number(tail[8:12]),number(tail[12:16])
        if tail[:8]!=b'TDAPP001' or length>262144 or offset+length!=size-16:
            raise ValueError('Invalid TDAPP footer')
        f.seek(offset)
        raw=f.read(length)
        manifest=json.loads(raw)
        if manifest['format']!=1 or manifest['runtime']['api']!=1:
            raise ValueError('Unsupported TDAPP contract')
        if getattr(sys.implementation,'_mpy',0)&255 != 6:
            raise ValueError('TDAPP needs MicroPython bytecode v6')
        native=manifest['runtime'].get('native')
        if native:
            actual=getattr(sys.implementation,'_mpy',0)
            if ((actual>>10)&0x2f)!=native['id'] or ((actual>>8)&3)!=3:
                raise ValueError('TDAPP needs native '+native['arch']+' / MPY 6.3; export portable bytecode for another target')
        for feature in manifest['runtime']['features']:
            if not hasattr(tdui.Canvas,feature):
                raise ValueError('Firmware missing Canvas.'+feature)
        for capability in manifest['runtime'].get('capabilities',[]):
            if capability!='gradient_fills' or not getattr(tdui,'SUPPORTS_GRADIENT_FILLS',False):
                raise ValueError('Firmware missing capability: '+capability)
        files=manifest['files']
        if not 1<=len(files)<=128:
            raise ValueError('Invalid TDAPP file count')
        names=[]
        for item in files:
            name=item['path']
            if not name or '/' in name or '\\' in name or ':' in name or name in ('.','..') or name in names:
                raise ValueError('Unsafe TDAPP entry')
            names.append(name)
            if item['offset']<0 or item['size']<0 or item['offset']+item['size']>offset:
                raise ValueError('Invalid TDAPP entry size')
            f.seek(item['offset'])
            check=hashlib.sha256()
            remaining=item['size']
            while remaining:
                block=f.read(min(1024,remaining))
                if not block:
                    raise ValueError('Truncated TDAPP')
                check.update(block)
                remaining-=len(block)
            if binascii.hexlify(check.digest()).decode()!=item['sha256']:
                raise ValueError('TDAPP checksum mismatch: '+name)
        folder=path.rsplit('/',1)[0]+'/.tdapp-'+digest(raw)[:16]
        try:
            os.mkdir(folder)
        except OSError:
            pass
        # Verify before touching files; use a revision-specific cache.
        for item in files:
            valid=False
            try:
                with open(folder+'/'+item['path'],'rb') as cached:
                    check=hashlib.sha256()
                    count=0
                    while True:
                        block=cached.read(1024)
                        if not block:break
                        count+=len(block)
                        check.update(block)
                    valid=count==item['size'] and binascii.hexlify(check.digest()).decode()==item['sha256']
            except OSError:
                pass
            if valid:
                continue
            f.seek(item['offset'])
            with open(folder+'/'+item['path'],'wb') as target:
                remaining=item['size']
                while remaining:
                    block=f.read(min(1024,remaining))
                    target.write(block)
                    remaining-=len(block)
    sys.path.insert(0,folder)
    os.chdir(folder)
    del manifest, files, raw, names
    import gc
    gc.collect()
    __import__('_tdapp_main')

_tdapp_run()
'''


def safe_name(name):
    if not isinstance(name,str) or not name or len(name.encode('utf-8'))>64 or name in ('.','..') or any(c in name for c in '/\\:\0'):
        raise ValueError('Unsafe package entry name')
    return name


NATIVE_ARCHES={'xtensawin':10,'rv32imc':11}


def mpy_arch(data):
    if len(data)<4 or data[:2]!=b'M\x06':
        raise ValueError('Expected MicroPython v6 .mpy')
    arch=(data[2]>>2)&0x2f
    if arch and (arch not in NATIVE_ARCHES.values() or data[2]&3!=3 or data[2]&0x40):
        raise ValueError('Unsupported native .mpy architecture, ABI or architecture flags')
    if not arch and data[2]!=0:
        raise ValueError('Unsupported bytecode feature flags')
    return arch


def compile_source(compiler,source,source_name='app.py',compilation=None):
    if compilation is not None and not isinstance(compilation,dict):
        raise ValueError('Invalid compilation target')
    mode=(compilation or {}).get('mode','bytecode')
    arch=(compilation or {}).get('arch','')
    if mode not in ('bytecode','native') or mode=='native' and (not isinstance(arch,str) or arch not in NATIVE_ARCHES):
        raise ValueError('Choose portable bytecode or a supported native target')
    with tempfile.TemporaryDirectory(prefix='tdapp-compile-') as work:
        src=Path(work)/'app.py';dst=Path(work)/'app.mpy'
        src.write_text(source,encoding='utf-8')
        flags=['-march='+arch,'-X','emit=native'] if mode=='native' else []
        result=subprocess.run([str(compiler),*flags,'-s',source_name,'-o',str(dst),str(src)],capture_output=True,timeout=30)
        if result.returncode:
            raise ValueError(result.stderr.decode(errors='replace') or 'Compilation failed')
        data=dst.read_bytes()
        actual=mpy_arch(data)
        if actual and actual!=NATIVE_ARCHES.get(arch):
            raise ValueError('Compiler emitted the wrong native target')
        return data


def build(compiler,project,source,assets=None,modules=None,binaries=None):
    project=json.loads(json.dumps(project))
    if project.get('version')!=1:
        raise ValueError('Unsupported project schema')
    # Artwork travels as checked files. Avoid storing another base64 copy
    # in project.json and its extracted cache on small flash partitions.
    for resource in project.get('assets',[]):
        if resource.get('name') in (assets or {}):resource['data']=''
    for resource in project.get('binaryDependencies',[]):
        name=resource.get('name')
        if name in (binaries or {}) or (name and name[:-4]+'.py' in (modules or {})):
            resource['data']=''
    files={'project.json':json.dumps(project,ensure_ascii=False,separators=(',',':')).encode(),
           '_tdapp_main.mpy':compile_source(compiler,source,compilation=project.get('compilation'))}
    for name,data in (assets or {}).items():
        name=safe_name(name)
        if name in files:raise ValueError('Duplicate package entry')
        files[name]=bytes(data)
    for name,code in (modules or {}).items():
        name=safe_name(name)
        if not name.endswith('.py'):raise ValueError('Module source must end in .py')
        name=name[:-3]+'.mpy'
        if name in files:raise ValueError('Duplicate package entry')
        files[name]=compile_source(compiler,code,name[:-4]+'.py')
    for name,data in (binaries or {}).items():
        name=safe_name(name);data=bytes(data)
        if not name.endswith('.mpy') or name in files:
            raise ValueError('Invalid or duplicate compiled dependency')
        mpy_arch(data)
        files[name]=data
    native={mpy_arch(data) for name,data in files.items() if name.endswith('.mpy')}-{0}
    if len(native)>1:
        raise ValueError('All native modules in a package must target the same CPU architecture')
    if len(files)>MAX_FILES:raise ValueError('Too many package files')
    startup=project.get('startup',{})
    if startup:
        if startup.get('mode') not in ('status','custom') or type(startup.get('durationMs')) is not int or not 0<=startup['durationMs']<=600000:
            raise ValueError('Invalid startup configuration')
        if startup.get('image') and safe_name(startup['image']) not in files:
            raise ValueError('Startup artwork is missing from this package')
    out=bytearray(compile_source(compiler,BOOTSTRAP,'tdapp_boot.py'))
    operations={p['op'] for w in project.get('windows',[]) for o in w.get('widgets',[]) for p in o.get('paint',[])}
    features=[]
    if operations&{'font_text'} or any(p.get('font') for w in project.get('windows',[]) for o in w.get('widgets',[]) for p in o.get('paint',[])):features.append('font_text')
    if operations-{'put','fill','big'}:features.append('bar')
    if operations&{'picture','button'}:features.append('picture')
    manifest={'format':1,'studio':project.get('provenance',{}).get('lastEditedWith','unknown'),
              'application':{'name':project['name'],**project.get('application',{})},
              'projectSchema':1,'runtime':{'api':1,'mpy':'6.3','features':features},'files':[]}
    if native:
        arch=native.pop()
        manifest['runtime']['native']={'arch':next(k for k,v in NATIVE_ARCHES.items() if v==arch),'id':arch,'requiresRoot':True}
    if any(p.get('gradient') for w in project.get('windows',[]) for o in w.get('widgets',[]) for p in o.get('paint',[])):
        manifest['runtime']['capabilities']=['gradient_fills']
    if startup:manifest['startup']=startup
    for name,data in files.items():
        manifest['files'].append({'path':name,'offset':len(out),'size':len(data),'sha256':hashlib.sha256(data).hexdigest()})
        out.extend(data)
    offset=len(out)
    data=json.dumps(manifest,separators=(',',':'),ensure_ascii=False).encode()
    out.extend(data);out.extend(FOOTER+struct.pack('<II',offset,len(data)))
    if len(out)>MAX_SIZE:raise ValueError('Package exceeds 16 MiB')
    return bytes(out)


def deployment(data,filename):
    """Commands refer to the exact revision verified by the TDAPP bootstrap."""
    safe_name(filename)
    if not filename.endswith('.tdapp') or not all(c.isalnum() or c in '._-' for c in filename):
        raise ValueError('Use a simple .tdapp filename for deployment')
    manifest,_,_=inspect(data)
    offset,size=struct.unpack('<II',data[-8:])
    cache='/root/.tdapp-'+hashlib.sha256(data[offset:offset+size]).hexdigest()[:16]
    startup=manifest.get('startup',{})
    custom=startup.get('mode')=='custom'
    image=startup.get('image','') if custom else ''
    lines=['# Upload '+filename+' to /root with Board files (or FTP).',
           '# Test this exact package before enabling kiosk:',
           'py /root/'+filename,
           '# Close the app or use the technician exit before continuing.',
           '# Edit /etc/board.conf and set these keys:',
           'kiosk.app = /root/'+filename,
           'kiosk.status = '+('0' if custom else '1'),
           'kiosk.splash = '+(cache+'/'+image if image else ''),
           '# Save the file, then run: reboot',
           '# Re-exporting changes the cache revision: regenerate these settings.',
           '# Keep your existing console, UART and network settings.']
    return '\n'.join(lines)+'\n'


def inspect(data):
    if not 16<=len(data)<=MAX_SIZE or data[-16:-8]!=FOOTER:
        raise ValueError('Invalid TDAPP file')
    offset,size=struct.unpack('<II',data[-8:])
    if size>262144 or offset+size!=len(data)-16:
        raise ValueError('Invalid TDAPP manifest')
    manifest=json.loads(data[offset:offset+size])
    if manifest.get('format')!=1 or not 1<=len(manifest.get('files',[]))<=MAX_FILES:
        raise ValueError('Unsupported TDAPP manifest')
    files={}
    for item in manifest['files']:
        name=safe_name(item['path']);start=item['offset'];size=item['size']
        if name in files or not isinstance(start,int) or not isinstance(size,int) or start<0 or size<0 or start+size>offset:
            raise ValueError('Invalid TDAPP entry')
        payload=data[start:start+size]
        if hashlib.sha256(payload).hexdigest()!=item['sha256']:
            raise ValueError('TDAPP checksum mismatch')
        files[name]=payload
    project=json.loads(files['project.json'])
    if project.get('version')!=1:raise ValueError('Unsupported project schema')
    return manifest,project,files
