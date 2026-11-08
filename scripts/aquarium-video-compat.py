#!/usr/bin/env python3
"""Convert published Aquarium MOVs to H.264/AAC HLS for public one-video watch links.

Uses the public, short-lived signed GET links exposed by the gallery API.
Priority video is converted and pushed before attempting any others.
"""
import json
import os
import re
import shutil
import subprocess
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://newport-aquarium-visitor-archive-pdrkfz.v2.appdeploy.ai/api/media"
PRIORITY = "visitor/1794114056595-ea4fca8e5cfa-IMG_3125.MOV"
OUTPUT = Path("aq/streams")
MAX_OTHERS = 30

def get_items():
    items = []
    token = ""
    for _ in range(200):
        url = API + ("?nextToken=" + urllib.parse.quote(token, safe="") if token else "")
        req = urllib.request.Request(url, headers={"User-Agent":"AquariumVideoCompat/1.0", "Accept":"application/json"})
        with urllib.request.urlopen(req, timeout=45) as r:
            data = json.load(r)
        items += data.get("items", [])
        nxt = data.get("nextToken") or ""
        if not nxt or nxt == token:
            break
        token = nxt
    return items

def path_of(item):
    return str(item.get("path") or "").removeprefix("r2:").removeprefix("b2:")

def slug_of(item):
    base = path_of(item).rsplit("/", 1)[-1].rsplit(".", 1)[0]
    return re.sub(r"[^A-Za-z0-9._-]", "_", base)

def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent":"AquariumVideoCompat/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest,"wb") as out:
        shutil.copyfileobj(r,out,1024*1024)

def convert(item):
    slug = slug_of(item)
    if not slug:
        raise RuntimeError("Invalid video key")
    directory = OUTPUT / slug
    playlist = directory / "stream.m3u8"
    if playlist.exists():
        print("Already converted", slug, flush=True)
        return False
    directory.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as t:
        src = os.path.join(t, "original.mov")
        print("Downloading",path_of(item), "bytes",item.get("size"), flush=True)
        download(item["url"],src)
        # 720p long-edge/short-edge bounds; portrait videos remain portrait.
        vf = "fps=30,scale=w='if(gte(iw,ih),min(iw,1280),min(iw,720))':h=-2,format=yuv420p"
        cmd = ["ffmpeg","-hide_banner","-loglevel","error","-nostdin","-y","-i",src,
               "-map","0:v:0","-map","0:a:0?","-vf",vf,
               "-c:v","libx264","-preset","veryfast","-crf","25","-profile:v","main","-level:v","3.1",
               "-maxrate","1800k","-bufsize","3600k","-pix_fmt","yuv420p",
               "-g","180","-keyint_min","180","-sc_threshold","0",
               "-c:a","aac","-b:a","112k","-ar","48000","-ac","2",
               "-f","hls","-hls_time","6","-hls_playlist_type","vod",
               "-hls_flags","independent_segments",
               "-hls_segment_filename",str(directory / "segment_%05d.ts"),str(playlist)]
        subprocess.run(cmd,check=True,timeout=7200)
    subprocess.run(["git","add","--",str(directory)],check=True)
    commit = subprocess.run(["git","diff","--cached","--quiet"])
    if commit.returncode:
        subprocess.run(["git","commit","-m","Aquarium: browser-compatible video "+slug],check=True)
        subprocess.run(["git","push"],check=True)
        print("PUBLISHED",slug,flush=True)
    return True

def main():
    items = [x for x in get_items() if x.get("kind")=="video" and x.get("url")]
    print("Gallery video count:",len(items),flush=True)
    priority = next((x for x in items if path_of(x)==PRIORITY),None)
    if not priority:
        raise RuntimeError("Priority video not found in published gallery: "+PRIORITY)
    convert(priority)
    count = 0
    for item in items:
        if path_of(item)==PRIORITY:
            continue
        if count>=MAX_OTHERS:
            break
        if (OUTPUT / slug_of(item) / "stream.m3u8").exists():
            continue
        try:
            # Refresh signed media link before long encodes; signatures are short-lived.
            refreshed = next((x for x in get_items() if path_of(x)==path_of(item)),None)
            if not refreshed or not refreshed.get("url"):
                continue
            convert(refreshed)
            count += 1
        except Exception as ex:
            print("Could not convert",path_of(item),type(ex).__name__,str(ex)[:250],flush=True)
    print("Finished. Additional unconverted files can be processed on next run.",flush=True)

if __name__=="__main__":
    main()
