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

API = "https://newport-aquarium-r2-api.vercel.app/api"
GALLERY = API + "/gallery"
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


def playback_sources(item):
    """Get fresh signed URLs immediately before FFmpeg opens each missing clip.

    The gallery listing is paginated and its object links can expire while
    thumbnails for previous uploads are being processed.
    """
    sources = []
    try:
        key = urllib.parse.quote(item["id"], safe="")
        req = urllib.request.Request(API + "/share?id=" + key,
                                     headers={"User-Agent": "NewportPosterGenerator/2.0"})
        with urllib.request.urlopen(req, timeout=45) as response:
            shared = json.load(response)
        # Prefer the Chrome-compatible copy when available, but keep the
        # untouched iPhone original as a fallback for odd short/edited clips.
        for candidate in (shared.get("url"), shared.get("originalUrl")):
            if candidate and candidate.startswith("https://") and candidate not in sources:
                sources.append(candidate)
    except Exception as exc:
        print("Could not refresh media URL for", item.get("name"),
              type(exc).__name__, flush=True)
    fallback = item.get("url", "")
    if fallback.startswith("https://") and fallback not in sources:
        sources.append(fallback)
    return sources


def generate(item):
    target = OUT / poster_name(item)
    if target.exists() and target.stat().st_size > 1000:
        return "exists"
    target.unlink(missing_ok=True)
    sources = playback_sources(item)
    if not sources:
        print("No source URL supplied for", item.get("name"), flush=True)
        return "failed"
    for video_url in sources:
        # Seek from the beginning for tiny clips; try a later frame when
        # a photo/video starts with a black opening frame.
        for position, seek_before_input in (
            ("00:00:00.250", True),
            ("00:00:01.000", True),
            ("00:00:00.000", True),
            ("00:00:00.100", False),
        ):
            input_options = (["-ss", position, "-i", video_url]
                             if seek_before_input else ["-i", video_url, "-ss", position])
            cmd = [
                "ffmpeg", "-hide_banner", "-nostdin", "-loglevel", "error",
                "-y", "-rw_timeout", "30000000", *input_options,
                "-map", "0:v:0", "-an", "-sn", "-frames:v", "1", "-vf",
                "scale=640:640:force_original_aspect_ratio=decrease",
                "-q:v", "3", "-update", "1", str(target),
            ]
            try:
                run = subprocess.run(cmd, capture_output=True, text=True, timeout=100)
            except subprocess.TimeoutExpired:
                print("Frame extraction timeout for", item.get("name"), position, flush=True)
                target.unlink(missing_ok=True)
                continue
            if run.returncode == 0 and target.exists() and target.stat().st_size > 1000:
                return "created"
            target.unlink(missing_ok=True)
            # Do not print signed R2 query strings, tokens, or download URLs.
            print("Frame attempt failed for", item.get("name"), position,
                  "ffmpeg exit", run.returncode, flush=True)
    return "failed"


def main():
    items = gallery()
    # Newly uploaded and failed videos always go first; never require a
    # manually maintained filename list to see their thumbnails.
    def sort_key(item):
        target = OUT / poster_name(item)
        missing = not target.exists() or target.stat().st_size <= 1000
        return (0 if missing else 1, -int(item.get("createdAt") or 0), item.get("name", ""))
    items.sort(key=sort_key)
    missing = sum(sort_key(item)[0] == 0 for item in items)
    print(f"Discovered {len(items)} videos; {missing} thumbnails missing.", flush=True)
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
    # Any missing files are retried automatically on the next scheduled run.
    if failures:
        print("Some originals could not be decoded; successful posters will still be published.", flush=True)


if __name__ == "__main__":
    main()
