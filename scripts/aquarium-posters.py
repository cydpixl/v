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
    for position in ("00:00:01.000", "00:00:00.100", "00:00:00.000"):
        cmd = [
            "ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error",
            "-y", "-ss", position, "-i", video_url,
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
    print(f"Discovered {len(items)} videos", flush=True)
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
    if failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
