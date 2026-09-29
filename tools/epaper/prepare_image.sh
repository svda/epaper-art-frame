#!/usr/bin/env sh
# Convert a photo (including iPhone HEIC) into a panel-ready, 7-colour
# dithered PNG for the Waveshare 5.65" ACeP e-paper frame (600x448).
set -eu

WIDTH=600
HEIGHT=448
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PALETTE="$DIR/palette-acep7.png"
DEFAULT_OUT="$DIR/../../www/epaper"

usage() {
  cat <<'EOF'
usage: prepare_image.sh [options] INPUT [OUTPUT]

  INPUT    any format ImageMagick can read (HEIC, JPEG, PNG, ...)
  OUTPUT   defaults to <artwork>/<INPUT basename>.png

options:
  --out-dir DIR    where to write the PNG
                   (default: <repo>/www/epaper, or $EPAPER_IMAGES)
  --fit            fit inside 600x448 and pad with white
                   (default is cover + centre-crop, which fills the panel)
  --rotate         rotate 90 degrees first, for portrait photos/mounting
  --dither METHOD  FloydSteinberg (default), Riemersma or None
  -h, --help       show this help

Requires ImageMagick 7 ("magick") built with HEIC support.
EOF
}

mode=cover
rotate=0
dither=FloydSteinberg
out_dir=${EPAPER_IMAGES:-$DEFAULT_OUT}

while [ $# -gt 0 ]; do
  case "$1" in
    --out-dir)
      [ $# -ge 2 ] || { echo "error: --out-dir needs a path" >&2; exit 2; }
      out_dir=$2; shift 2 ;;
    --fit) mode=fit; shift ;;
    --rotate) rotate=90; shift ;;
    --dither)
      [ $# -ge 2 ] || { echo "error: --dither needs an argument" >&2; exit 2; }
      dither=$2; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    --) shift; break ;;
    -*) echo "error: unknown option: $1" >&2; exit 2 ;;
    *) break ;;
  esac
done

[ $# -ge 1 ] || { usage >&2; exit 2; }
in=$1
if [ $# -ge 2 ]; then
  out=$2
else
  [ -d "$out_dir" ] || { echo "error: output folder not found: $out_dir" >&2; exit 1; }
  base=${in##*/}
  out="$out_dir/${base%.*}.png"
fi

command -v magick >/dev/null 2>&1 || { echo "error: ImageMagick 7 ('magick') not found" >&2; exit 1; }
[ -f "$PALETTE" ] || { echo "error: palette not found: $PALETTE" >&2; exit 1; }

set -- -auto-orient -colorspace sRGB
[ "$rotate" -ne 0 ] && set -- "$@" -rotate "$rotate"

if [ "$mode" = fit ]; then
  set -- "$@" -resize "${WIDTH}x${HEIGHT}" -background white -gravity center -extent "${WIDTH}x${HEIGHT}"
else
  set -- "$@" -resize "${WIDTH}x${HEIGHT}^" -gravity center -extent "${WIDTH}x${HEIGHT}"
fi

set -- "$@" -dither "$dither" -remap "$PALETTE" -strip -depth 8

magick "$in" "$@" "$out"
echo "wrote $out (${WIDTH}x${HEIGHT}, 7-colour dithered, dither=$dither)"
