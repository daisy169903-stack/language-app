"""Synthetic tone fixtures test mechanics only, not Vietnamese speech or ASR accuracy."""
import base64
from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import wave

import numpy as np

from tools.audio_pipeline import pipeline as p


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="fixture-", dir=Path(__file__).parent)
        self.root = Path(self.temp.name)
        self.workspace = self.root / "private-workspace"
        self.audio = np.zeros(3 * p.SAMPLE_RATE, dtype=np.float32)
        for start, end in [(0.50, 0.90), (1.50, 1.90)]:
            count = int((end - start) * p.SAMPLE_RATE)
            self.audio[int(start * p.SAMPLE_RATE):int(start * p.SAMPLE_RATE) + count] = (
                0.1 * np.sin(np.arange(count) * 2 * np.pi * 440 / p.SAMPLE_RATE))
        self.source_file = self.root / "synthetic-tone-not-vietnamese.wav"
        p.write_wav(self.source_file, self.audio)
        self.source = p.import_source(self.workspace, self.source_file, "SYNTHETIC — not Vietnamese speech")
        self.transcript = self.root / "synthetic-timestamps.json"
        p.write_json(self.transcript, {"fixture": "synthetic, not ASR", "words": [
            {"word": "Chào!", "start": 0.5, "end": 0.9, "probability": 0.99},
            {"word": "chào", "start": 1.5, "end": 1.9, "probability": 0.6}]})
        p.transcribe(self.workspace, self.source["id"], transcript=self.transcript)
        self.requests = self.root / "requests.json"
        p.write_json(self.requests, [{"id": "greeting.chao", "text": "Chào"}])

    def tearDown(self):
        self.temp.cleanup()

    def extract(self):
        # Decode actual PCM samples from the synthetic WAV. No ASR is mocked or claimed.
        def decode_fixture(path):
            with wave.open(str(path), "rb") as audio:
                self.assertEqual(audio.getframerate(), p.SAMPLE_RATE)
                return np.frombuffer(audio.readframes(audio.getnframes()), dtype="<i2").astype(np.float32) / 32768
        with patch.object(p, "decode", side_effect=decode_fixture):
            return p.extract(self.workspace, self.source["id"], self.requests)["candidates"]

    def explicitly_approve_synthetic_fixture(self, candidate):
        # Exercise the explicit CLI review command, never an automatic quality shortcut.
        arguments = ["audio_pipeline", "--workspace", str(self.workspace), "approve",
                     "--candidate-id", candidate["candidateId"], "--reviewer", "Synthetic test reviewer",
                     "--confirm-text", "Chào", "--confirm-northern"]
        with patch("sys.argv", arguments), redirect_stdout(io.StringIO()):
            p.main()

    def test_matching_preserves_tones_normalizes_nfc_and_punctuation(self):
        words = [{"word": "Cảm,"}, {"word": "ơn!"}]
        self.assertEqual(p.find_matches(words, "Ca\u0309m ơn")[0][3], "exact")
        self.assertTrue(all(match[3] != "exact" for match in p.find_matches(words, "Cam on")))
        self.assertEqual(p.find_matches(words, "hoàn toàn khác"), [])

    def test_extract_real_wav_pending_ambiguous_and_conservative_trim(self):
        candidates = self.extract()
        self.assertEqual(len(candidates), 2)
        first = candidates[0]
        self.assertEqual(first["status"], "pending")
        self.assertFalse(first["selected"])
        self.assertIn("ambiguous-multiple-matches", first["flags"])
        self.assertIn("unknown-or-low-model-probability", candidates[1]["flags"])
        self.assertLessEqual(first["start"], 0.42)
        self.assertGreaterEqual(first["end"], 0.98)
        self.assertGreater(first["start"], 0.32)
        with wave.open(str(self.workspace / first["file"]), "rb") as clip:
            self.assertEqual(clip.getnchannels(), 1)
            self.assertEqual(clip.getsampwidth(), 2)
            self.assertAlmostEqual(clip.getnframes() / p.SAMPLE_RATE, first["end"] - first["start"], places=4)
        self.assertTrue((self.workspace / "review.html").exists())

    def test_approved_only_export_and_explicit_selection_reuses_logical_id(self):
        candidates = self.extract()
        output = self.root / "pack.json"
        self.assertEqual(p.export_pack(self.workspace, "private", output)["clips"], 0)
        with self.assertRaises(ValueError):
            p.approve(self.workspace, candidates[0]["candidateId"], "Test reviewer", "Chào", False)
        with self.assertRaises(ValueError):
            p.approve(self.workspace, candidates[0]["candidateId"], "Test reviewer", "Chao", True)
        self.explicitly_approve_synthetic_fixture(candidates[0])
        self.explicitly_approve_synthetic_fixture(candidates[1])
        self.assertEqual(p.export_pack(self.workspace, "private", output)["clips"], 1)
        pack = p.read_json(output)
        clip = pack["clips"][0]
        self.assertEqual(clip["id"], "greeting.chao")
        self.assertEqual(clip["sha256"], hashlib.sha256(base64.b64decode(clip["dataBase64"])).hexdigest())
        self.assertEqual(clip["source"]["accent"], "northern")
        self.assertNotIn(str(self.root), json.dumps(pack))
        review = p.read_json(self.workspace / "review.json")
        selected = [c for c in review["candidates"] if c["selected"]]
        self.assertEqual([c["candidateId"] for c in selected], [candidates[1]["candidateId"]])

    def test_public_export_refuses_private_and_does_not_overwrite_output(self):
        candidate = self.extract()[0]
        self.explicitly_approve_synthetic_fixture(candidate)
        output = self.root / "public.json"
        output.write_text("unchanged", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "private-study"):
            p.export_pack(self.workspace, "public", output)
        self.assertEqual(output.read_text(), "unchanged")
        source_path = p.source_dir(self.workspace, self.source["id"]) / "source.json"
        source = p.read_json(source_path)
        source["license"] = "publishable"  # fixture only: no real rights claim
        p.write_json(source_path, source)
        self.assertEqual(p.export_pack(self.workspace, "public", output)["clips"], 1)

    def test_review_pack_is_private_pending_and_contains_all_alternatives(self):
        candidates = self.extract()
        output = self.root / "review.vlaudio.json"
        p.export_review(self.workspace, output)
        pack = p.read_json(output)
        self.assertEqual(pack["kind"], "vietlingo-audio-review")
        self.assertEqual(pack["audience"], "private")
        self.assertEqual(len(pack["clips"]), 2)
        self.assertEqual(len({clip["candidateId"] for clip in pack["clips"]}), 2)
        self.assertTrue(all(clip["review"]["status"] == "pending" for clip in pack["clips"]))
        self.assertTrue(all(clip["source"]["accent"] == "unknown" for clip in pack["clips"]))
        self.assertEqual({clip["id"] for clip in pack["clips"]}, {"greeting.chao"})

    def test_invalid_timestamps_and_duplicate_ids_fail(self):
        with self.assertRaises(ValueError):
            p.validate_transcript({"words": [{"word": "hi", "start": 0, "end": float("nan")} ]})
        with self.assertRaises(ValueError):
            p.cut_audio(self.audio, 2.9, 4)
        with self.assertRaises(ValueError):
            p.source_dir(self.workspace, "../escape")
        p.write_json(self.requests, [{"id": "same", "text": "a"}, {"id": "same", "text": "b"}])
        with self.assertRaisesRegex(ValueError, "unique"):
            p.extract(self.workspace, self.source["id"], self.requests)

    def test_zero_duration_words_preserved_and_extracted_only_as_uncertain(self):
        p.write_json(self.transcript, {"words": [
            {"word": "Chào", "start": 0.5, "end": 0.5, "probability": 0.99},
            {"word": "chị", "start": 0.5, "end": 0.9, "probability": 0.99}]})
        data = p.transcribe(self.workspace, self.source["id"], transcript=self.transcript)
        self.assertEqual(len(data["words"]), 2)
        self.assertEqual(data["words"][0]["start"], data["words"][0]["end"])
        self.assertEqual(data["words"][0]["alignmentFlags"], ["zero-duration-alignment"])
        raw = p.read_json(p.source_dir(self.workspace, self.source["id"]) / "transcript.raw.json")
        self.assertEqual(raw["words"][0]["end"], 0.5)
        p.write_json(self.requests, [{"id": "greeting.chao", "text": "Chào"},
                                     {"id": "greeting.chao-chi", "text": "Chào chị"}])
        candidates = self.extract()
        self.assertEqual(len(candidates), 2)
        for candidate in candidates:
            self.assertEqual(candidate["status"], "pending")
            self.assertTrue(candidate["manualReviewRequired"])
            self.assertIn("zero-duration-alignment", candidate["flags"])

    def test_reversed_alignment_rejected_but_raw_input_retained(self):
        p.write_json(self.transcript, {"words": [{"word": "Chào", "start": 0.9, "end": 0.5}]})
        with self.assertRaisesRegex(ValueError, "nonnegative"):
            p.transcribe(self.workspace, self.source["id"], transcript=self.transcript)
        raw = p.read_json(p.source_dir(self.workspace, self.source["id"]) / "transcript.raw.json")
        self.assertEqual(raw["words"][0]["end"], 0.5)

    @unittest.skipUnless(importlib.util.find_spec("faster_whisper"), "Install pipeline requirements for PyAV integration")
    def test_pyav_decodes_and_extracts_synthetic_wav_without_ffmpeg_executable(self):
        decoded = p.decode(self.source_file)
        self.assertEqual(len(decoded), len(self.audio))
        np.testing.assert_allclose(decoded, self.audio, atol=0.0001)
        result = p.extract(self.workspace, self.source["id"], self.requests)
        self.assertEqual(len(result["candidates"]), 2)
        self.assertTrue(all(item["status"] == "pending" for item in result["candidates"]))


if __name__ == "__main__":
    unittest.main()
