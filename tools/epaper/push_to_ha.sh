#!/usr/bin/env sh
# Push manifest.json and the artwork to the Home Assistant host via scp.
#
# The artwork folder is the source of truth: this regenerates manifest.json,
# then copies it and every image to the HA host's config/www/epaper/ folder,
# where it is served at /local/epaper/.
set -eu

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
DEFAULT_IMAGES="$DIR/../../www/epaper"
dry_run=0

usage() {
  cat <<'EOF'
usage: push_to_ha.sh [options] [user@]host:/path/to/config/www/epaper/

options:
  --dir DIR       artwork folder (default: <repo>/www/epaper, or $EPAPER_IMAGES)
  -n, --dry-run   show what would be copied, then stop
  -h, --help      show this help

The destination may also be set via the EPAPER_DEST environment variable.
EOF
}

images=${EPAPER_IMAGES:-$DEFAULT_IMAGES}

while [ $# -gt 0 ]; do
  case "$1" in
    --dir)
      [ $# -ge 2 ] || { echo "error: --dir needs a path" >&2; exit 2; }
      images=$2; shift 2 ;;
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
[ -d "$images" ] || { echo "error: artwork folder not found: $images" >&2; exit 1; }

# Keep the manifest in sync with the folder — never push a stale one.
echo "regenerating manifest.json"
python3 "$DIR/generate_manifest.py" --dir "$images" >/dev/null

# Collect the artwork.
set --
for f in "$images"/*.png "$images"/*.jpg "$images"/*.jpeg; do
  [ -f "$f" ] || continue
  set -- "$@" "$f"
done
[ $# -ge 1 ] || { echo "error: no images to push in $images" >&2; exit 1; }

echo "destination: $host:$remote_dir"
echo "files:"
printf '  %s\n' "$images/manifest.json"
for f in "$@"; do printf '  %s\n' "$f"; done

if [ "$dry_run" -eq 1 ]; then
  echo "(dry run — nothing copied)"
  exit 0
fi

ssh "$host" "mkdir -p '$remote_dir'"
scp "$images/manifest.json" "$@" "$dest"
echo "pushed $(($# + 1)) file(s) to $host:$remote_dir"
