#!/usr/bin/env sh
# Convert a photo (including iPhone HEIC) into a panel-ready dithered PNG.
#
# The panel is chosen by PROFILE (see profiles.json). Dimensions and the colour
# palette both come from device_profile.py, so nothing here hard-codes a panel
# size -- adding a device is a row in profiles.json, not a branch in this script.
# The default profile is the deployed 5.65" 7-colour ACeP frame.
set -eu

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROFILE_HELPER="$DIR/device_profile.py"

usage() {
  cat <<'EOF'
usage: prepare_image.sh [options] INPUT [OUTPUT]

  INPUT    any format ImageMagick can read (HEIC, JPEG, PNG, ...)
  OUTPUT   defaults to <artwork>/<INPUT basename>.png

options:
  --profile ID     device profile: which panel to prepare for
                   (default: the configured default profile, or $EPAPER_PROFILE)
  --out-dir DIR    where to write the PNG (default: the profile's artwork folder)
  --fit            fit inside the panel and pad with white
                   (default is cover + centre-crop, which fills the panel)
  --rotate         rotate 90 degrees first, for portrait photos/mounting
  --dither METHOD  FloydSteinberg (default), Riemersma or None
  -h, --help       show this help

Profiles live in profiles.json; run `python3 device_profile.py --list`.
Requires ImageMagick 7 ("magick") built with HEIC support, and python3.
EOF
}

mode=cover
rotate=0
dither=FloydSteinberg
out_dir=${EPAPER_IMAGES:-}
profile=${EPAPER_PROFILE:-}

while [ $# -gt 0 ]; do
  case "$1" in
    --profile)
      [ $# -ge 2 ] || { echo "error: --profile needs an id" >&2; exit 2; }
      profile=$2; shift 2 ;;
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

command -v magick >/dev/null 2>&1 || { echo "error: ImageMagick 7 ('magick') not found" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "error: python3 not found" >&2; exit 1; }

# Everything panel-specific comes from the profile table.
[ -n "$profile" ] || profile=$(python3 "$PROFILE_HELPER" --default)
WIDTH=$(python3 "$PROFILE_HELPER" "$profile" width)
HEIGHT=$(python3 "$PROFILE_HELPER" "$profile" height)
COLOURS=$(python3 "$PROFILE_HELPER" "$profile" colours)
PALETTE=$(python3 "$PROFILE_HELPER" "$profile" --palette)
[ -n "$out_dir" ] || out_dir=$(python3 "$PROFILE_HELPER" "$profile" --artwork)
[ -f "$PALETTE" ] || { echo "error: palette not found: $PALETTE" >&2; exit 1; }

in=$1
if [ $# -ge 2 ]; then
  out=$2
else
  [ -d "$out_dir" ] || { echo "error: output folder not found: $out_dir" >&2; exit 1; }
  base=${in##*/}
  out="$out_dir/${base%.*}.png"
fi

set -- -auto-orient -colorspace sRGB
[ "$rotate" -ne 0 ] && set -- "$@" -rotate "$rotate"

if [ "$mode" = fit ]; then
  set -- "$@" -resize "${WIDTH}x${HEIGHT}" -background white -gravity center -extent "${WIDTH}x${HEIGHT}"
else
  set -- "$@" -resize "${WIDTH}x${HEIGHT}^" -gravity center -extent "${WIDTH}x${HEIGHT}"
fi

set -- "$@" -dither "$dither" -remap "$PALETTE" -strip -depth 8

magick "$in" "$@" "$out"
echo "wrote $out (${WIDTH}x${HEIGHT}, ${COLOURS}-colour dithered, profile=$profile, dither=$dither)"
