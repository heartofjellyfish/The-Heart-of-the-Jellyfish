#!/usr/bin/env python3
"""Trace the figure in the shore painting and print his outline as an SVG path.

    python3 scripts/trace-figure.py            # prints the path
    python3 scripts/trace-figure.py --check    # also writes /tmp/figure-check.png

The result goes into FIGURE_PATH in components/Landing.tsx, where it is dropped
into an SVG with the painting's own viewBox so the coordinates below are the
painting's own pixels. Re-run this whenever public/images/hero.webp changes --
a stale path still draws and still takes clicks, just not on anybody.

Why this works at all: the painting separates on two channels and nothing else
is needed. Sky is the only thing in the frame with more blue than red. Sand is
the only thing that is both warm and not skin -- and it only exists below the
horizon, which matters, because applied to the whole frame that rule also eats
the shadow under his brow. Everything left in the neighbourhood is the man.

Dependencies: Pillow and numpy. No OpenCV, no potrace.
"""
import sys
from PIL import Image, ImageFilter
import numpy as np

SRC = 'public/images/hero.webp'
# The neighbourhood he stands in. Only here, so the sea (also blue) and the far
# shore never enter the argument.
BOX = (slice(100, 900), slice(1150, 1450))
HORIZON = 560          # first row that can contain sand
EPSILON = 1.2          # Douglas-Peucker tolerance, in painting pixels


def mask(a):
    R, G, B = a[..., 0], a[..., 1], a[..., 2]
    RB, RG = R - B, R - G
    V = a.max(axis=2)
    # Cool AND bright. -35 alone is right about ordinary sky, which measures
    # -71..-86 here, and wrong about the tip of his fringe, which is painted a
    # blue-black: RB -13..-70, indistinguishable from sky on colour and nothing
    # like it on value. The brightness floor costs nothing to add -- across
    # 32,292 pixels of open sky in this frame, not one is darker than 140, and
    # the fringe tip runs 53..120.
    sky = (RB < -35) & (V > 140)
    below = np.zeros(RB.shape, bool)
    below[HORIZON:, :] = True
    # 30, not 45. Plain sand sits at R-B 50..75 and his clothes at 17..22, so
    # anything in between looked like slack -- but the contact shadow under his
    # heel is sand at R-B 43 with a floor of 32, and at 45 it fell on the wrong
    # side of the line. It is warm, so it is not sky; it is not skin, so it is
    # not him; and being neither it came out as figure and grew a tab of shadow
    # off the back of his foot. The gap that actually matters is clothes-to-
    # shaded-sand, 22 to 32, and the line belongs in the middle of it.
    sand = below & (RB > 30) & (RG < 28)
    fig = ~(sky | sand)
    keep = np.zeros(fig.shape, bool)
    keep[BOX] = True
    return fig & keep


def shift_v(f, d):
    """f moved d rows down (negative = up), with zeros shifted in."""
    out = np.zeros_like(f)
    if d > 0:
        out[d:, :] = f[:-d, :]
    elif d < 0:
        out[:d, :] = f[-d:, :]
    else:
        out = f.copy()
    return out


def open_v(f, r):
    """Opening with a vertical line, not a square.

    The thing this has to remove is the horizon seam: rows 580-585, a six-row
    band of sky-to-sand blend that is warm enough not to be sky and cool enough
    not to be sand, and so comes out as figure right across the frame. A
    vertical erosion of radius 3 deletes any horizontal band six rows or
    thinner, and the body -- 700 rows tall -- does not notice.

    It has to be a line and not a square, and that is the whole reason this
    function exists. A square opening also deletes anything *narrower* than the
    kernel in either direction, and the tip of his fringe is a wedge that comes
    to a point: 38 pixels, gone, and with them the only thing telling the glow
    where the hair ends. It read as a band of light cutting through his hair.
    A vertical line erodes the wedge from above and below, which a wedge that
    long survives.
    """
    e = f.copy()
    for d in range(1, r + 1):
        e &= shift_v(f, d) & shift_v(f, -d)
    o = e.copy()
    for d in range(1, r + 1):
        o |= shift_v(e, d) | shift_v(e, -d)
    return o


