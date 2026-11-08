#!/usr/bin/env python3
"""Prepare browser-compatible H.264/AAC MP4 playback copies in private Cloudflare R2.

Original files are never overwritten. The R2 upload is authorized by a signed
GitHub Actions OIDC identity tied to this repository's main-branch workflow.
No permanent R2 credentials or signed media URLs are placed in GitHub.
"""
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

API = "https://newport-aquarium-r2-api.vercel.app/api"
AUDIENCE = "newport-aquarium-compatible-video-upload"
MAX_PER_RUN = int(os.environ.get("MAX_VIDEOS", "6"))
MAX_ENCODE_SECONDS = int(os.environ.get("MAX_ENCODE_SECONDS", "780"))


def get_json(url, headers=None, payload=None, timeout=45):
    if payload is not None:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                     headers={"Content-Type": "application/json", **(headers or {})}, method="POST")
    else:
        req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.load(response)


def all_videos():
    token = ""
    items = []
    for _ in range(250):
        query = "?nextToken=" + urllib.parse.quote(token, safe="") if token else ""
        data = get_json(API + "/gallery" + query)
        items.extend(m for m in data.get("items", ()) if m.get("kind") == "video")
        token = data.get("nextToken") or ""
        if not token:
            break
    preferred = [m for m in items if m.get("name") == "IMG_3251.MOV"]
    remaining = [m for m in items if m.get("name") != "IMG_3251.MOV"]
    remaining.sort(key=lambda m: (int(m.get("size") or 0), str(m.get("name"))))
    return preferred + remaining


def workflow_identity():
    request_url = os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"]
    request_token = os.environ["ACTIONS_ID_TOKEN_REQUEST_TOKEN"]
    suffix = "&" if "?" in request_url else "?"
    data = get_json(request_url + suffix + "audience=" + urllib.parse.quote(AUDIENCE),
                    headers={"Authorization": "bearer " + request_token})
    token = data.get("value")
    if not token:
        raise RuntimeError("GitHub did not issue a workflow identity token")
    return token


def share(item):
    return get_json(API + "/share?id=" + urllib.parse.quote(item["id"], safe=""))


def encode(item, url, target):
    scale = "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p"
    # Keep original audio if available. Never synthesize an audio track.
    cmd = [
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-rw_timeout", "30000000", "-i", url,
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", scale, "-r", "30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
        "-pix_fmt", "yuv420p", "-profile:v", "high", "-level:v", "4.1",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", "-max_muxing_queue_size", "1024",
        str(target),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=MAX_ENCODE_SECONDS)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError("Encoding timed out") from error
    if result.returncode != 0 or not target.exists() or target.stat().st_size < 1024:
        # Do not log signed links appearing in ffmpeg stderr.
        cleaned = re.sub(r"https?://\S+", "[signed-video-url]", result.stderr or "")
        cleaned = re.sub(r"X-Amz-\S+", "[signed-field]", cleaned)
        raise RuntimeError("FFmpeg exit " + str(result.returncode) + ": " + cleaned[-500:])
    inspection = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries",
        "stream=codec_name,codec_type", "-of", "json", str(target)
    ], capture_output=True, text=True, timeout=25, check=True)
    streams = json.loads(inspection.stdout).get("streams", [])
    video = [s["codec_name"] for s in streams if s.get("codec_type") == "video"]
    audio = [s["codec_name"] for s in streams if s.get("codec_type") == "audio"]
    if video != ["h264"] or any(codec != "aac" for codec in audio):
        raise RuntimeError("Converted output failed H.264/AAC inspection")
    return target.stat().st_size, len(audio)


def put(file, signed):
    # This upload is server-to-server. It does not require browser CORS permission.
    cmd = [
        "curl", "--fail-with-body", "--silent", "--show-error",
        "--retry", "3", "--retry-all-errors", "--retry-delay", "2",
        "--max-time", "1500", "--upload-file", str(file),
        "--header", "Content-Type: video/mp4",
        "--header", "Cache-Control: private, max-age=3600",
        signed,
    ]
    try:
        result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=1550)
    except subprocess.TimeoutExpired as error:
        raise RuntimeError("Upload timed out") from error
    if result.returncode:
        raise RuntimeError("R2 rejected the compatible MP4 upload (curl " + str(result.returncode) + ")")


def main():
    videos = all_videos()
    print("Gallery videos:", len(videos), "per-run conversion limit:", MAX_PER_RUN, flush=True)
    if not videos:
        return
    token = workflow_identity()
    converted = 0
    skipped = 0
    failures = []
    attempted = 0
    for item in videos:
        try:
            details = share(item)
            if details.get("browserReady"):
                skipped += 1
                continue
            attempted += 1
            if attempted > 26:
                break
            print("Converting", item["name"], "original MB:", round(item.get("size", 0) / 1e6, 1), flush=True)
            with tempfile.TemporaryDirectory(prefix="newport-video-") as directory:
                target = pathlib.Path(directory) / "chrome.mp4"
                size, audio_tracks = encode(item, details.get("originalUrl") or details["url"], target)
                signed = get_json(API + "/encode",
                                  headers={"Authorization": "Bearer " + token},
                                  payload={"key": item["id"]})
                if not signed.get("ready"):
                    if not signed.get("putUrl"):
                        raise RuntimeError("The upload gateway did not return a signed upload")
                    put(target, signed["putUrl"])
                after = share(item)
                if not after.get("browserReady"):
                    raise RuntimeError("R2 could not verify the converted playback copy")
            converted += 1
            print("DONE", item["name"], "compatible MP4 MB:", round(size / 1e6, 1),
                  "source audio tracks kept:", audio_tracks, flush=True)
            if converted >= MAX_PER_RUN:
                break
        except Exception as error:
            failures.append((item.get("name", "(unknown)"), type(error).__name__, str(error)[:120]))
            print("CONVERSION ERROR", item.get("name"), type(error).__name__, str(error)[:100], flush=True)
            if len(failures) >= 13:
                break
    print("SUMMARY newly converted:", converted, "already ready:", skipped, "errors:", len(failures), flush=True)
    for file, kind, reason in failures:
        print("Failed:", file, kind, reason, flush=True)
    if failures and converted == 0:
        raise SystemExit("No video conversions succeeded; inspect conversion errors")


if __name__ == "__main__":
    main()
