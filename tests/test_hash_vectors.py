import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "docs" / "examples" / "python"))
from payway_hash import payway_hash  # noqa: E402

VECTORS = json.loads((ROOT / "test-vectors" / "hash.json").read_text(encoding="utf-8"))


class HashVectors(unittest.TestCase):
    def test_vectors(self):
        for v in VECTORS:
            with self.subTest(v["name"]):
                self.assertEqual(payway_hash(v["values"], v["api_key"]), v["expected"])

    def test_none_is_empty(self):
        self.assertEqual(payway_hash(["a", None, "b"], "k"), payway_hash(["a", "", "b"], "k"))


if __name__ == "__main__":
    unittest.main()
