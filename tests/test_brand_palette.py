"""Tests for tools/brand_palette.py: colour extraction and readable shades (offline)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
import brand_palette as bp  # noqa: E402


class PaletteTests(unittest.TestCase):
    def test_contrast_known_values(self):
        self.assertEqual(bp.contrast("#000000"), 21.0)
        self.assertEqual(bp.contrast("#FFFFFF"), 1.0)

    def test_pale_brand_colour_gets_darker_text_safe_shade(self):
        d = bp.describe("#FFCC00", "test")
        self.assertLess(d["contrast_on_white"], 4.5)
        self.assertGreaterEqual(bp.contrast(d["text_safe"]), 4.5)
        self.assertIn("text_safe", d["use"])

    def test_dark_brand_colour_is_kept(self):
        d = bp.describe("#003A70", "test")
        self.assertEqual(d["text_safe"], "#003A70")

    def test_candidates_prefer_theme_meta_and_skip_greys(self):
        html = '<meta name="theme-color" content="#E60012">'
        css = ":root{--brand-primary:#0070D1;--grey:#777777} a{color:#0070d1} b{color:#333}"
        found = [c["hex"] for c in bp.candidates(html, css)]
        self.assertEqual(found[:2], ["#E60012", "#0070D1"])
        self.assertNotIn("#777777", found)
        self.assertNotIn("#333333", found)

    def test_rgb_and_short_hex_normalise(self):
        self.assertEqual(bp.norm_hex("rgb(255, 0, 18)"), "#FF0012")
        self.assertEqual(bp.norm_hex("#0af"), "#00AAFF")

    def test_cli_hex_mode_runs_offline(self):
        self.assertEqual(bp.main(["--hex", "#FFCC00", "--json"]), 0)
        self.assertEqual(bp.main(["--hex", "nope"]), 2)


if __name__ == "__main__":
    unittest.main()
