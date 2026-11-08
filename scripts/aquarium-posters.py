#!/usr/bin/env python3
"""Generate real, static thumbnails from R2 visitor MOV/MP4 clips.

Uses signed read URLs supplied by the existing, private R2 API. This script
never receives R2 access keys and does not change original visitor videos.
"""
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.parse
import urllib.request

GALLERY = "https://newport-aquarium-r2-api.vercel.app/api/gallery"
OUT = pathlib.Path("aquarium/public/posters")
OUT.mkdir(parents=True, exist_ok=True)
# Only these three newly uploaded videos currently lack their real-frame posters.
# Existing posters are reused and the video's original filename is unchanged.
PRIORITY_POSTERS = (
    "1794117754505-05afc4da195e-IMG_3231.MOV.jpg",
    "1794116603842-7cba5f9634ad-IMG_3138.MOV.jpg",
    "1794116202582-6f5efecb755b-IMG_3165.MOV.jpg",
)


def gallery():
    token = ""
    videos = []
    for _ in range(300):
        url = GALLERY + ("?nextToken=" + urllib.parse.quote(token, safe="") if token else "")
        req = urllib.request.Request(url, headers={"User-Agent": "NewportArchivePosterGenerator/1.0"})
        with urllib.request.urlopen(req, timeout=35) as response:
            data = json.load(response)
        videos.extend(item for item in data.get("items", []) if item.get("kind") == "video")
        token = data.get("nextToken") or ""
        if not token:
            break
    return videos


def poster_name(item):
    object_name = item["id"].split("/")[-1]
    if not object_name or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-" for c in object_name):
        raise ValueError("Unsafe R2 media object name")
    return object_name + ".jpg"


def generate(item):
    target = OUT / poster_name(item)
    if target.exists() and target.stat().st_size > 1000:
        return "exists"
    video_url = item["url"]
    # FFmpeg reads only the necessary video bytes through HTTP range requests.
    # The "thumbnail" filter selects a representative frame in a short sample.
    for position, seek_before_input in (
        ("00:00:01.000", True),
        ("00:00:00.100", True),
        ("00:00:00.000", True),
        ("00:00:00.150", False),
    ):
        input_options = (["-ss", position, "-i", video_url]
                         if seek_before_input else ["-i", video_url, "-ss", position])
        cmd = [
            "ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error",
            "-y", "-rw_timeout", "30000000", *input_options,
            "-frames:v", "1", "-vf",
            "scale=640:640:force_original_aspect_ratio=decrease",
            "-q:v", "4", "-update", "1",
            str(target)
        ]
        try:
            run = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        except subprocess.TimeoutExpired:
            print("Frame extraction timeout for", item["name"], flush=True)
            continue
        if run.returncode == 0 and target.exists() and target.stat().st_size > 1000:
            return "created"
        target.unlink(missing_ok=True)
        print("Frame extraction attempt failed for", item["name"], position,
              run.stderr[-180:].replace(video_url, "[signed-url]"), flush=True)
    return "failed"


def main():
    items = gallery()
    priority = {name: i for i, name in enumerate(PRIORITY_POSTERS)}
    items.sort(key=lambda item: (0, priority[poster_name(item)]) if poster_name(item) in priority else (1, item.get("name", "")))
    print(f"Discovered {len(items)} videos. Prioritizing three missing posters.", flush=True)
    made = skipped = failures = 0
    for index, item in enumerate(items, start=1):
        try:
            status = generate(item)
        except Exception as exc:
            print("Poster error:", item.get("name"), type(exc).__name__, flush=True)
            status = "failed"
        if status == "created":
            made += 1
        elif status == "exists":
            skipped += 1
        else:
            failures += 1
        print(f"{index}/{len(items)} {item['name']}: {status}", flush=True)
    print(f"POSTER RESULTS generated={made} previously={skipped} failed={failures}", flush=True)
    # Preserve successfully generated posters even if a different video fails.
    # The workflow verifies the three requested files after uploading the generated images.
    if failures:
        print("Some originals could not be decoded; successful posters will still be published.", flush=True)


if __name__ == "__main__":
    main()
