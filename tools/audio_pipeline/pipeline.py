"""Local-only import, word search, extraction, explicit review, and pack export.

ASR probabilities are model outputs, not calibrated correctness estimates.
Every candidate requires listening and explicit human approval.
"""
from __future__ import annotations

import argparse
import base64
from datetime import datetime, timezone
from difflib import SequenceMatcher
import hashlib
import html
import json
import math
from pathlib import Path
import re
import shutil
import sys
import unicodedata
import uuid
import wave

import numpy as np

SAMPLE_RATE = 16000
ID_PATTERN = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$")


def now():
    return datetime.now(timezone.utc).isoformat()


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(path)


def checked_id(value):
    if not isinstance(value, str) or not ID_PATTERN.fullmatch(value):
        raise ValueError("IDs must use 1–128 ASCII letters, digits, dots, underscores or hyphens")
    return value


def source_dir(workspace, source_id):
    return Path(workspace) / "sources" / checked_id(source_id)


def tokens(text):
    # NFC and casefold preserve Vietnamese tone marks. Punctuation is a separator.
    return re.findall(r"[^\W_]+", unicodedata.normalize("NFC", text).casefold(), re.UNICODE)


def import_source(workspace, path, title, url="", license="private-study", accent="unknown"):
    path = Path(path).resolve(strict=True)
    if not path.is_file():
        raise ValueError("Import requires a local audio file")
    if license not in ("private-study", "publishable") or accent not in ("northern", "unknown"):
        raise ValueError("Unsupported source license or accent")
    source_id = "src-" + uuid.uuid4().hex[:16]
    target = source_dir(workspace, source_id)
    target.mkdir(parents=True)
    stored_name = "original" + path.suffix.lower()
    shutil.copyfile(path, target / stored_name)
    metadata = {"id": source_id, "title": title, "url": url, "license": license,
                "accent": accent, "file": stored_name, "importedAt": now(),
                "sha256": hashlib.sha256((target / stored_name).read_bytes()).hexdigest()}
    write_json(target / "source.json", metadata)
    return metadata


def validate_transcript(data):
    words = data.get("words") if isinstance(data, dict) else None
    if not isinstance(words, list) or not words:
        raise ValueError("Transcript must contain a nonempty words array")
    previous_start = -1.0
    result = []
    for word in words:
        start, end = float(word["start"]), float(word["end"])
        text = word.get("word", word.get("text"))
        probability = word.get("probability")
        if not isinstance(text, str) or not tokens(text):
            raise ValueError("Each timestamped word needs nonempty text")
        if not math.isfinite(start) or not math.isfinite(end) or start < 0 or end < start or start < previous_start:
            raise ValueError("Word timestamps must be finite, ordered and nonnegative duration")
        if probability is not None:
            probability = float(probability)
            if not math.isfinite(probability) or not 0 <= probability <= 1:
                raise ValueError("Word probability must be null or between 0 and 1")
        result.append({"word": text, "start": start, "end": end, "probability": probability,
                       "alignmentFlags": ["zero-duration-alignment"] if start == end else []})
        previous_start = start
    return {**data, "words": result, "manualReviewRequired": True}


def transcribe(workspace, source_id, model="small", transcript=None, allow_download=False):
    directory = source_dir(workspace, source_id)
    source = read_json(directory / "source.json")
    if transcript:
        data = {**read_json(transcript), "engine": "user-supplied-word-timestamps"}
    else:
        from faster_whisper import WhisperModel
        recognizer = WhisperModel(model, device="cpu", compute_type="int8",
                                  download_root=str(Path(workspace) / "models"),
                                  local_files_only=not allow_download)
        segments, info = recognizer.transcribe(str(directory / source["file"]), language="vi",
                                              word_timestamps=True, beam_size=5)
        words = [{"word": word.word, "start": word.start, "end": word.end,
                  "probability": word.probability}
                 for segment in segments for word in (segment.words or [])]
        data = {"words": words, "engine": "faster-whisper", "model": model,
                "language": "vi", "languageProbability": info.language_probability}
    data.update({"sourceId": source_id, "createdAt": now(),
                 "confidenceNote": "Raw model probability; not a calibrated correctness estimate."})
    # Save the unmodified alignment evidence before validation can fail. Zero-length
    # intervals are retained, never fabricated or dropped across a phrase boundary.
    write_json(directory / "transcript.raw.json", data)
    data = validate_transcript(data)
    write_json(directory / "transcript.json", data)
    return data


