from pathlib import Path

import pytest

from sync_album import PUSH_SCRIPT, deploy


def test_deploy_skips_when_nothing_changed():
    calls = []
    deploy("ha:/cfg/www/epaper", changed=False, run_fn=calls.append)
    assert calls == []


def test_deploy_runs_push_script_with_the_destination():
    calls = []
    deploy("ha:/cfg/www/epaper", changed=True, run_fn=calls.append)
    assert calls == [[str(PUSH_SCRIPT), "ha:/cfg/www/epaper"]]


def test_deploy_requires_a_destination_when_changed():
    with pytest.raises(RuntimeError, match="EPAPER_DEST"):
        deploy(None, changed=True, run_fn=lambda argv: None)


def test_deploy_propagates_host_failure():
    def run_fn(argv):
        raise RuntimeError("ssh: host unreachable")

    with pytest.raises(RuntimeError, match="unreachable"):
        deploy("ha:/p", changed=True, run_fn=run_fn)