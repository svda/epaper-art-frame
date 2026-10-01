from pathlib import Path

import pytest

from sync_favorites import DEFAULT_TOP_N, Config, parse_env_file, resolve_config


def args(**overrides):
    base = {
        "artwork_dir": None,
        "dest": None,
        "library": None,
        "top_n": None,
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
        top_n=DEFAULT_TOP_N,
        interval_h=6,
        dry_run=False,
    )


def test_environment_overrides_default():
    cfg = resolve(env={"TOP_N": "10", "EPAPER_DEST": "ha:/cfg/www/epaper"})
    assert cfg.top_n == 10
    assert cfg.dest == "ha:/cfg/www/epaper"


def test_env_file_used_when_environment_absent():
    cfg = resolve(env_file={"TOP_N": "7", "PHOTOS_LIBRARY": "/lib.photoslibrary"})
    assert cfg.top_n == 7
    assert cfg.library == Path("/lib.photoslibrary")


def test_environment_beats_env_file():
    cfg = resolve(env={"TOP_N": "3"}, env_file={"TOP_N": "9"})
    assert cfg.top_n == 3


def test_cli_beats_environment_and_env_file():
    cfg = resolve(env={"TOP_N": "3"}, env_file={"TOP_N": "9"}, top_n=25)
    assert cfg.top_n == 25


def test_invalid_top_n_is_a_clear_error():
    with pytest.raises(ValueError, match="TOP_N"):
        resolve(env={"TOP_N": "not-a-number"})


def test_artwork_dir_can_be_overridden_by_env():
    cfg = resolve(env={"EPAPER_IMAGES": "/tmp/art"})
    assert cfg.artwork_dir == Path("/tmp/art")


def test_parse_env_file_ignores_comments_blanks_and_quotes(tmp_path):
    env_file = tmp_path / ".env"
    env_file.write_text(
        "# a comment\n"
        "\n"
        "TOP_N=12\n"
        "EPAPER_DEST='ha:/cfg/www/epaper'\n"
        'PHOTOS_LIBRARY="/Users/x/Pictures/Photos Library.photoslibrary"\n'
        "  SPACED = value  \n"
    )
    parsed = parse_env_file(env_file)
    assert parsed["TOP_N"] == "12"
    assert parsed["EPAPER_DEST"] == "ha:/cfg/www/epaper"
    assert parsed["PHOTOS_LIBRARY"] == "/Users/x/Pictures/Photos Library.photoslibrary"
    assert parsed["SPACED"] == "value"
    assert "comment" not in parsed


def test_missing_env_file_is_empty(tmp_path):
    assert parse_env_file(tmp_path / "nope.env") == {}


def test_preflight_reports_each_missing_tool(monkeypatch):
    import sync_favorites

    monkeypatch.setattr(sync_favorites.importlib.util, "find_spec", lambda name: None)
    monkeypatch.setattr(sync_favorites.shutil, "which", lambda name: None)
    missing = sync_favorites.preflight()
    assert any("osxphotos" in m for m in missing)
    assert any("magick" in m for m in missing)
    assert any("scp" in m for m in missing)


def test_preflight_empty_when_all_present(monkeypatch):
    import sync_favorites

    monkeypatch.setattr(sync_favorites.importlib.util, "find_spec", lambda name: object())
    monkeypatch.setattr(sync_favorites.shutil, "which", lambda name: f"/usr/bin/{name}")
    assert sync_favorites.preflight() == []