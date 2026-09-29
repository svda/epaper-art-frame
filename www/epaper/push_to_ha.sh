#!/usr/bin/env sh
# Push manifest.json and the artwork to the Home Assistant host via scp.
#
# This folder is the source of truth: the script regenerates manifest.json,
# then copies it and every image (except the palette) to the HA host's
# config/www/epaper/ folder, where it is served at /local/epaper/.
#
# Usage:
#   ./push_to_ha.sh [OPTIONS] [user@]host:/path/to/config/www/epaper/
#
# The destination may also be set via the EPAPER_DEST environment variable.
#
# Options:
#   -n, --dry-run   show what would be copied, then stop
#   -h, --help      show this help
set -eu

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PALETTE=palette-acep7.png
dry_run=0

usage() { sed -n '2,14p' "$0"; }

while [ $# -gt 0 ]; do
  case "$1" in
    -n|--dry-run) dry_run=1; shift ;;
    -h|--help) usage; exit 0 ;;
    --) shift; break ;;
    -*) echo "error: unknown option: $1" >&2; exit 2 ;;
    *) break ;;
  esac
done

if [ $# -ge 1 ]; then dest=$1; else dest=${EPAPER_DEST:-}; fi
[ -n "$dest" ] || { usage >&2; exit 2; }
case "$dest" in
  *:*) ;;
  *) echo "error: destination must be [user@]host:/path" >&2; exit 2 ;;
esac
dest="${dest%/}/"
host=${dest%%:*}
remote_dir=${dest#*:}

command -v scp >/dev/null 2>&1 || { echo "error: scp not found" >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "error: python3 not found" >&2; exit 1; }

# Keep the manifest in sync with the folder — never push a stale one.
echo "regenerating manifest.json"
python3 "$DIR/generate_manifest.py" >/dev/null

# Collect the artwork: every image except the palette.
set --
for f in "$DIR"/*.png "$DIR"/*.jpg "$DIR"/*.jpeg; do
  [ -f "$f" ] || continue
  [ "${f##*/}" = "$PALETTE" ] && continue
  set -- "$@" "$f"
done
[ $# -ge 1 ] || { echo "error: no images to push in $DIR" >&2; exit 1; }

echo "destination: $host:$remote_dir"
echo "files:"
printf '  %s\n' "$DIR/manifest.json"
for f in "$@"; do printf '  %s\n' "$f"; done

if [ "$dry_run" -eq 1 ]; then
  echo "(dry run — nothing copied)"
  exit 0
fi

ssh "$host" "mkdir -p '$remote_dir'"
scp "$DIR/manifest.json" "$@" "$dest"
echo "pushed $(($# + 1)) file(s) to $host:$remote_dir"
