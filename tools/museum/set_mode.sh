#!/usr/bin/env sh
# Publish one mode (art or photos) into the live 13" folder and deploy it.
set -eu

DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
REPO=$(CDPATH='' cd -- "$DIR/../.." && pwd)
MODES="$REPO/www/epaper13-modes"
LIVE="$REPO/www/epaper13"
PROFILE=spectra6-133
GENERATE="$REPO/tools/epaper/generate_manifest.py"
PUSH="$REPO/tools/epaper/push_to_ha.sh"
DEST=${EPAPER13_DEST:-}

dry_run=0
deploy=1
mode=
action=

usage() {
  cat <<'EOF'
usage: set_mode.sh [options] art|photos
       set_mode.sh [options] --refresh
       set_mode.sh --status

options:
  -n, --dry-run   show what would change, then stop
      --no-deploy publish and record the mode, but do not push
  -h, --help      show this help
EOF
}

die() { echo "error: $*" >&2; exit 1; }

count_pngs() {
  n=0
  for f in "$1"/*.png; do
    if [ -f "$f" ]; then n=$((n + 1)); fi
  done
  echo "$n"
}

publish() {
  m=$1
  src="$MODES/$m"
  [ -d "$src" ] || die "mode folder not found: $src"
  [ "$(count_pngs "$src")" -gt 0 ] || die "mode '$m' has no PNGs"

  if [ "$dry_run" -eq 1 ]; then
    echo "would publish $m -> $LIVE"
    if [ -d "$LIVE" ]; then
      rsync -a --delete --dry-run --itemize-changes \
        --include='*.png' --exclude='*' "$src/" "$LIVE/"
    else
      echo "would create $LIVE"
    fi
    echo "would write ACTIVE=$m"
    if [ "$deploy" -eq 1 ]; then
      echo "would deploy: $PUSH --profile $PROFILE $DEST"
    fi
    return 0
  fi

  mkdir -p "$LIVE"
  rsync -a --delete --include='*.png' --exclude='*' "$src/" "$LIVE/"
  python3 "$GENERATE" --profile "$PROFILE" --dir "$LIVE" >/dev/null
  printf '%s\n' "$m" > "$MODES/ACTIVE"
  echo "published $m -> $LIVE"

  if [ "$deploy" -eq 1 ]; then
    [ -n "$DEST" ] || die "EPAPER13_DEST is not set"
    "$PUSH" --profile "$PROFILE" "$DEST"
  fi
  echo "note: the frame keeps one rotation counter across modes; it continues from wherever it is."
}

status() {
  active=$(cat "$MODES/ACTIVE" 2>/dev/null || true)
  [ -n "$active" ] || active=none
  echo "active: $active"
  for m in art photos; do
    echo "$m: $(count_pngs "$MODES/$m") PNG(s)"
  done
}

while [ $# -gt 0 ]; do
  case "$1" in
    -n|--dry-run) dry_run=1; shift ;;
    --no-deploy) deploy=0; shift ;;
    --refresh) action=refresh; shift ;;
    --status) action=status; shift ;;
    -h|--help) usage; exit 0 ;;
    art|photos) mode=$1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done

case "$action" in
  status) status; exit 0 ;;
  refresh)
    active=$(cat "$MODES/ACTIVE" 2>/dev/null || true)
    [ -n "$active" ] || die "no ACTIVE mode recorded; run set_mode.sh art|photos first"
    publish "$active"
    ;;
  *)
    [ -n "$mode" ] || { usage >&2; exit 2; }
    publish "$mode"
    ;;
esac
