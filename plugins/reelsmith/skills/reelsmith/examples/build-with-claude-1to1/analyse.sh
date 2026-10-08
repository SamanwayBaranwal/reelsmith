#!/bin/bash
# Regenerate everything this rebuild measures from the reference: tracks, fits, cut-outs and plates, assets, models.
# Needs ref/original.mp4 (a reference you have the right to study) and MOTION pointing at reelsmith's motion/ folder.
set -eu; cd "$(dirname "$0")"; M=${MOTION:-../../../../../../motion}; A=$M/analyser; V=ref/original.mp4; O=ref/an
uv run -q $M/tools/beats.py $V ref/beats.json
uv run -q $A/discover.py $V --out $O
uv run -q $A/track.py  $V --name spark  --at 1.20  --box 687,184,603,631 --from 0 --to 3.07 --out $O
uv run -q $A/camera.py $V --name camera2 --at 3.30 --from 3.07 --to 3.63 --out $O
uv run -q $A/camera.py $V --name camera3 --at 4.30 --from 3.63 --to 6.97 --out $O
uv run -q $A/track.py  $V --name arrow  --at 7.00  --box 1240,785,155,165 --from 6.97 --to 9.20 --out $O
uv run -q $A/track.py  $V --name dash   --at 8.95  --box 548,392,820,616 --from 6.97 --to 9.20 --model 3d --out $O
uv run -q $A/track.py  $V --name green  --at 8.95  --box 60,277,490,610  --from 6.97 --to 9.20 --model 3d --out $O
uv run -q $A/track.py  $V --name purple --at 9.05  --box 1365,135,440,755 --from 8.45 --to 9.19 --model 3d --out $O
uv run -q $A/track.py  $V --name blue   --at 8.95  --box 0,140,690,140   --from 8.2  --to 9.19 --model 3d --out $O
uv run -q $A/track.py  $V --name endtitle --at 12.80 --box 523,475,918,128 --from 11.30 --to 12.83 --out $O
uv run -q $A/fit.py $O/*.track.json --beats ref/beats.json --out $O
uv run -q $A/rebuild.py $V $O --out ref/rebuild --raw && cp -R ref/rebuild/cutouts ref/rebuild/plate*.png .   # cut-outs + clean plates
mkdir -p assets
uv run -q ref/cards.py && uv run -q ref/clean_card.py $O/purple.track.json assets/card_purple.png 24 && uv run -q ref/add_cards.py   # real cards (purple: arrow removed by masked median)
uv run -q ref/world.py 5.45 6.20 && uv run -q ref/chat_assets.py && uv run -q ref/chat_layers.py                                   # typed prompt + send button, un-zoomed into the chat layout
uv run -q ref/planet_measure.py && uv run -q ref/planet_model.py && uv run -q ref/planet_curve.py && uv run -q ref/eclipse_profile.py   # planet edge, curvature, glow
uv run -q ref/dome_model.py && uv run -q ref/bg_fit.py                                                                                 # white dome; MacBook background
echo "now: put the MacBook model at assets/macbook14.glb, run node fitpose.mjs 9.23 10.83, then node reel.mjs make"