def decode(path):
    # PyAV is bundled with faster-whisper: no system ffmpeg executable is used.
    from faster_whisper.audio import decode_audio
    return decode_audio(str(path), sampling_rate=SAMPLE_RATE)


def cut_audio(audio, word_start, word_end, padding=0.18):
    """Trim silence only in added padding; never trim within the ASR word interval.

    Retain 60 ms outside detected activity and the full ASR interval plus 80 ms.
    Timestamp errors still require listening; no speech boundary is guaranteed.
    """
    duration = len(audio) / SAMPLE_RATE
    if word_start >= duration or word_end > duration + 0.05:
        raise ValueError("Transcript timestamps exceed source audio duration")
    start = max(0.0, word_start - padding)
    end = min(duration, word_end + padding)
    first, last = int(start * SAMPLE_RATE), min(len(audio), math.ceil(end * SAMPLE_RATE))
    section = audio[first:last]
    if not len(section):
        raise ValueError("Empty audio interval")
    # Low threshold avoids clipping quiet consonants. Only outer padding can be removed.
    threshold = min(0.001, max(float(np.max(np.abs(section))) * 0.005, 0.0001))
    active = np.flatnonzero(np.abs(section) > threshold)
    if len(active):
        start = min(word_start - 0.08, (first + int(active[0])) / SAMPLE_RATE - 0.06)
        end = max(word_end + 0.08, (first + int(active[-1]) + 1) / SAMPLE_RATE + 0.06)
        start, end = max(first / SAMPLE_RATE, start), min(last / SAMPLE_RATE, end)
    first, last = max(0, int(start * SAMPLE_RATE)), min(len(audio), math.ceil(end * SAMPLE_RATE))
    return audio[first:last], first / SAMPLE_RATE, last / SAMPLE_RATE


def write_wav(path, samples):
    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm.tobytes())


def find_matches(words, text):
    expanded = [(token, index) for index, word in enumerate(words) for token in tokens(word["word"])]
    wanted = tokens(text)
    if not wanted:
        raise ValueError("Requested text needs letters or digits")
    size = len(wanted)
    exact, fuzzy = [], []
    for offset in range(len(expanded) - size + 1):
        window = expanded[offset:offset + size]
        # Don't extract a substring of an ASR word containing multiple tokens.
        if offset and expanded[offset - 1][1] == window[0][1]:
            continue
        if offset + size < len(expanded) and expanded[offset + size][1] == window[-1][1]:
            continue
        actual = [entry[0] for entry in window]
        entry = (window[0][1], window[-1][1], 1.0)
        if actual == wanted:
            exact.append(entry)
        else:
            similarity = SequenceMatcher(None, " ".join(wanted), " ".join(actual)).ratio()
            if similarity >= 0.72:
                fuzzy.append((entry[0], entry[1], similarity))
    return [(a, b, score, "exact") for a, b, score in exact] if exact else [
        (a, b, score, "fuzzy-suggestion") for a, b, score in sorted(fuzzy, key=lambda x: -x[2])[:3]]


def extract(workspace, source_id, requests_path):
    directory = source_dir(workspace, source_id)
    source = read_json(directory / "source.json")
    words = validate_transcript(read_json(directory / "transcript.json"))["words"]
    requests = read_json(requests_path)
    if not isinstance(requests, list) or not requests:
        raise ValueError("Requests must be a nonempty array of {id, text}")
    ids = [checked_id(request["id"]) for request in requests]
    if len(ids) != len(set(ids)):
        raise ValueError("Request IDs must be unique")
    audio = decode(directory / source["file"])
    review_path = Path(workspace) / "review.json"
    review = read_json(review_path) if review_path.exists() else {"version": 1, "candidates": [], "unmatched": []}
    added, unmatched = [], []
    for request in requests:
        matches = find_matches(words, request["text"])
        if not matches:
            unmatched.append({**request, "sourceId": source_id, "status": "not-found"})
        for first, last, score, kind in matches:
            relevant = words[first:last + 1]
            probabilities = [word["probability"] for word in relevant]
            confidence = min(probabilities) if all(p is not None for p in probabilities) else None
            flags = ["manual-listening-required"]
            if any(word["start"] == word["end"] for word in relevant):
                flags.append("zero-duration-alignment")
            if len(matches) > 1:
                flags.append("ambiguous-multiple-matches")
            if kind != "exact":
                flags.append("fuzzy-text-mismatch")
            if confidence is None or confidence < 0.8:
                flags.append("unknown-or-low-model-probability")
            if source["accent"] != "northern":
                flags.append("accent-unverified")
            if any(right["start"] - left["end"] > 0.7 for left, right in zip(relevant, relevant[1:])):
                flags.append("long-gap-between-words")
            samples, start, end = cut_audio(audio, relevant[0]["start"], relevant[-1]["end"])
            candidate_id = "clip-" + uuid.uuid4().hex[:16]
            clip_path = Path(workspace) / "clips" / (candidate_id + ".wav")
            clip_path.parent.mkdir(parents=True, exist_ok=True)
            write_wav(clip_path, samples)
            added.append({"candidateId": candidate_id, "id": request["id"], "text": request["text"],
                          "recognizedText": " ".join(word["word"].strip() for word in relevant),
                          "sourceId": source_id, "file": str(clip_path.relative_to(workspace)),
                          "start": start, "end": end, "wordStart": relevant[0]["start"],
                          "wordEnd": relevant[-1]["end"], "match": kind, "similarity": score,
                          "modelProbabilityMinimum": confidence, "flags": flags,
                          "status": "pending", "selected": False, "manualReviewRequired": True,
                          "createdAt": now()})
    review["candidates"].extend(added)
    review["unmatched"].extend(unmatched)
    write_json(review_path, review)
    review_html(workspace, review)
    return {"candidates": added, "unmatched": unmatched}