def clean(f):
    f = open_v(f, 3)
    # Closing seals the hairline gaps the colour rule leaves at the waistband.
    # Square is fine here: closing fills concavities, it does not shave points.
    im = Image.fromarray((f * 255).astype('uint8'))
    im = im.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
    f = np.asarray(im) > 127

    f = largest(f)
    f = fill_holes(f)
    # The threshold leaves a staircase on what is a brushed edge; this is the
    # difference between an outline that hugs him and one that buzzes.
    return np.asarray(Image.fromarray((f * 255).astype('uint8'))
                      .filter(ImageFilter.GaussianBlur(1.6))) > 120


def flood(seed_iter, passable, seen):
    stack = list(seed_iter)
    h, w = passable.shape
    for y, x in stack:
        seen[y, x] = True
    while stack:
        y, x = stack.pop()
        for v, u in ((y+1, x), (y-1, x), (y, x+1), (y, x-1)):
            if 0 <= v < h and 0 <= u < w and passable[v, u] and not seen[v, u]:
                seen[v, u] = True
                stack.append((v, u))


def largest(f):
    lab = np.zeros(f.shape, np.int32)
    best_id, best_n, nxt = 0, 0, 0
    for sy, sx in zip(*np.nonzero(f)):
        if lab[sy, sx]:
            continue
        nxt += 1
        seen = np.zeros(f.shape, bool)
        flood([(sy, sx)], f, seen)
        n = int(seen.sum())
        lab[seen] = nxt
        if n > best_n:
            best_id, best_n = nxt, n
    return lab == best_id


def fill_holes(f):
    """Flood the outside; whatever the flood never reaches is interior."""
    out = np.zeros(f.shape, bool)
    h, w = f.shape
    edge = ([(0, x) for x in range(w) if not f[0, x]] +
            [(h-1, x) for x in range(w) if not f[h-1, x]] +
            [(y, 0) for y in range(h) if not f[y, 0]] +
            [(y, w-1) for y in range(h) if not f[y, w-1]])
    flood(edge, ~f, out)
    return ~out


def contour(f):
    """Moore-neighbour boundary walk, clockwise from north."""
    p = np.pad(f, 1)
    nbr = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]
    ys, xs = np.nonzero(p)
    start = tuple(int(v) for v in (ys[np.lexsort((xs, ys))[0]],
                                   xs[np.lexsort((xs, ys))[0]]))
    b, prev, out = start, (start[0], start[1] - 1), [start]
    while True:
        di = nbr.index((prev[0] - b[0], prev[1] - b[1]))
        for k in range(1, 9):
            d = (di + k) % 8
            c = (b[0] + nbr[d][0], b[1] + nbr[d][1])
            if p[c]:
                b, prev = c, (b[0] + nbr[(d-1) % 8][0], b[1] + nbr[(d-1) % 8][1])
                break
        else:
            break
        if b == start:
            break
        out.append(b)
        if len(out) > 400000:
            break
    return [(x - 1, y - 1) for y, x in out]


def simplify(pl, eps):
    keep = [False] * len(pl)
    keep[0] = keep[-1] = True
    st = [(0, len(pl) - 1)]
    while st:
        a, z = st.pop()
        if z <= a + 1:
            continue
        (x0, y0), (x1, y1) = pl[a], pl[z]
        dx, dy = x1 - x0, y1 - y0
        n = (dx * dx + dy * dy) ** .5
        mi, md = a, -1.0
        for i in range(a + 1, z):
            x, y = pl[i]
            d = (abs(dy*x - dx*y + x1*y0 - y1*x0) / n if n
                 else ((x-x0)**2 + (y-y0)**2) ** .5)
            if d > md:
                mi, md = i, d
        if md > eps:
            keep[mi] = True
            st += [(a, mi), (mi, z)]
    return [q for q, k in zip(pl, keep) if k]


def main():
    im = Image.open(SRC).convert('RGB')
    f = clean(mask(np.asarray(im).astype(int)))
    pts = simplify(contour(f) + [contour(f)[0]], EPSILON)
    d = 'M' + 'L'.join(f'{x},{y}' for x, y in pts[:-1]) + 'Z'
    print(f'/* {im.size[0]}x{im.size[1]}, {len(pts)-1} points, '
          f'{len(d)} chars */', file=sys.stderr)
    print(d)
    if '--check' in sys.argv:
        from PIL import ImageDraw
        chk = im.copy()
        ImageDraw.Draw(chk).line([tuple(q) for q in pts], fill=(255, 45, 85), width=3)
        chk.save('/tmp/figure-check.png')
        print('wrote /tmp/figure-check.png', file=sys.stderr)


if __name__ == '__main__':
    main()
