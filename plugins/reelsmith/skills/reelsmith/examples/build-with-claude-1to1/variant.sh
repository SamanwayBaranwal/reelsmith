#!/bin/bash
# turn the code layer of one shot on/off: ./variant.sh shot1 on|off
python3 - "$1" "$2" <<'PY'
import sys, re
shot, mode = sys.argv[1], sys.argv[2]; s = open('comp.js').read(); i = s.index(f'"name": "{shot}"'); j = s.index('"name": "code_', i)
m = re.compile(r'"visible": (true|false)').search(s, j); s = s[:m.start()] + f'"visible": {"true" if mode == "on" else "false"}' + s[m.end():]; open('comp.js', 'w').write(s)
PY
