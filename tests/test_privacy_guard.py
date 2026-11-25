"""tools/install_privacy_guard.py: a filled-in profile is refused, the template is not."""
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import install_privacy_guard as g  # noqa: E402


class PrivacyGuardTests(unittest.TestCase):
    def test_template_commit_passes(self):
        head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=g.REPO, capture_output=True, text=True).stdout.strip()
        if not head:
            self.skipTest("not a git checkout")
        self.assertEqual(g.profile_is_personal(head), [])

    def test_hook_calls_the_checker_and_honours_override(self):
        self.assertIn("--check", g.HOOK)
        self.assertIn("PRIVACY_GUARD_ALLOW", g.HOOK)
        self.assertTrue(g.HOOK.startswith("#!/bin/sh"))


if __name__ == "__main__":
    unittest.main()
