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
MAX_ATTEMPTS = int(os.environ.get("MAX_ATTEMPTS", "20"))
SHARD_INDEX = int(os.environ.get("VIDEO_SHARD_INDEX", "0"))
SHARD_COUNT = max(1, int(os.environ.get("VIDEO_SHARD_COUNT", "1")))
REPORT = pathlib.Path("reports/aquarium-chrome-status" +
                      ("-" + str(SHARD_INDEX) if SHARD_COUNT > 1 else "") + ".json")


def get_json(url, headers=None, payload=None, timeout=45):
    if payload is not None:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                     headers={"Content-Type": "application/json", **(headers or {})}, method="POST")
    else:
        req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.load(response)


def all_media():
    token = ""
    seen_tokens = set()
    items = []
    for page in range(500):
        query = "?nextToken=" + urllib.parse.quote(token, safe="") if token else ""
        data = get_json(API + "/gallery" + query)
        values = data.get("items")
        if not isinstance(values, list):
            raise RuntimeError("Gallery returned invalid media inventory")
        items.extend(m for m in values if isinstance(m, dict) and m.get("id"))
        token = data.get("nextToken") or ""
        if not token:
            return items, page + 1
        if token in seen_tokens:
            raise RuntimeError("Gallery pagination repeated its continuation token")
        seen_tokens.add(token)
    raise RuntimeError("Gallery exceeded 500 pages; audit not complete")


def all_videos():
    items, pages = all_media()
    unique = {}
    for item in items:
        if item.get("kind") == "video":
            unique[item["id"]] = item
    videos = sorted(unique.values(), key=lambda m: (int(m.get("size") or 0), m["id"]))
    return videos, len(items), pages



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
    audit = {"videos": 0, "mediaTotal": 0, "galleryPages": 0,
             "alreadyReady": 0, "converted": 0, "failed": 0,
             "unprocessed": 0, "items": [],
             "shard": SHARD_INDEX, "shardCount": SHARD_COUNT}
    try:
        videos, media_total, pages = all_videos()
        audit["videos"] = len(videos)
        audit["mediaTotal"] = media_total
        audit["galleryPages"] = pages
        print("Gallery:", media_total, "total,", len(videos), "videos,",
              pages, "pages, worker", SHARD_INDEX, "of", SHARD_COUNT, flush=True)
        pending = []
        for item in videos:
            name = str(item.get("name") or "Unknown video")
            try:
                details = share(item)
                if details.get("browserReady"):
                    audit["alreadyReady"] += 1
                    audit["items"].append({"id": item["id"], "name": name, "status": "ready"})
                else:
                    pending.append(item)
            except Exception as exc:
                print("Video lookup error", name, type(exc).__name__, flush=True)
                # All shards report their own errors, keyed by distinct object ID.
                audit["items"].append({"id": item["id"], "name": name,
                                       "status": "lookup-failed", "errorType": type(exc).__name__})
                audit["failed"] += 1

        # Parallel Actions runners each own a deterministic subset of pending IDs.
        # No two runners will transcode or upload the same object in this run.
        assigned = [item for index, item in enumerate(pending)
                    if index % SHARD_COUNT == SHARD_INDEX]
        print("Pending videos total:", len(pending),
              "assigned to this worker:", len(assigned), flush=True)

        for index, item in enumerate(assigned):
            name = str(item.get("name") or "Unknown video")
            if index >= MAX_ATTEMPTS or audit["converted"] >= MAX_PER_RUN:
                audit["unprocessed"] += 1
                audit["items"].append({"id": item["id"], "name": name, "status": "queued"})
                continue
            try:
                # Signed URLs expire: request one immediately before opening the source.
                details = share(item)
                if details.get("browserReady"):
                    audit["alreadyReady"] += 1
                    audit["items"].append({"id": item["id"], "name": name, "status": "ready"})
                    continue
                original = details.get("originalUrl") or details.get("url")
                if not isinstance(original, str) or not original.startswith("https://"):
                    raise RuntimeError("Source-video link is missing")
                print("Converting", name, "MB:", round(item.get("size", 0) / 1e6, 1), flush=True)
                with tempfile.TemporaryDirectory(prefix="newport-video-") as directory:
                    target = pathlib.Path(directory) / "chrome.mp4"
                    size, audio_tracks = encode(item, original, target)
                    # Acquire upload authorization after encoding so OIDC cannot expire.
                    token = workflow_identity()
                    signed = get_json(API + "/encode",
                                      headers={"Authorization": "Bearer " + token},
                                      payload={"key": item["id"]})
                    if not signed.get("ready"):
                        upload_url = signed.get("putUrl")
                        if not upload_url:
                            raise RuntimeError("The upload gateway rejected the playback copy")
                        put(target, upload_url)
                    if not share(item).get("browserReady"):
                        raise RuntimeError("R2 could not verify its compatible MP4")
                audit["converted"] += 1
                audit["items"].append({"id": item["id"], "name": name,
                                       "status": "converted", "mp4Bytes": size,
                                       "sourceAudioTracks": audio_tracks})
                print("MP4 READY", name, round(size / 1e6, 1), "MB", flush=True)
            except Exception as exc:
                audit["failed"] += 1
                reason = re.sub(r"https?://\\S+", "[signed URL]", str(exc))
                reason = re.sub(r"(?i)(bearer\\s+|x-amz-[a-z-]+=)\\S+",
                                "[authorization redacted]", reason)[:220]
                audit["items"].append({"id": item["id"], "name": name,
                                       "status": "conversion-failed",
                                       "errorType": type(exc).__name__, "reason": reason})
                print("CONVERSION ERROR", name, type(exc).__name__, reason, flush=True)
        print("Worker complete:", audit["converted"], "new MP4,",
              audit["failed"], "errors,", audit["unprocessed"], "queued", flush=True)
    except Exception as exc:
        audit["workflowError"] = type(exc).__name__
        print("Gallery inventory error", type(exc).__name__, str(exc)[:160], flush=True)
    finally:
        write_report(audit)


if __name__ == "__main__":
    main()
