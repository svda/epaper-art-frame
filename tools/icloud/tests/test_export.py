import subprocess
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

import pytest

from sync_favorites import apply_artwork, prepare_one


@dataclass
class FakePhoto:
    uuid: str


def test_prepare_one_exports_then_prepares_with_options_before_input(tmp_path):
    dest = tmp_path / "out" / "uuid-a.png"
    dest.parent.mkdir()
    calls = {}

    def export_fn(photo, export_dir):
        export_dir = Path(export_dir)
        src = export_dir / "IMG_0001.HEIC"
        src.write_bytes(b"heic")
        calls["export_dir"] = export_dir
        return [str(src)]

    def run_fn(argv):
        calls["argv"] = argv
        Path(argv[-1]).write_bytes(b"png")

    prepare_one(
        SimpleNamespace(uuid="uuid-a"),
        dest,
        export_fn=export_fn,
        run_fn=run_fn,
        prepare_script=Path("/repo/tools/epaper/prepare_image.sh"),
    )

    assert calls["argv"][0] == "/repo/tools/epaper/prepare_image.sh"
    assert calls["argv"][1:3] == ["--out-dir", str(dest.parent)]
    assert Path(calls["argv"][-2]).name == "IMG_0001.HEIC"
    assert calls["argv"][-1] == str(dest)
    assert dest.read_bytes() == b"png"


def test_prepare_one_raises_when_export_yields_nothing(tmp_path):
    with pytest.raises(RuntimeError, match="uuid-x"):
        prepare_one(
            SimpleNamespace(uuid="uuid-x"),
            tmp_path / "d.png",
            export_fn=lambda photo, export_dir: [],
            run_fn=lambda argv: None,
            prepare_script=Path("/p/prepare_image.sh"),
        )


def test_prepare_one_propagates_prepare_failure(tmp_path):
    def run_fn(argv):
        raise subprocess.CalledProcessError(1, argv)

    with pytest.raises(subprocess.CalledProcessError):
        prepare_one(
            SimpleNamespace(uuid="u"),
            tmp_path / "d.png",
            export_fn=lambda photo, export_dir: [str(tmp_path / "x.heic")],
            run_fn=run_fn,
            prepare_script=Path("/p/prepare_image.sh"),
        )


def test_prepare_one_cleans_up_its_export_dir(tmp_path):
    seen = {}

    def export_fn(photo, export_dir):
        seen["dir"] = Path(export_dir)
        src = Path(export_dir) / "x.heic"
        src.write_bytes(b"x")
        return [str(src)]

    prepare_one(
        SimpleNamespace(uuid="u"),
        tmp_path / "d.png",
        export_fn=export_fn,
        run_fn=lambda argv: Path(argv[-1]).write_bytes(b"png"),
        prepare_script=Path("/p/prepare_image.sh"),
    )

    assert not seen["dir"].exists()


def test_apply_artwork_continues_past_a_failing_photo(tmp_path):
    def prepare_one(photo, dest):
        if photo.uuid == "bad":
            raise RuntimeError("no export")
        Path(dest).write_bytes(b"png")

    result = apply_artwork(
        photos=[FakePhoto("good"), FakePhoto("bad")],
        artwork_dir=tmp_path,
        prepare_one=prepare_one,
        regenerate_manifest=lambda folder: None,
    )

    assert {p.name for p in tmp_path.iterdir() if p.suffix == ".png"} == {"good.png"}
    assert result.failures == [("bad", "no export")]
    assert result.kept == ["good.png"]