#!/usr/bin/env sh
# Convert a photo (including iPhone HEIC) into a panel-ready, 7-colour
# dithered PNG for the Waveshare 5.65" ACeP e-paper frame (600x448).
#
# Usage:
#   ./prepare_image.sh [options] INPUT [OUTPUT]
#
#   INPUT    any format ImageMagick can read (HEIC, JPEG, PNG, ...)
#   OUTPUT   defaults to INPUT with a .png extension
#
# Options:
#   --fit            Fit inside 600x448 and pad with white
#                    (default is cover + centre-crop, which fills the panel)
#   --rotate         Rotate 90 degrees first, for portrait photos/mounting
#   --dither METHOD  FloydSteinberg (default), Riemersma or None
#   -h, --help       Show this help
#
# Requires ImageMagick 7 ("magick") built with HEIC support.
set -eu

WIDTH=600
HEIGHT=448
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PALETTE="$DIR/palette-acep7.png"

mode=cover
rotate=0
dither=FloydSteinberg

usage() { sed -n '2,19p' "$0"; }

while [ $# -gt 0 ]; do
  case "$1" in
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
out=${2:-"${1%.*}.png"}

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
