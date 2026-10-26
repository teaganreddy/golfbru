# Builds src/data/mowbray.json from an OpenStreetMap Overpass export.
#
#   curl -A golf-app https://overpass-api.de/api/interpreter --data-urlencode \
#     'data=[out:json];rel(1067677);map_to_area->.a;(nwr["golf"~"hole|green|bunker|water_hazard|lateral_water_hazard|tee|pin|fairway"](area.a);nwr["natural"="water"](area.a););out geom;' > geom.json
#   python3 scripts/build-course.py geom.json src/data/mowbray.json

import json, math, sys, urllib.request

src, out = sys.argv[1], sys.argv[2]
els = json.load(open(src))['elements']

def m(a, b):
    R = 6371000
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))

def rings(e):
    if e['type'] == 'way':
        return [[(p['lat'], p['lon']) for p in e['geometry']]]
    if e['type'] == 'relation':
        return [[(p['lat'], p['lon']) for p in mem['geometry']]
                for mem in e['members'] if mem.get('role') == 'outer' and 'geometry' in mem]
    return []

def centroid(ring):
    # planar polygon centroid, fine at green scale
    a = cx = cy = 0
    for (y0, x0), (y1, x1) in zip(ring, ring[1:] + ring[:1]):
        c = x0*y1 - x1*y0
        a += c; cx += (x0+x1)*c; cy += (y0+y1)*c
    if abs(a) < 1e-14:
        return (sum(p[0] for p in ring)/len(ring), sum(p[1] for p in ring)/len(ring))
    return (cy/(3*a), cx/(3*a))

def seg_dist(p, line):
    # approximate min distance from point to polyline (metres) via local projection
    lat0 = math.radians(p[0])
    def xy(q): return ((q[1]-p[1])*111320*math.cos(lat0), (q[0]-p[0])*110540)
    best = 1e9
    for a, b in zip(line, line[1:]):
        ax, ay = xy(a); bx, by = xy(b)
        dx, dy = bx-ax, by-ay
        L = dx*dx + dy*dy
        t = 0 if L == 0 else max(0, min(1, -(ax*dx+ay*dy)/L))
        best = min(best, math.hypot(ax+t*dx, ay+t*dy))
    return best

def r6(pt): return [round(pt[0], 6), round(pt[1], 6)]

holes = [e for e in els if e['tags'].get('golf') == 'hole']
greens = [(e, rings(e)[0]) for e in els if e['tags'].get('golf') == 'green' and rings(e)]
pins = [(e['lat'], e['lon']) for e in els if e['tags'].get('golf') == 'pin']
hazards = []
for e in els:
    g = e['tags'].get('golf')
    if g in ('bunker', 'water_hazard', 'lateral_water_hazard') or (e['tags'].get('natural') == 'water' and g is None):
        kind = 'bunker' if g == 'bunker' else 'water'
        for r in rings(e):
            hazards.append({'kind': kind, 'ring': r})

def simplify(ring, n=24):
    step = max(1, len(ring) // n)
    return [r6(p) for p in ring[::step]]

tee_boxes = [r for e in els if e['tags'].get('golf') == 'tee' for r in rings(e)]
fairways = [r for e in els if e['tags'].get('golf') == 'fairway' for r in rings(e)]
hole_lines = {int(h['tags']['ref']): [(p['lat'], p['lon']) for p in h['geometry']] for h in holes}

def nearest_hole(pt):
    return min(hole_lines, key=lambda k: seg_dist(pt, hole_lines[k]))

course = {'name': 'King David Mowbray Golf Club', 'source': 'OpenStreetMap contributors (ODbL)', 'holes': []}
for h in sorted(holes, key=lambda h: int(h['tags']['ref'])):
    line = [(p['lat'], p['lon']) for p in h['geometry']]
    end = line[-1]
    green, gring = min(greens, key=lambda g: m(centroid(g[1]), end))
    mid = centroid(gring)
    hz = []
    for z in hazards:
        c = centroid(z['ring'])
        if seg_dist(c, line) < 45 and m(c, line[0]) > 30:
            # simplify ring to every Nth point to keep the file small
            step = max(1, len(z['ring']) // 16)
            hz.append({'kind': z['kind'], 'polygon': [r6(p) for p in z['ring'][::step]]})
    ref = int(h['tags']['ref'])
    # tee boxes near the start of this hole's line, fairways whose centre is closest to this hole
    tees_here = [simplify(r, 12) for r in tee_boxes if m(centroid(r), line[0]) < 60 and nearest_hole(centroid(r)) == ref]
    fw_here = [simplify(r) for r in fairways if nearest_hole(centroid(r)) == ref and seg_dist(centroid(r), line) < 40]
    course['holes'].append({
        'number': ref,
        'par': int(h['tags']['par']),
        'strokeIndex': int(h['tags']['handicap']),
        'tee': r6(line[0]),
        'green': {'middle': r6(mid), 'polygon': [r6(p) for p in gring]},
        'hazards': hz,
        'path': [r6(p) for p in line],
        'teeBoxes': tees_here,
        'fairways': fw_here,
    })
    print(h['tags']['ref'], 'par', h['tags']['par'], 'tee->mid %.0fm' % m(line[0], mid),
          'green-to-line-end %.0fm' % m(mid, end), 'hazards', len(hz), 'tees', len(tees_here), 'fairways', len(fw_here), file=sys.stderr)

# green elevations (Copernicus DEM via Open-Meteo) for the uphill/downhill adjustment
lats = ','.join(str(h['green']['middle'][0]) for h in course['holes'])
lons = ','.join(str(h['green']['middle'][1]) for h in course['holes'])
req = urllib.request.Request(f'https://api.open-meteo.com/v1/elevation?latitude={lats}&longitude={lons}',
                             headers={'User-Agent': 'golf-app/0.1'})
for h, e in zip(course['holes'], json.load(urllib.request.urlopen(req, timeout=30))['elevation']):
    h['green']['elevation'] = e

json.dump(course, open(out, 'w'), separators=(',', ':'))
