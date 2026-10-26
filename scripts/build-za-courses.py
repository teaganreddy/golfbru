# Builds src/data/za-courses.json: named South African golf courses from OpenStreetMap, by province.
#
#   curl -A golf-app https://overpass-api.de/api/interpreter --data-urlencode \
#     'data=[out:json][timeout:160];rel["ISO3166-2"~"^ZA-"]["admin_level"="4"];foreach->.r(.r out tags;.r map_to_area->.a;(way["leisure"="golf_course"](area.a);relation["leisure"="golf_course"](area.a););out tags center;);' > za.json
#   python3 scripts/build-za-courses.py za.json src/data/za-courses.json

import json, re, sys

src, out = sys.argv[1], sys.argv[2]

# Not full courses, closed, or too generic to pick from a list.
SKIP = re.compile(r'driving range|\brange\b|mini|putt|abandon|disused|closed|footgolf|frisbee|disc golf|'
                  r'practice|academy|^blue course$|^red course$|^golf course$|^golf$', re.I)
# Already built into the app with its own tee ratings.
BUILT_IN = re.compile(r'^(king david )?mowbray golf club$', re.I)

seen, rows, province = set(), [], None
for e in json.load(open(src))['elements']:
    t = e['tags']
    if t.get('admin_level') == '4':
        province = t.get('name:en') or t.get('name')
        continue
    name = re.sub(r'[\u200b-\u200d\ufeff]', '', t.get('name:en') or t.get('name') or '').strip()
    if not name or SKIP.search(name) or BUILT_IN.match(name):
        continue
    key = (e['type'], e['id'])
    if key in seen:
        continue
    seen.add(key)
    town = t.get('addr:city') or t.get('addr:suburb') or t.get('addr:town')
    rows.append({'name': name, 'province': province, **({'town': town} if town else {})})

# Well-known courses OpenStreetMap doesn't have (or doesn't name) yet.
EXTRA = [
    ('Pearl Valley Golf Estate', 'Western Cape'), ('Atlantic Beach Links', 'Western Cape'),
    ('Stellenbosch Golf Club', 'Western Cape'), ('Paarl Golf Club', 'Western Cape'),
    ('Pinnacle Point Golf Club', 'Western Cape'), ('Pezula Golf Club', 'Western Cape'),
    ('Royal Johannesburg & Kensington Golf Club', 'Gauteng'), ('Houghton Golf Club', 'Gauteng'),
    ('Glendower Golf Club', 'Gauteng'), ('Leopard Creek Country Club', 'Mpumalanga'),
    ('Gary Player Country Club', 'North West'), ('Lost City Golf Course', 'North West'),
    ('Zimbali Country Club', 'KwaZulu-Natal'), ('Mount Edgecombe Country Club', 'KwaZulu-Natal'),
    ('St Francis Links', 'Eastern Cape'),
]
have = {r['name'].lower() for r in rows}
for name, prov in EXTRA:
    stem = name.lower().split(' golf')[0].split(' country')[0].split(' links')[0]
    if not any(stem in h for h in have):
        rows.append({'name': name, 'province': prov})

# Same name in the same province (e.g. split into two OSM shapes) -> keep one.
uniq = {(r['name'].lower(), r['province']): r for r in rows}
courses = sorted(uniq.values(), key=lambda r: r['name'].lower())
json.dump(courses, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(courses), 'courses', file=sys.stderr)
