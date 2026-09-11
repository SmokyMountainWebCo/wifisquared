#!/usr/bin/env bash
# ============================================================
#   Build a downloadable backup of the website for the client.
#
#     internal/make-backup.sh [git-ref]        # default ref: main
#
#   Emits backups/wifisquared-website-backup-YYYY-MM-DD.zip, containing:
#
#     the site       every published file, exactly as the given ref has it
#     README.txt     what the backup holds and how to restore it, written
#                    for someone who does not use git
#     MANIFEST.txt   a sha256 for every file, so a backup pulled off a
#                    drive years from now can be proven intact
#     a git bundle   the site's full commit history in one file
#
#   The backup is cut from a COMMIT, never from the working tree, so what
#   ships is a state that exists in history rather than whatever happened
#   to be on disk. Uncommitted edits are reported and left out.
#
#   The script verifies its own output before it reports success: it
#   unzips the archive to a temp directory, checks every checksum, and
#   clones the bundle to confirm the history restores. A backup that has
#   never been restored is not yet known to be a backup.
# ============================================================

set -euo pipefail

REF="${1:-main}"
# Resolve the repo from where the script lives, not from the caller's
# directory, so it runs the same from anywhere.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$HERE" rev-parse --show-toplevel)"
cd "$ROOT"

git rev-parse --verify --quiet "$REF^{commit}" >/dev/null || {
  echo "error: '$REF' is not a commit in this repository" >&2
  exit 1
}

# A shallow clone cannot produce a bundle anyone can clone from — git refuses
# to hand over history it does not have. Deepen before bundling.
if [ -f "$(git rev-parse --git-dir)/shallow" ]; then
  echo "Repository is a shallow clone; fetching full history for the bundle..."
  git fetch --unshallow
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Note: uncommitted changes are NOT in this backup (it is cut from $REF):"
  git status --short | sed 's/^/  /'
  echo
fi

STAMP="$(date +%Y-%m-%d)"
NAME="wifisquared-website-backup-$STAMP"
OUT="$ROOT/backups"
STAGE="$OUT/$NAME"
ZIP="$OUT/$NAME.zip"
COMMIT="$(git rev-parse "$REF")"
COMMIT_DATE="$(git log -1 --format=%ad --date=short "$REF")"

rm -rf "$STAGE" "$ZIP"
mkdir -p "$STAGE"
git archive --format=tar "$REF" | tar -x -C "$STAGE"
git bundle create --quiet "$STAGE/wifisquared-git-history.bundle" "$REF"

# Page inventory, built from the files actually in the backup so a new page
# shows up here without anyone remembering to edit this script. The titles
# come from each page's <title>, minus the " | Wifi Squared" suffix.
inventory() {
  local f name title
  for f in "$STAGE"/*.html; do
    name="$(basename "$f")"
    if [ "$name" = index.html ]; then
      title="Home page"
    else
      title="$(sed -n 's|.*<title>\(.*\)</title>.*|\1|p' "$f" | head -1 \
               | sed 's/ | Wifi Squared$//; s/&amp;/\&/g')"
    fi
    # A long filename gets its title on the next line rather than shoving
    # the column out of alignment for every other row.
    if [ "${#name}" -ge 38 ]; then
      printf '  %s\n  %38s%s\n' "$name" '' "$title"
    else
      printf '  %-38s%s\n' "$name" "$title"
    fi
  done
}

cat > "$STAGE/README.txt" <<EOF
WIFI SQUARED — WEBSITE BACKUP
wifisquared.com
Backup created: $STAMP
Source commit: $COMMIT ($COMMIT_DATE)

------------------------------------------------------------
WHAT THIS IS
------------------------------------------------------------
A complete copy of the wifisquared.com website exactly as it is
published. Every page, image, icon, and configuration file is
here. Nothing is missing and nothing needs to be downloaded from
anywhere else to rebuild the site from this folder.

The site is a plain static website — there is no database, no
WordPress install, and no server-side code to back up. What you
see in this folder IS the entire website.

------------------------------------------------------------
THE PAGES
------------------------------------------------------------
$(inventory)

------------------------------------------------------------
THE REST OF THE FOLDER
------------------------------------------------------------
broadband-labels/ .... The FCC broadband consumer labels for each
                       plan, plus their stylesheets and source CSV.
images/ .............. All photographs used on the site.
internal/ ............ Working files that are NOT published on the
                       live site: the FCC label generator script,
                       its data, and an unpublished draft. Kept in
                       the backup because they are the source for
                       the published labels.

Site plumbing:
  _redirects ......... Redirects from the old WordPress URLs
  _headers ........... Security headers
  robots.txt ......... Search engine instructions
  sitemap.xml ........ Page list for search engines
  favicon.ico, favicon.svg, apple-touch-icon.png, site.webmanifest
                       Browser tab and phone home-screen icons

wifisquared-git-history.bundle
    The complete version history of the site — every past edit, who
    made it, when, and why. Optional; you only need this if you ever
    want to look back at or restore an older version.

MANIFEST.txt ......... A checksum for every file, so you can verify
                       years from now that nothing has been altered
                       or corrupted in storage.

------------------------------------------------------------
HOW TO VIEW IT
------------------------------------------------------------
Unzip the folder and double-click index.html. It opens in any web
browser and works offline. Links between pages will work; a few
links written for the live server (like /privacy-policy) will only
work once the site is hosted.

------------------------------------------------------------
HOW TO PUT IT BACK ONLINE
------------------------------------------------------------
Any static web host can serve this folder as-is. On Netlify (the
current host), drag the unzipped folder onto the "Deploys" page and
the site is live — the _redirects and _headers files are picked up
automatically. Then point the wifisquared.com domain at it.

To restore the full version history instead, install Git and run:
    git clone -b $REF wifisquared-git-history.bundle wifisquared

------------------------------------------------------------
KEEPING THIS BACKUP GOOD
------------------------------------------------------------
This is a snapshot of the site on $STAMP. It stays accurate until
the website changes. Ask for a fresh backup after any round of site
updates, or once or twice a year, whichever comes first.

Store a copy somewhere that is not your computer — an external
drive, or a cloud storage folder — so a hardware failure can't take
the backup with it.
EOF

# Checksums last, over everything except the manifest itself.
( cd "$STAGE" && find . -type f ! -name MANIFEST.txt | sed 's|^\./||' \
  | LC_ALL=C sort | xargs sha256sum > MANIFEST.txt )

( cd "$OUT" && zip -r -q "$NAME.zip" "$NAME" )

# --- Restore the archive before calling it a backup ---------------------
VERIFY="$(mktemp -d)"
trap 'rm -rf "$VERIFY"' EXIT
unzip -q "$ZIP" -d "$VERIFY"
( cd "$VERIFY/$NAME" && sha256sum -c --quiet MANIFEST.txt )
git clone -q -b "$REF" "$VERIFY/$NAME/wifisquared-git-history.bundle" "$VERIFY/clone"
diff -rq "$VERIFY/clone" "$VERIFY/$NAME" -x .git \
  -x README.txt -x MANIFEST.txt -x '*.bundle' >/dev/null

rm -rf "$STAGE"
echo "Backup verified: $ZIP"
echo "  $(find "$VERIFY/$NAME" -type f | wc -l) files, $(du -h "$ZIP" | cut -f1), cut from $REF at ${COMMIT:0:7}"
