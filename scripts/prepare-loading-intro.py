"""Pack the approved source clip and extract real opening/final-frame posters.

Requires Pillow and imageio-ffmpeg. Keeps the generation master unchanged.
"""
import io
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art/intro/town-reveal-1080p-v1.mp4'
OUT = ROOT / 'public/intro'
OUT.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
reader = imageio_ffmpeg.read_frames(str(SOURCE))
metadata = next(reader)
reader.close()
duration = metadata['duration']
fps = metadata['fps']

subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
                '-i', str(SOURCE), '-map', '0:v:0', '-an', '-c:v', 'libx264',
                '-preset', 'medium', '-crf', '23', '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart', str(OUT / 'town-reveal.mp4')], check=True)

def frame(time):
    result = subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error',
        '-ss', str(time), '-i', str(OUT / 'town-reveal.mp4'), '-frames:v', '1',
        '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1'], check=True, capture_output=True)
    return Image.open(io.BytesIO(result.stdout)).convert('RGB')

frame(0).save(OUT / 'town-reveal-first.webp', 'WEBP', quality=90, method=6)
last = max(0, duration - .2)
# The provider's container can include trailing audio padding. Decode the last
# half second and overwrite one PNG, leaving the final *actual video frame*.
last_png = ROOT / 'art/intro/last-frame.png'
subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y',
    '-sseof', '-0.5', '-i', str(OUT / 'town-reveal.mp4'), '-an',
    '-update', '1', str(last_png)], check=True)
Image.open(last_png).save(OUT / 'town-reveal-last.webp', 'WEBP', quality=94, method=6)

sheet = Image.new('RGB', (1280, 4 * 390), '#0a0c10')
draw = ImageDraw.Draw(sheet)
for i, time in enumerate([0, 1, 2.5, 4, 5, 6, 7, last]):
    im = frame(time)
    im.thumbnail((640, 360), Image.Resampling.LANCZOS)
    x, y = (i % 2) * 640, (i // 2) * 390
    sheet.paste(im, (x, y))
    draw.text((x + 12, y + 367), f'{time:.2f}s', fill='#ffc05e')
sheet.save(ROOT / 'art/intro/contact-sheet.jpg', quality=92)
manifest = {
    'source': str(SOURCE.relative_to(ROOT)),
    'file': 'intro/town-reveal.mp4',
    'firstFrame': 'intro/town-reveal-first.webp',
    'lastFrame': 'intro/town-reveal-last.webp',
    'duration': duration, 'fps': fps, 'size': metadata['size'],
    'bytes': (OUT / 'town-reveal.mp4').stat().st_size,
    'audio': False,
}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest, indent=2))
