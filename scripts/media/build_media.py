"""Build web-light portfolio media from the owner's local archive.

python scripts/media/build_media.py [--only id1,id2] [--force]

Sources are read-only; outputs go to public/assets/work/ (WebP images, H.264 MP4 loops,
PDF spreads) plus public/assets/work/manifest.json with pixel sizes.
Tools: Pillow, ffmpeg/ffprobe (Shutter Encoder bundle) and Ghostscript, all local.
Each job states where its file came from, so the gallery can be rebuilt or audited.
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "assets" / "work"
FFMPEG = r"C:\Program Files\Shutter Encoder\app\Library\ffmpeg.exe"
FFPROBE = r"C:\Program Files\Shutter Encoder\app\Library\ffprobe.exe"
GS = r"C:\Program Files\gs\gs10.03.1\bin\gswin64c.exe"

EQ = r"D:\Anti-Gravity\Матрицы и оборудование"
V05 = EQ + r"\ANKOR_MACHINES_V05\preview"
W = r"D:\Work"
DRIVE = r"E:\Drive"
GD = W + r"\TARTIP Studio\Portfolio Game Dev\Portfolio GameDevKK Folder\Links"

JOBS = [
    # Engineering: CadQuery/Fusion projects rendered by the owner.
    dict(id="eng-pour-open", src=V05 + r"\pour_02_doors_open.png"),
    dict(id="eng-pour-inside", src=V05 + r"\pour_03_inside.png"),
    dict(id="eng-blister-inside", src=V05 + r"\blister_02_inside.png"),
    dict(id="eng-blister-pressing", src=V05 + r"\blister_05_pressing.png"),
    dict(id="eng-blister-strip", src=V05 + r"\blister_06_strip.png"),
    dict(id="eng-product-mold", src=V05 + r"\product_01_mold.png"),
    dict(id="eng-sealing-exploded", src=EQ + r"\ANKOR_ENGINEERING_V02\preview\06_sealing_head_exploded.png"),
    dict(id="eng-metering", src=EQ + r"\ANKOR_ENGINEERING_V02\preview\02_metering_station.png"),
    dict(id="eng-force-path", src=EQ + r"\ANKOR_ENGINEERING_V02\preview\08_force_path.png", w=1400),
    dict(id="eng-doser-cycle", src=EQ + r"\ANKOR_ANIMATION_V01\preview\cycles_0457.png"),
    dict(id="eng-casting", src=EQ + r"\ANKOR_LAB_V01\preview\01_casting_station.png"),
    dict(id="eng-ankor-cycle", kind="seq", src=EQ + r"\ANKOR_ANIMATION_V01\frames\frame_%04d.png", fps=48, w=1280, crf=29, poster_at=9),

    # 3D, CGI, games.
    dict(id="cg-vr-canyon-1", src=W + r"\TARTIP Studio\VR\Presentation\Tex\Exemple\HighresScreenshot00002.jpg"),
    dict(id="cg-vr-canyon-2", src=W + r"\TARTIP Studio\VR\Presentation\Tex\Exemple\HighresScreenshot00004.jpg"),
    dict(id="cg-vr-canyon-4", src=W + r"\TARTIP Studio\VR\Presentation\Tex\Exemple\HighresScreenshot00013.jpg"),
    dict(id="cg-mob-heads-1", src=GD + r"\korney-kolokolnikov-hex-1-3.jpg"),
    dict(id="cg-mob-worker", src=GD + r"\1415785187_1220268352.jpg"),
    dict(id="cg-mob-striker", src=GD + r"\Art_Striker_.png"),
    dict(id="cg-mob-crawler", src=GD + r"\Screenshot_24.png"),
    dict(id="cg-mob-jouker", src=GD + r"\photo_2020-06-22_01-17-07.jpg"),
    dict(id="cg-metahuman", src=GD + r"\Abay.png"),
    dict(id="cg-teacup", src=W + r"\Akvitol\Package\Lable\Green\Teacup.png"),
    dict(id="cg-mobika-key", src=W + r"\TARTIP Studio\Mobika Sound\Mobika YT\Tex\S1-Qaz.jpg"),
    dict(id="cg-mobika-hotel", src=GD + r"\M&N map 2022.jpg", w=1200),

    # Motion and film loops (silent previews; full films live on YouTube or with the owner).
    dict(id="v-mobika-opener", kind="video", src=W + r"\TARTIP Studio\Mobika Sound\Video Opener\Opening_RU.mp4", t=16),
    dict(id="v-ztk-opener", kind="video", src=W + r"\Vladik\render\Opener to Music.mp4", ss=4, t=22, crf=28, poster_at=1),
    dict(id="v-ztk-plasma", kind="video", src=W + r"\Vladik\Video\Interior\Opener\Plasma_cutter_cutting_titanium_logo_202605230201.mp4", t=8),
    dict(id="v-ztk-hangar", kind="video", src=W + r"\Vladik\Video\Interior\Opener\Futuristic_hangar_drone_flight_logo_202605230227 (1).mp4", t=8),
    dict(id="v-nygmet", kind="video", src=W + r"\Romadanov\Ready to work\Final Render\Nygmet.mov", ss=2, t=24, crf=28),
    dict(id="v-gof-sparks", kind="video", src=W + r"\GraetOrdaFest\Flow_202606081859.mp4", t=10),
    dict(id="v-hyper-logo", kind="video", src=W + r"\A\Video\Render\Render_4.mp4", t=7),
    dict(id="v-a4r-mud", kind="video", src=DRIVE + r"\All4Race\Video\Mud_splash_offroad_reveal_1080p_202609021744.mp4", t=8),
    dict(id="v-a4r-night", kind="video", src=DRIVE + r"\All4Race\Video\GT_cars_racing_at_night_202609021744.mp4", t=8),
]


def newer(out, src):
    return out.exists() and out.stat().st_mtime >= Path(src).stat().st_mtime


def save_webp(im, path, width, quality=80):
    im = im.copy()
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(path, "WEBP", quality=quality, method=6)
    return im.size


def image_job(job, manifest, force):
    src = job["src"]
    out = OUT / f"{job['id']}.webp"
    if not force and newer(out, src) and job["id"] in manifest:
        return
    im = Image.open(src)
    im = ImageOps.exif_transpose(im)
    alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    im = im.convert("RGBA" if alpha else "RGB")
    if job.get("crop"):
        l, t, r, b = job["crop"]
        im = im.crop((round(l * im.width), round(t * im.height), round(r * im.width), round(b * im.height)))
    size = save_webp(im, out, job.get("w", 1920), job.get("q", 80))
    save_webp(im, OUT / f"{job['id']}-sm.webp", 760, 76)
    manifest[job["id"]] = dict(kind="img", src=src, w=size[0], h=size[1], file=f"assets/work/{job['id']}.webp")


def probe(src):
    r = subprocess.run([FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "stream=width,height:format=duration", "-of", "json", src], capture_output=True, text=True)
    data = json.loads(r.stdout or "{}")
    st = (data.get("streams") or [{}])[0]
    return st.get("width"), st.get("height"), float(data.get("format", {}).get("duration", 0) or 0)


def video_job(job, manifest, force):
    src = job.get("src") or job["srcs"][0]
    (OUT / "video").mkdir(exist_ok=True)
    out = OUT / "video" / f"{job['id']}.mp4"
    poster = OUT / "video" / f"{job['id']}.webp"
    seq = job.get("kind") == "seq"
    if not force and job["id"] in manifest and out.exists() and poster.exists():
        return
    width = job.get("w", 1280)
    vf = [f"scale='min({width},iw)':-2:flags=lanczos", "format=yuv420p"]
    cmd = [FFMPEG, "-y", "-v", "error"]
    if seq:
        cmd += ["-framerate", str(job.get("fps", 24)), "-i", src]
    else:
        if job.get("srcs"):  # join clips: same size, video only
            for clip in job["srcs"]:
                cmd += ["-i", clip]
            joined = "".join(f"[{i}:v]" for i in range(len(job["srcs"])))
            vf = [f"{joined}concat=n={len(job['srcs'])}:v=1:a=0[j]", f"[j]scale='min({width},iw)':-2:flags=lanczos,format=yuv420p"]
            cmd += ["-filter_complex", ";".join(vf)]
            vf = None
        else:
            if job.get("ss"):
                cmd += ["-ss", str(job["ss"])]
            cmd += ["-i", src]
            if job.get("t"):
                cmd += ["-t", str(job["t"])]
    cmd += ["-an"] + (["-vf", ",".join(vf)] if vf else []) + ["-c:v", "libx264", "-preset", "slow", "-crf", str(job.get("crf", 27)),
            "-profile:v", "high", "-movflags", "+faststart"]
    if seq:
        cmd += ["-r", "24"]
    cmd += [str(out)]
    subprocess.run(cmd, check=True)
    w, h, dur = probe(str(out))
    at = job.get("poster_at", min(dur * .35, 4))
    with tempfile.TemporaryDirectory() as tmp:
        frame = Path(tmp) / "poster.png"
        subprocess.run([FFMPEG, "-y", "-v", "error", "-ss", str(at), "-i", str(out), "-frames:v", "1", str(frame)], check=True)
        save_webp(Image.open(frame).convert("RGB"), poster, width, 78)
    manifest[job["id"]] = dict(kind="video", src=src, w=w, h=h, duration=round(dur, 1),
                               mb=round(out.stat().st_size / 1e6, 2),
                               file=f"assets/work/video/{job['id']}.mp4", poster=f"assets/work/video/{job['id']}.webp")


def pdf_job(job, manifest, force):
    src = job["src"]
    (OUT / "decks").mkdir(exist_ok=True)
    pages = job.get("pages", [1])
    if isinstance(pages, int):  # a first page: every page from there to the end of the PDF
        from pypdf import PdfReader
        pages = list(range(pages, len(PdfReader(src).pages) + 1))
    pages = [p for p in pages if p not in set(job.get("skip", []))]
    if not force and job["id"] in manifest and all((OUT / "decks" / f"{job['id']}-{p}.webp").exists() for p in pages):
        return
    files = []
    with tempfile.TemporaryDirectory() as tmp:
        for p in pages:
            png = Path(tmp) / f"{p}.png"
            subprocess.run([GS, "-q", "-dBATCH", "-dNOPAUSE", "-dSAFER", "-sDEVICE=png16m", f"-r{job.get('dpi', 110)}",
                            "-dTextAlphaBits=4", "-dGraphicsAlphaBits=4", f"-dFirstPage={p}", f"-dLastPage={p}",
                            f"-sOutputFile={png.as_posix()}", Path(src).as_posix()], check=True)
            im = Image.open(png).convert("RGB")
            size = save_webp(im, OUT / "decks" / f"{job['id']}-{p}.webp", job.get("w", 1600), 78)
            save_webp(im, OUT / "decks" / f"{job['id']}-{p}-sm.webp", 640, 74)
            files.append(dict(page=p, w=size[0], h=size[1], file=f"assets/work/decks/{job['id']}-{p}.webp"))
    manifest[job["id"]] = dict(kind="pdf", src=src, pages=files)


def write_media_module(manifest):
    """public/work-media.js: id -> file, size and poster, consumed by work.js."""
    compact = {}
    for key, item in sorted(manifest.items()):
        if item["kind"] == "img":
            compact[key] = dict(src=item["file"], sm=item["file"].replace(".webp", "-sm.webp"), w=item["w"], h=item["h"])
        elif item["kind"] == "video":
            compact[key] = dict(video=item["file"], poster=item["poster"], w=item["w"], h=item["h"], duration=item["duration"])
        else:
            compact[key] = dict(pages=[dict(src=page["file"], sm=page["file"].replace(".webp", "-sm.webp"), w=page["w"], h=page["h"]) for page in item["pages"]])
    body = json.dumps(compact, ensure_ascii=False, separators=(",", ":"))
    (ROOT / "public" / "work-media.js").write_text(
        "// Generated by scripts/media/build_media.py from public/assets/work/manifest.json. Do not edit by hand.\n"
        f"export const media = {body};\n", encoding="utf-8")


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    only = None
    if "--only" in sys.argv:
        only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    force = "--force" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    mpath = OUT / "manifest.json"
    manifest = json.loads(mpath.read_text(encoding="utf-8")) if mpath.exists() else {}
    jobs = JOBS + EXTRA_JOBS
    for job in jobs:
        if only and job["id"] not in only:
            continue
        kind = job.get("kind", "img")
        try:
            {"img": image_job, "video": video_job, "seq": video_job, "pdf": pdf_job}[kind](job, manifest, force)
            print("ok ", job["id"], json.dumps({k: v for k, v in manifest[job["id"]].items() if k not in ("src", "pages")}))
        except Exception as error:  # Keep going; report every failure at the end of the run.
            print("ERR", job["id"], error)
        mpath.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    write_media_module(manifest)
    total = sum(f.stat().st_size for f in OUT.rglob("*") if f.is_file())
    print(f"Total work media: {total/1e6:.1f} MB")


P = DRIVE + r"\Presentation"
AG = r"D:\Anti-Gravity"
DECKS = [  # (id, PDF, first page): every page from there to the end of the PDF
    ("p-360", P + r"\360 Degree panorama 6 Кластеров.pdf", 1),
    ("p-vr-museum", P + r"\3d scan Musium .pdf", 1),
    ("p-3d-scan", P + r"\3d Scan people P.pdf", 1),
    ("p-axium-additive", P + r"\Additive.pdf", 1),
    ("p-cubes", P + r"\Cube Concept.pdf", 1),
    ("p-vr-education", P + r"\DIGI Face.pdf", 1),
    ("p-axium-feedback", P + r"\FeedBack.pdf", 1),
    ("p-hyperoil", P + r"\HyperOil H.pdf", 1),
    ("p-icanfly", P + r"\I CAN FLY VR SIMULATOR S.pdf", 1),
    ("p-iri-farm", P + r"\IRI Farm print RUS.pdf", 1),
    ("p-manganese", P + r"\Magfactory.pdf", 1),
    ("p-icl", P + r"\Presentation ICL Print.pdf", 1),
    ("p-showroom", P + r"\Show Room Dress P.pdf", 1),
    ("p-ski", P + r"\Ski Resort - Presentation_A3.pdf", 1),
    ("p-vr-lookbook", P + r"\VR Lookbook Bleed.pdf", 1),
    ("p-wtk", P + r"\WtK - VR Presentation A4 Spreads.pdf", 1),
    ("p-animation", DRIVE + r"\Animation\Presentation Animation web S.pdf", 1),
    ("p-saf", DRIVE + r"\Sensata\Presentation\SAF_Avenue_Visual_RU.pdf", 1),
    ("p-eltanba", W + r"\Animation Film\Eltanba Storyboard.pdf", 1),
    ("p-sakai", AG + r"\Presentation Festival\SakaiFest\output\SAKAI_FEST_Charyn_2027.pdf", 1),
    ("p-gof", AG + r"\Presentation Festival\GreatOrdaFest\output\Great_Orda_Fest_Qonaev_2027_with_logo.pdf", 1),
    ("p-togys", AG + r"\Presentation Festival\output\TOGYS_Astana_2027.pdf", 1),
    ("p-aura", AG + r"\Avatar\output\pdf\AURA Unreal.pdf", 2),
    ("p-detox", AG + r"\DETOX Rebrending\output\detox-ankor-style-2026-10-16\DETOX-four-directions-joy.pdf", 1),
]
YT_ASTANA = AG + r"\Youtube\Uploaded\Astana Render 4K.mp4"
SAF = AG + r"\TEST 360\SAF_F1\final"
SANS = AG + r"\Sansata"
RPK = AG + r"\RPK\artifacts\rebrand"
DETOX = AG + r"\DETOX Rebrending\output"
# Pages never published: concrete prices, estimates and budgets, and other people's contacts.
SKIP = {
    "p-aura": list(range(7, 15)),       # labour, price (10 600 000 ₸), equipment and estimate basis
    "p-360": [5, 9],                     # equipment price list and production estimate in tenge
    "p-hyperoil": [3, 4, 5, 6, 7],       # cost price, sales plan and business model
    "p-animation": [8],                  # service price list in USD
    "p-vr-education": [10], "p-showroom": [9], "p-3d-scan": [9], "p-icanfly": [12], "p-iri-farm": [12],  # third-party contacts
}
EXTRA_JOBS = [dict(id=i, kind="pdf", src=s, pages=pg, dpi=96, skip=SKIP.get(i, [])) for i, s, pg in DECKS] + [
    # Archviz: SAF Avenue lobbies (Blender -> USD -> UE5.8 path tracer) and exterior.
    dict(id="arch-saf-lobby-1", src=SAF + r"\stills\CAM_P09.jpg"),
    dict(id="arch-saf-lobby-2", src=SAF + r"\stills\CAM_P08.jpg"),
    dict(id="arch-saf-lobby-3", src=SAF + r"\stills\CAM_P11.jpg"),
    dict(id="arch-saf-lobby-4", src=SAF + r"\stills\CAM_P13.jpg"),
    dict(id="arch-saf-pano", src=SAF + r"\panoramas_game\PANO_P09.jpg", w=4096, q=82),
    dict(id="arch-saf-night", src=SANS + r"\3d model\Blender\Photoreal\SAF_Night.png"),
    dict(id="arch-saf-north", src=SANS + r"\3d tour\ue-pt\complex_north.png"),
    dict(id="arch-saf-section", src=SANS + r"\3d tour\ue-pt\section_3.png"),
    # Brand and identity.
    dict(id="b-rpk-board", src=RPK + r"\reference\brand-board.png"),
    dict(id="b-rpk-stationery", src=RPK + r"\reference\graphite-stationery-identity.png"),
    dict(id="b-detox-overview", src=DETOX + r"\detox-ankor-style-2026-10-16\DETOX-overview-joy.png"),
    dict(id="b-detox-archive", src=DETOX + r"\detox-new-visual-directions\04-botanical-archive.png"),
    dict(id="b-detox-sculpted", src=DETOX + r"\detox-signature-concepts\03-sculpted-d.png"),
    dict(id="b-connect", src=AG + r"\V connect CRM\Материалы проекта\Logo\Сетка из девяти стилей логотипа CONNECT.png"),
    dict(id="b-travelhub", src=AG + r"\Drive Forum\public\brand\travelhub-logo.png", w=1200),
    dict(id="b-smartlight", src=AG + r"\SmartLightControl\public\SmartLightControl_Logo.png", w=1000),
    dict(id="b-patrol", src=AG + r"\Patrol Control\public\Logo_Final.png", w=1200),
    dict(id="b-gof", src=W + r"\GraetOrdaFest\Logo\Logo 1.jpeg", w=1400),
    dict(id="b-hyper-identity", src=W + r"\A\Logo\Айдентика.jpg"),
    dict(id="b-tartip", src=W + r"\TARTIP Studio\Logo\TARTIP LOGO-01.jpg", w=1000),
    dict(id="b-icanfly", src=W + r"\Container\Jump\Logo\I can fly Logo White.png", w=1000),
    dict(id="b-falcon", src=AG + r"\Video Cloth\Проекты\FALCON\02_PRODUCTION\collection\FC_GROUP_HERO_v1.png", w=1400),
    dict(id="b-gof-arena", src=AG + r"\Presentation Festival\GreatOrdaFest\assets\03-arena.png"),
    dict(id="b-togys", src=AG + r"\Presentation Festival\output\TOGYS_cover.png"),
    dict(id="b-harmony-noir", src=AG + r"\Harmony\output\creative\renders\Harmony_05_front_right.png"),
    dict(id="b-harmony-trio", src=AG + r"\Harmony\output\creative\Harmony_creative_comparison.png", w=1400),
    # Astana film («Казахский язык — символ единства»): Baiterek fly-around for the home page.
    # v-astana (an earlier segment) stays for the story page.
    dict(id="v-astana-city", kind="video", src=YT_ASTANA, ss=74, t=13, crf=27, poster_at=6),
]
YT = AG + r"\Youtube\Uploaded"
VC = AG + r"\Video Cloth\Проекты"
EXTRA_JOBS += [
    # Vertical AI films and product films: short silent excerpts for the reels strip.
    dict(id="r-paleo", kind="video", src=YT + r"\2 Серия Эхо Палеолита.mp4", ss=18, t=7, w=540, crf=28),
    dict(id="r-mars", kind="video", src=YT + r"\Mars 1.mp4", ss=20, t=7, w=540, crf=28, poster_at=6.8),
    dict(id="r-march", kind="video", src=YT + r"\Марш смерти финал без саб.mp4", ss=6, t=7, w=540, crf=28),
    dict(id="r-gym", kind="video", src=YT + r"\DETOX GYM.mp4", ss=10, t=7, w=540, crf=28),
    dict(id="r-falcon", kind="video", src=VC + r"\FALCON\ГОТОВЫЕ РОЛИКИ\00 — FALCON — Вся коллекция.mp4", ss=3, t=8, w=540, crf=28, poster_at=2),
    dict(id="r-tankz", kind="video", src=VC + r"\TANKZ\delivery\TANKZ_6x15_v3\03_Orange_Inside_v3.mp4", t=8, w=540, crf=28, poster_at=1),
    dict(id="r-office", kind="video", src=YT + r"\Office Voice Music.mp4", ss=8, t=7, w=540, crf=28),
    dict(id="v-astana", kind="video", src=YT + r"\Astana Render 4K.mp4", ss=12, t=14, crf=27),
]

if __name__ == "__main__":
    main()