def review_html(workspace, review):
    escape = lambda value: html.escape(str(value), quote=True)
    rows = []
    for item in review["candidates"]:
        source = read_json(source_dir(workspace, item["sourceId"]) / "source.json")
        rows.append(f'<article><h2>{escape(item["id"])} — {escape(item["text"])}</h2>'
                    f'<p>{escape(item["candidateId"])} | {escape(item["status"])} | '
                    f'{escape(source["title"])} | {escape(source["license"])}</p>'
                    f'<p>ASR: {escape(item["recognizedText"])} | raw minimum probability: '
                    f'{escape(item["modelProbabilityMinimum"])} | {escape(", ".join(item["flags"]))}</p>'
                    f'<audio controls preload="none" src="{escape(Path(item["file"]).as_posix())}"></audio>'
                    f'<details><summary>Original source ({item["start"]:.2f}–{item["end"]:.2f}s)</summary>'
                    f'<audio controls preload="none" src="sources/{escape(source["id"])}/{escape(source["file"])}#t={item["start"]:.3f},{item["end"]:.3f}"></audio></details></article>')
    (Path(workspace) / "review.html").write_text(
        '<!doctype html><html lang="hu"><meta charset="utf-8"><title>Hangjelöltek ellenőrzése</title>'
        '<meta name="viewport" content="width=device-width"><style>body{font:16px system-ui;max-width:900px;margin:2rem auto;padding:1rem}article{border-top:1px solid #aaa;padding:1rem 0}audio{width:100%}</style>'
        '<h1>Hangjelöltek — kézi ellenőrzés szükséges</h1><p>Hallgasd meg a teljes kiejtést, szöveget és az északi nyelvjárást. '
        'A gépi valószínűség nem pontossági garancia. Jóváhagyás csak a CLI approve paranccsal.</p>'
        + "".join(rows) + '</html>', encoding="utf-8")


def approve(workspace, candidate_id, reviewer, confirm_text, confirm_northern):
    if not reviewer.strip() or not confirm_northern:
        raise ValueError("A reviewer and explicit northern-accent confirmation are required")
    review_path = Path(workspace) / "review.json"
    review = read_json(review_path)
    item = next((c for c in review["candidates"] if c["candidateId"] == candidate_id), None)
    if item is None:
        raise ValueError("Unknown candidate ID")
    if unicodedata.normalize("NFC", confirm_text).strip() != unicodedata.normalize("NFC", item["text"]).strip():
        raise ValueError("--confirm-text must repeat the requested Vietnamese text exactly")
    for candidate in review["candidates"]:
        if candidate["id"] == item["id"]:
            candidate["selected"] = False
    item.update({"status": "approved", "selected": True, "manualReviewRequired": False,
                 "review": {"status": "approved", "reviewer": reviewer.strip(), "reviewedAt": now(),
                            "confirmedText": confirm_text, "accent": "northern", "method": "human-listening"}})
    write_json(review_path, review)
    review_html(workspace, review)
    return item


