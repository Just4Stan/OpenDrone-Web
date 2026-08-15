#!/bin/sh
# Regenerate the subset webfonts in app/assets/fonts from full upstream files.
#
# Usage: scripts/subset-fonts.sh <dir with full inter-var.woff2 and
#        jetbrains-mono-{Regular,Medium,Bold}.woff2>
# Needs: python3 with fonttools + brotli (pip install fonttools brotli).
#
# Sources: Inter Variable (rsms.me/inter, ships as InterVariable.woff2: rename
# it to inter-var.woff2 in <dir>), JetBrains Mono static weights
# (github.com/JetBrains/JetBrainsMono releases, JetBrainsMono-Regular.woff2 etc:
# rename to jetbrains-mono-Regular.woff2 etc). Tokyo is already tiny (7 KB) and
# is not subset.
#
# Coverage: Basic Latin, Latin-1, Latin Extended-A, the four Greek letters the
# copy uses (Δ Ω μ π), general punctuation, currency, letterlike, arrows,
# math, technical, enclosed alphanumerics, box drawing, geometric shapes,
# dingbats, ligatures. Every OpenType feature and both Inter axes are kept, so
# the rendering is identical for that character set; anything outside falls
# back to the system font. Full Inter is 352 KB, this subset is 140 KB.
set -eu
SRC="${1:?source dir}"
DST="$(cd "$(dirname "$0")/.." && pwd)/app/assets/fonts"
RANGES='U+0000-017F,U+0394,U+03A9,U+03BC,U+03C0,U+2000-206F,U+20A0-20CF,U+2100-218F,U+2190-23FF,U+2460-24FF,U+2500-259F,U+25A0-27BF,U+2B00-2BFF,U+FB00-FB06,U+FEFF,U+FFFD'
for f in inter-var jetbrains-mono-Regular jetbrains-mono-Medium jetbrains-mono-Bold; do
  python3 -m fontTools.subset "$SRC/$f.woff2" --unicodes="$RANGES" \
    --layout-features='*' --flavor=woff2 --no-hinting --desubroutinize \
    --output-file="$DST/$f.woff2"
  printf '%-26s %8s bytes\n' "$f" "$(wc -c < "$DST/$f.woff2" | tr -d ' ')"
done
