#!/usr/bin/env python3
"""Install a git pre-push hook that stops a filled-in profile reaching GitHub.

/setup writes personal data (name, contact details, work history) into tracked
files. On a public fork, one careless `git push` publishes it. This hook checks
every commit being pushed: if CLAUDE.md or the candidate profile no longer holds
the `[YOUR_NAME]` placeholder, the push is refused with a plain explanation.

Pushing a profile to a *private* repository is fine: set
PRIVACY_GUARD_ALLOW=1 for that one push, or remove the hook.

Usage:
  python3 tools/install_privacy_guard.py            # install (idempotent)
  python3 tools/install_privacy_guard.py --check <commit>   # what the hook runs
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
PROFILE_FILES = ["CLAUDE.md", ".claude/skills/job-application-assistant/01-candidate-profile.md"]
PLACEHOLDER = "[YOUR_NAME]"
MARKER = "# ai-job-search privacy guard"

HOOK = f"""#!/bin/sh
{MARKER}
# Refuses pushes that carry a filled-in profile. See tools/install_privacy_guard.py.
[ "$PRIVACY_GUARD_ALLOW" = "1" ] && exit 0
PY=python3
command -v python3 >/dev/null 2>&1 || PY=python
while read local_ref local_sha remote_ref remote_sha; do
  [ "$local_sha" = "0000000000000000000000000000000000000000" ] && continue
  "$PY" tools/install_privacy_guard.py --check "$local_sha" || exit 1
done
exit 0
"""


def profile_is_personal(commit: str) -> list[str]:
    """Profile files that, at this commit, no longer hold the placeholder."""
    leaked = []
    for f in PROFILE_FILES:
        r = subprocess.run(["git", "show", f"{commit}:{f}"], cwd=REPO, capture_output=True, text=True, encoding="utf-8")
        if r.returncode == 0 and PLACEHOLDER not in r.stdout:
            leaked.append(f)
    return leaked


def main(argv: list[str]) -> int:
    if len(argv) >= 2 and argv[0] == "--check":
        leaked = profile_is_personal(argv[1])
        if leaked:
            print(
                "Push stopped by the privacy guard: these files hold your personal profile and this\n"
                "repository may be public:\n  " + "\n  ".join(leaked) + "\n"
                "Keep profile commits local, or if this remote is private, push with PRIVACY_GUARD_ALLOW=1.",
                file=sys.stderr,
            )
            return 1
        return 0
    hooks = Path(subprocess.run(["git", "rev-parse", "--git-path", "hooks"], cwd=REPO, capture_output=True, text=True).stdout.strip())
    hooks = hooks if hooks.is_absolute() else REPO / hooks
    hooks.mkdir(parents=True, exist_ok=True)
    hook = hooks / "pre-push"
    if hook.exists() and MARKER not in hook.read_text(encoding="utf-8", errors="replace"):
        print(f"{hook} already exists and is not ours; add a call to `tools/install_privacy_guard.py --check` yourself.", file=sys.stderr)
        return 1
    hook.write_text(HOOK, encoding="utf-8", newline="\n")
    os.chmod(hook, 0o755)
    print(f"privacy guard installed: {hook}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
