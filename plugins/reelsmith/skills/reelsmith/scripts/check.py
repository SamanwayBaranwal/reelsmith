#!/usr/bin/env python3
"""reelsmith check — are the tools installed? Prints install commands for this OS."""
import platform, re, shutil, subprocess, sys

OS = platform.system()
HINT = {
    'ffmpeg': {'Darwin': 'brew install ffmpeg', 'Windows': 'winget install Gyan.FFmpeg', 'Linux': 'sudo apt install ffmpeg'},
    'node': {'Darwin': 'brew install node', 'Windows': 'winget install OpenJS.NodeJS.LTS', 'Linux': 'see https://nodejs.org (Node 18+)'},
    'uv': {'Darwin': 'brew install uv', 'Windows': 'winget install astral-sh.uv', 'Linux': 'curl -LsSf https://astral.sh/uv/install.sh | sh'},
    'yt-dlp': {'Darwin': 'brew install yt-dlp', 'Windows': 'winget install yt-dlp.yt-dlp', 'Linux': 'uv tool install yt-dlp'},
}


def ver(cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=20).stdout.strip().splitlines()[0]
    except Exception:
        return None


ok = True
rows = []
for name, cmd in [('ffmpeg', ['ffmpeg', '-version']), ('ffprobe', ['ffprobe', '-version']), ('node', ['node', '-v']), ('uv', ['uv', '--version']), ('yt-dlp', ['yt-dlp', '--version'])]:
    v = ver(cmd) if shutil.which(cmd[0]) else None
    if name == 'node' and v:
        m = re.match(r'v(\d+)', v)
        if m and int(m.group(1)) < 18:
            v = None
    optional = name == 'yt-dlp' and shutil.which('uvx')
    status = 'ok' if v else ('optional' if optional else 'MISSING')
    if not v and not optional:
        ok = False
    rows.append((status, name, (v or '')[:60]))
for s, n, v in rows:
    print(f'{s:9} {n:8} {v}')
missing = [n for s, n, _ in rows if s == 'MISSING']
if missing:
    print('\nInstall:')
    for n in dict.fromkeys('ffmpeg' if n == 'ffprobe' else n for n in missing):
        print(f'  {HINT[n].get(OS, HINT[n]["Linux"])}')
print('\nReady.' if ok else '\nInstall the missing tools, then run this again.')
sys.exit(0 if ok else 1)
