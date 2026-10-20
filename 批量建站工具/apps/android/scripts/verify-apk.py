"""Inspect a built APK without installing it or touching device/user data."""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('apk', type=Path)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
application = Path(__file__).resolve().parents[3]
report = {'schema': 1, 'apk': str(args.apk.resolve()), 'bytes': args.apk.stat().st_size,
          'sha256': hashlib.sha256(args.apk.read_bytes()).hexdigest(), 'checks': [], 'elf': [], 'ok': False}

def check(condition, name):
    report['checks'].append({'name': name, 'passed': bool(condition)})
    if not condition:
        raise AssertionError(name)

try:
    with zipfile.ZipFile(args.apk) as apk:
        names = set(apk.namelist())
        check(any(b'Lcom/sitefoundry/workbench/RuntimeInstallation;' in apk.read(name)
                  for name in names if name.endswith('.dex')), 'Upgrade-safe Kotlin runtime installer is packaged')
        public_prefix = 'assets/public/'
        for relative in ['index.html', 'game-builder/index.html', 'node_modules/jszip/dist/jszip.min.js',
                         'js/vendor/libarchive/libarchive.js', 'js/vendor/libarchive/worker-bundle.js',
                         'js/vendor/libarchive/libarchive.wasm', 'fonts/manifest.json']:
            check(apk.read(public_prefix + relative) == (application / 'dist' / relative).read_bytes(), 'Bundled web asset: ' + relative)
        fonts = json.loads(apk.read(public_prefix + 'fonts/manifest.json'))
        for family_name, family in fonts['families'].items():
            for item in family['files']:
                check(hashlib.sha256(apk.read(public_prefix + 'fonts/' + item['path'])).hexdigest() == item['sha256'], 'Font digest: ' + item['path'])
            for field in ['license', 'css']:
                check(public_prefix + 'fonts/' + family[field] in names, 'Font ' + field + ': ' + family_name)
        for relative in ['worker.mjs', 'index.mjs', 'local-fonts.mjs', 'android-process-adapter.cjs', 'vendor/font-converter.mjs',
                         'vendor/npm/bin/npm-cli.js', 'vendor/npm/node_modules/@npmcli/arborist/package.json']:
            check('assets/build-runtime/' + relative in names, 'Offline runtime file: ' + relative)
        check(apk.read('assets/build-runtime/android-process-adapter.cjs') ==
              (application / 'apps/build-runtime/android-process-adapter.cjs').read_bytes(), 'Android process adapter byte identity')
        # The source converter reads this separate catalog, so validating only
        # workbench/fonts would miss a broken Next dependency preparation package.
        runtime_fonts = 'assets/build-runtime/vendor/fonts/'
        check(apk.read(runtime_fonts + 'manifest.json') == apk.read(public_prefix + 'fonts/manifest.json'),
              'Source build font catalog matches workbench')
        for family_name, family in fonts['families'].items():
            for item in family['files']:
                check(hashlib.sha256(apk.read(runtime_fonts + item['path'])).hexdigest() == item['sha256'],
                      'Source build font digest: ' + item['path'])
            for field in ['license', 'css']:
                check(runtime_fonts + family[field] in names, 'Source build font ' + field + ': ' + family_name)
        check('assets/build-runtime-fingerprint.txt' in names, 'Runtime update fingerprint')
        check(json.loads(apk.read('assets/capacitor.config.json'))['android']['webContentsDebuggingEnabled'] is False,
              'Release WebView debugging disabled')
        for abi in ['arm64-v8a', 'x86_64']:
            for name in ['libnode.so', 'libsitefoundrynode.so', 'libsitefoundryshell.so']:
                data = apk.read(f'lib/{abi}/{name}')
                check(data[:5] == b'\x7fELF\x02', f'64-bit native runtime: {abi}/{name}')
                phoff = struct.unpack_from('<Q', data, 32)[0]
                phentsize, phnum = struct.unpack_from('<HH', data, 54)
                alignments = []
                for index in range(phnum):
                    offset = phoff + index * phentsize
                    if struct.unpack_from('<I', data, offset)[0] == 1:
                        alignments.append(struct.unpack_from('<Q', data, offset + 48)[0])
                report['elf'].append({'abi': abi, 'name': name, 'loadAlignments': alignments, 'sha256': hashlib.sha256(data).hexdigest()})
                check(bool(alignments) and all(alignment >= 16384 for alignment in alignments), f'16KB ELF alignment: {abi}/{name}')
        report['ok'] = True
except Exception as error:
    report['error'] = str(error)
finally:
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps({'ok': report['ok'], 'checks': len(report['checks']), 'report': str(args.output), 'error': report.get('error')}, ensure_ascii=False))
raise SystemExit(0 if report['ok'] else 1)
