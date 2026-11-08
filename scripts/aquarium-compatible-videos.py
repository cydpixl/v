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
from datetime import datetime, timezone
import urllib.error
import urllib.parse
import urllib.request

API = "https://newport-aquarium-r2-api.vercel.app/api"
AUDIENCE = "newport-aquarium-compatible-video-upload"
MAX_PER_RUN = int(os.environ.get("MAX_VIDEOS", "6"))
MAX_ENCODE_SECONDS = int(os.environ.get("MAX_ENCODE_SECONDS", "480"))
MAX_ATTEMPTS = int(os.environ.get("MAX_ATTEMPTS", "10"))
REPORT = pathlib.Path("reports/aquarium-chrome-status.json")


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
    priority_names = ("IMG_3134.MOV", "IMG_3125.MOV")
    preferred = []
    for name in priority_names:
        preferred.extend(m for m in items if m.get("name", "").upper() == name)
    prioritized_ids = {m.get("id") for m in preferred}
    remaining = [m for m in items if m.get("id") not in prioritized_ids]
    remaining.sort(key=lambda m: (int(m.get("size") or 0), str(m.get("name"))))
    # A single batch should not get stuck retrying the same early failures forever.
    # The scheduled workflow rotates its remaining queue on each run.
    if remaining:
        offset = (max(0, int(os.environ.get("GITHUB_RUN_NUMBER", "1")) - 1) * MAX_ATTEMPTS) % len(remaining)
        remaining = remaining[offset:] + remaining[:offset]
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
    scale = "scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,format=yuv420p"
    # iPhone edited IMG_E...MOV files can contain an "audio/none" track.
    # Map only decodable audio streams; never synthesize audio.
    probe = subprocess.run([
        "ffprobe", "-v", "error", "-rw_timeout", "30000000",
        "-show_entries", "stream=index,codec_name,codec_type", "-of", "json", url
    ], capture_output=True, text=True, timeout=60)
    try:
        streams = json.loads(probe.stdout or "{}").get("streams", [])
    except ValueError:
        streams = []
    valid_audio = next((stream for stream in streams
                        if stream.get("codec_type") == "audio"
                        and stream.get("codec_name") not in ("none", "unknown", None, "")), None)
    audio_map = ["-map", "0:" + str(valid_audio["index"])] if valid_audio else []
    cmd = [
        "ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-rw_timeout", "30000000", "-i", url,
        "-map", "0:v:0", *audio_map,
        "-vf", scale, "-r", "30",
        "-c:v", "libx264", "-preset", "superfast", "-crf", "25",
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


def write_report(data):
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    data["checkedAt"] = datetime.now(timezone.utc).isoformat()
    data["runNumber"] = os.environ.get("GITHUB_RUN_NUMBER", "")
    REPORT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main():
    audit = {"videos": 0, "alreadyReady": 0, "converted": 0,
             "failed": 0, "unprocessed": 0, "items": [],
             "priority": "IMG_3134.MOV"}
    try:
        videos = all_videos()
        audit["videos"] = len(videos)
        print("Gallery videos:", len(videos),
              "max conversion attempts:", MAX_ATTEMPTS, flush=True)
        if not videos:
            return

        # Check all gallery videos, not only the first page or first failure batch.
        pending = []
        for item in videos:
            name = str(item.get("name") or "Unknown video")
            try:
                details = share(item)
                if details.get("browserReady"):
                    audit["alreadyReady"] += 1
                    audit["items"].append({"name": name, "status": "ready"})
                else:
                    pending.append(item)
            except Exception as exc:
                print("Share lookup failed:", name, type(exc).__name__, flush=True)
                audit["items"].append({"name": name, "status": "lookup-failed",
                                       "errorType": type(exc).__name__})
                audit["failed"] += 1

        print("Already Chrome-ready:", audit["alreadyReady"],
              "not yet ready:", len(pending), flush=True)
        if not pending:
            return

        for index, item in enumerate(pending):
            name = str(item.get("name") or "Unknown video")
            if index >= MAX_ATTEMPTS or audit["converted"] >= MAX_PER_RUN:
                audit["unprocessed"] += 1
                audit["items"].append({"name": name, "status": "queued"})
                continue
            try:
                # Refresh the media URL immediately before downloading; signatures expire.
                details = share(item)
                if details.get("browserReady"):
                    audit["alreadyReady"] += 1
                    audit["items"].append({"name": name, "status": "ready"})
                    continue
                original_url = details.get("originalUrl") or details.get("url")
                if not original_url or not original_url.startswith("https://"):
                    raise RuntimeError("No playable original-video URL was supplied")
                print("Converting", name, "original MB:",
                      round(item.get("size", 0) / 1e6, 1), flush=True)
                with tempfile.TemporaryDirectory(prefix="newport-video-") as directory:
                    target = pathlib.Path(directory) / "chrome.mp4"
                    size, audio_tracks = encode(item, original_url, target)
                    # GitHub OIDC identities expire quickly. A token acquired before
                    # FFmpeg encoding a large MOV can expire mid-conversion.
                    # Acquire a fresh token only AFTER the MP4 is ready to upload.
                    fresh_token = workflow_identity()
                    signed = get_json(API + "/encode",
                                      headers={"Authorization": "Bearer " + fresh_token},
                                      payload={"key": item["id"]})
                    if not signed.get("ready"):
                        if not signed.get("putUrl"):
                            raise RuntimeError("Upload gateway did not issue a signed R2 URL")
                        put(target, signed["putUrl"])
                    after = share(item)
                    if not after.get("browserReady"):
                        raise RuntimeError("R2 did not confirm converted video")
                audit["converted"] += 1
                audit["items"].append({"name": name, "status": "converted",
                                       "mp4Bytes": size, "audioTracks": audio_tracks})
                print("DONE", name, "H.264/AAC MP4 MB:", round(size / 1e6, 1),
                      "source audio tracks:", audio_tracks, flush=True)
            except Exception as exc:
                audit["failed"] += 1
                # Do not log any signed URL, upload token, or FFmpeg command.
                reason = re.sub(r"https?://\\S+", "[signed URL]", str(exc))
                reason = re.sub(r"(?i)(bearer\\s+|x-amz-[a-z-]+=)\\S+",
                                "[authorization redacted]", reason)[:240]
                audit["items"].append({"name": name, "status": "conversion-failed",
                                       "errorType": type(exc).__name__, "reason": reason})
                print("CONVERSION ERROR", name, type(exc).__name__, reason, flush=True)
        print("CHROME AUDIT:", audit["videos"], "total,",
              audit["alreadyReady"] + audit["converted"], "ready,",
              audit["failed"], "errors,", audit["unprocessed"], "queued", flush=True)
    except Exception as exc:
        audit["workflowError"] = type(exc).__name__
        print("Video inventory error:", type(exc).__name__, str(exc)[:160], flush=True)
    finally:
        write_report(audit)


if __name__ == "__main__":
    main()