def export_pack(workspace, audience, output):
    if audience not in ("private", "public"):
        raise ValueError("Audience must be private or public")
    review = read_json(Path(workspace) / "review.json")
    clips = []
    selected = [item for item in review["candidates"] if item.get("selected")]
    if len({item["id"] for item in selected}) != len(selected):
        raise ValueError("Multiple selected recordings for one logical ID")
    for item in selected:
        if item["status"] != "approved" or item.get("manualReviewRequired", True):
            continue
        approval = item.get("review", {})
        if approval.get("status") != "approved" or approval.get("accent") != "northern":
            raise ValueError("Selected candidate lacks northern human review")
        source = read_json(source_dir(workspace, item["sourceId"]) / "source.json")
        if audience == "public" and source["license"] != "publishable":
            raise ValueError(f'Public export refused: {item["id"]} is private-study')
        audio = (Path(workspace) / item["file"]).read_bytes()
        clips.append({"id": item["id"], "text": item["text"], "mimeType": "audio/wav",
                      "dataBase64": base64.b64encode(audio).decode("ascii"),
                      "sha256": hashlib.sha256(audio).hexdigest(),
                      "source": {"title": source["title"], "url": source["url"],
                                 "license": source["license"], "accent": "northern"},
                      "review": {key: approval[key] for key in ("status", "reviewer", "reviewedAt")}})
    pack = {"version": 1, "kind": "vietlingo-audio-pack", "audience": audience, "clips": clips}
    write_json(output, pack)
    return {"output": str(output), "clips": len(clips), "audience": audience}


def export_review(workspace, output):
    """Portable private candidates for explicit review on another local device."""
    review = read_json(Path(workspace) / "review.json")
    clips = []
    for item in review["candidates"]:
        if item["status"] != "pending":
            continue
        source = read_json(source_dir(workspace, item["sourceId"]) / "source.json")
        audio = (Path(workspace) / item["file"]).read_bytes()
        clips.append({"id": item["id"], "text": item["text"], "mimeType": "audio/wav",
                      "dataBase64": base64.b64encode(audio).decode("ascii"),
                      "sha256": hashlib.sha256(audio).hexdigest(), "candidateId": item["candidateId"],
                      "confidence": item["modelProbabilityMinimum"], "flags": item["flags"],
                      "source": {key: source[key] for key in ("title", "url", "license", "accent")},
                      "review": {"status": "pending"}})
    write_json(output, {"version": 1, "kind": "vietlingo-audio-review", "audience": "private", "clips": clips})
    return {"output": str(output), "candidates": len(clips), "audience": "private"}


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace", type=Path, default=Path("private-audio/workspace"))
    commands = parser.add_subparsers(dest="command", required=True)
    imp = commands.add_parser("import", help="Copy a local source file; URLs are provenance only")
    imp.add_argument("path", type=Path)
    imp.add_argument("--title", required=True)
    imp.add_argument("--source-url", default="")
    imp.add_argument("--license", choices=["private-study", "publishable"], default="private-study")
    imp.add_argument("--accent", choices=["northern", "unknown"], default="unknown")
    tr = commands.add_parser("transcribe")
    tr.add_argument("--source-id", required=True)
    tr.add_argument("--model", default="small")
    tr.add_argument("--transcript", type=Path, help="Import existing word timestamps instead of running ASR")
    tr.add_argument("--allow-model-download", action="store_true", help="Explicitly allow model download to workspace/models")
    ext = commands.add_parser("extract")
    ext.add_argument("--source-id", required=True)
    ext.add_argument("--requests", type=Path, required=True)
    app = commands.add_parser("approve", help="Confirm listening, exact text and northern pronunciation; select this recording")
    app.add_argument("--candidate-id", required=True)
    app.add_argument("--reviewer", required=True)
    app.add_argument("--confirm-text", required=True)
    app.add_argument("--confirm-northern", action="store_true", required=True)
    exp = commands.add_parser("export")
    exp.add_argument("--audience", choices=["private", "public"], required=True)
    exp.add_argument("--output", type=Path, required=True)
    rev = commands.add_parser("export-review", help="Export private pending candidates for explicit review on a device")
    rev.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "import":
            result = import_source(args.workspace, args.path, args.title, args.source_url, args.license, args.accent)
        elif args.command == "transcribe":
            data = transcribe(args.workspace, args.source_id, args.model, args.transcript, args.allow_model_download)
            result = {"sourceId": args.source_id, "wordCount": len(data["words"]), "engine": data["engine"]}
        elif args.command == "extract":
            result = extract(args.workspace, args.source_id, args.requests)
        elif args.command == "approve":
            result = approve(args.workspace, args.candidate_id, args.reviewer, args.confirm_text, args.confirm_northern)
        elif args.command == "export-review":
            result = export_review(args.workspace, args.output)
        else:
            result = export_pack(args.workspace, args.audience, args.output)
    except (ValueError, OSError, KeyError, ImportError) as error:
        parser.exit(2, f"Error: {error}\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))
