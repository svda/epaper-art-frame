from pathlib import Path

import pytest

from sync_album import Config, parse_env_file, resolve_config


def args(**overrides):
    base = {
        "artwork_dir": None,
        "dest": None,
        "library": None,
        "album": None,
        "interval_h": None,
        "dry_run": False,
    }
    base.update(overrides)
    return type("Args", (), base)


DEFAULT_ARTWORK = Path("/repo/www/epaper")


def resolve(env=None, env_file=None, **cli):
    return resolve_config(
        args(**cli),
        env=env or {},
        env_file=env_file or {},
        default_artwork=DEFAULT_ARTWORK,
    )


def test_defaults_when_nothing_is_set():
    cfg = resolve()
    assert cfg == Config(
        artwork_dir=DEFAULT_ARTWORK,
        dest=None,
        library=None,
        album=None,
        interval_h=6,
        dry_run=False,
    )


def test_environment_overrides_default():
    cfg = resolve(env={"ALBUM": "epaper art frame", "EPAPER_DEST": "ha:/cfg/www/epaper"})
    assert cfg.album == "epaper art frame"
    assert cfg.dest == "ha:/cfg/www/epaper"


def test_env_file_used_when_environment_absent():
    cfg = resolve(env_file={"ALBUM": "Trips", "PHOTOS_LIBRARY": "/lib.photoslibrary"})
    assert cfg.album == "Trips"
    assert cfg.library == Path("/lib.photoslibrary")


def test_environment_beats_env_file():
    cfg = resolve(env={"ALBUM": "A"}, env_file={"ALBUM": "B"})
    assert cfg.album == "A"


def test_cli_beats_environment_and_env_file():
    cfg = resolve(env={"ALBUM": "A"}, env_file={"ALBUM": "B"}, album="C")
    assert cfg.album == "C"


def test_invalid_interval_is_a_clear_error():
    with pytest.raises(ValueError, match="SYNC_INTERVAL_H"):
        resolve(env={"SYNC_INTERVAL_H": "not-a-number"})


def test_artwork_dir_can_be_overridden_by_env():
    cfg = resolve(env={"EPAPER_IMAGES": "/tmp/art"})
    assert cfg.artwork_dir == Path("/tmp/art")


def test_parse_env_file_ignores_comments_blanks_and_quotes(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "# a comment\n"
        "\n"
        "ALBUM=epaper art frame\n"
        "EPAPER_DEST='ha:/cfg/www/epaper'\n"
        'PHOTOS_LIBRARY="/Users/x/Pictures/Photos Library.photoslibrary"\n'
        "  SPACED = value  \n"
    )
    parsed = parse_env_file(env_file)
    assert parsed["ALBUM"] == "epaper art frame"
    assert parsed["EPAPER_DEST"] == "ha:/cfg/www/epaper"
    assert parsed["PHOTOS_LIBRARY"] == "/Users/x/Pictures/Photos Library.photoslibrary"
    assert parsed["SPACED"] == "value"
    assert "comment" not in parsed


def test_missing_env_file_is_empty(tmp_path):
    assert parse_env_file(tmp_path / "nope.env") == {}


def test_preflight_reports_each_missing_tool(monkeypatch):
    import sync_album

    monkeypatch.setattr(sync_album.importlib.util, "find_spec", lambda name: None)
    monkeypatch.setattr(sync_album.shutil, "which", lambda name: None)
    missing = sync_album.preflight()
    assert any("osxphotos" in m for m in missing)
    assert any("magick" in m for m in missing)
    assert any("scp" in m for m in missing)


def test_preflight_empty_when_all_present(monkeypatch):
    import sync_album

    monkeypatch.setattr(sync_album.importlib.util, "find_spec", lambda name: object())
    monkeypatch.setattr(sync_album.shutil, "which", lambda name: f"/usr/bin/{name}")
    assert sync_album.preflight() == []
