#!/bin/bash
# one loop step: render, then score every shot against the original
cd "$(dirname "$0")" && node reel.mjs make 4 | tail -1 && uv run -q ../../motion-engine/analyser/score.py ref/original.mp4 out/build_with_claude_v3.mp4 --shots ref/discover.json | grep -vE "^ +[0-9.]+s "
