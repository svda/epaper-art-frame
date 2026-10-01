import plistlib
from pathlib import Path

from sync_favorites import PLIST_TEMPLATE, render_plist


def test_plist_template_exists():
    assert PLIST_TEMPLATE.is_file()


def test_render_plist_is_valid_and_schedules_the_sync():
    rendered = render_plist(
        PLIST_TEMPLATE.read_text(),
        python="/venv/bin/python",
        script="/repo/tools/icloud/sync_favorites.py",
        workdir="/repo/tools/icloud",
        stdout="/repo/tools/icloud/sync.log",
        stderr="/repo/tools/icloud/sync.err.log",
        interval_h=6,
    )
    data = plistlib.loads(rendered.encode())

    assert data["Label"] == "com.sander.epaper-favorites"
    assert data["ProgramArguments"] == [
        "/venv/bin/python",
        "/repo/tools/icloud/sync_favorites.py",
    ]
    assert data["WorkingDirectory"] == "/repo/tools/icloud"
    assert data["StartInterval"] == 6 * 3600
    assert data["RunAtLoad"] is True
    assert data["StandardOutPath"] == "/repo/tools/icloud/sync.log"
    assert data["StandardErrorPath"] == "/repo/tools/icloud/sync.err.log"


def test_render_plist_sets_a_path_that_finds_magick_and_ssh():
    rendered = render_plist(
        PLIST_TEMPLATE.read_text(),
        python="/p",
        script="/s",
        workdir="/w",
        stdout="/o",
        stderr="/e",
        interval_h=1,
    )
    path = plistlib.loads(rendered.encode())["EnvironmentVariables"]["PATH"]
    assert "/opt/homebrew/bin" in path
    assert "/usr/bin" in path
    assert "/bin" in path


def test_render_plist_leaves_no_placeholders():
    rendered = render_plist(
        PLIST_TEMPLATE.read_text(),
        python="/p",
        script="/s",
        workdir="/w",
        stdout="/o",
        stderr="/e",
        interval_h=1,
    )
    assert "__" not in rendered