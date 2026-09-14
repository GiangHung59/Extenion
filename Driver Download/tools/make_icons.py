"""Render the editable vector logo to antialiased Chrome PNG sizes; stdlib only."""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1] / 'icons'
ROOT.mkdir(exist_ok=True)
ROOT.joinpath('logo.svg').write_text('''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<rect x="4" y="4" width="120" height="120" rx="28" fill="#23734b"/>
<path d="M27 35H51L60 45H101V92H27Z" fill="#a3d8b4"/>
<path d="M23 50H105L97 96H31Z" fill="#ffffff"/>
<path d="M57 57H71V73H83L64 91L45 73H57Z" fill="#23734b"/>
</svg>''')

def polygon(x, y, points):
    inside = False
    px, py = points[-1]
    for qx, qy in points:
        if ((qy > y) != (py > y)) and x < (px-qx)*(y-qy)/(py-qy)+qx:
            inside = not inside
        px, py = qx, qy
    return inside

def color(x, y):
    dx, dy = max(32-x, 0, x-96), max(32-y, 0, y-96)
    if not (4 <= x <= 124 and 4 <= y <= 124 and dx*dx+dy*dy <= 28*28):
        return (0, 0, 0, 0)
    result = (35, 115, 75, 255)
    if polygon(x,y,[(27,35),(51,35),(60,45),(101,45),(101,92),(27,92)]):result=(163,216,180,255)
    if polygon(x,y,[(23,50),(105,50),(97,96),(31,96)]):result=(255,255,255,255)
    if polygon(x,y,[(57,57),(71,57),(71,73),(83,73),(64,91),(45,73),(57,73)]):result=(35,115,75,255)
    return result

def chunk(kind, data):
    return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)

for size in (16,32,48,128):
    raw=bytearray(); samples=4
    for y in range(size):
        raw.append(0)
        for x in range(size):
            colors=[color((x+(sx+.5)/samples)*128/size,(y+(sy+.5)/samples)*128/size) for sy in range(samples) for sx in range(samples)]
            alpha=sum(c[3] for c in colors)
            raw.extend([round(sum(c[k]*c[3] for c in colors)/alpha) if alpha else 0 for k in range(3)]+[round(alpha/len(colors))])
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',size,size,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b'')
    ROOT.joinpath(f'icon-{size}.png').write_bytes(png)
print('Generated logo.svg and PNG icons: 16, 32, 48, 128 px')
