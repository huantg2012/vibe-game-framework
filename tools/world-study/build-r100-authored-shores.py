"""Offline polygon authoring only; requires Shapely in an authoring environment.

The production code generator consumes the resulting CSV and has no geometry
library dependency. No polygon is simplified: source-cut area is retained.
"""
import csv
import io
import json
import os
import sys
from pathlib import Path
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
CHECK = '--check' in sys.argv
REPORT = Path(os.environ.get('QA_REPORT', ROOT / 'docs/qa/artifacts/r100-spatial-rollout-2026-10-10/authored-shore-union-v2.json'))
if not CHECK and REPORT.exists():
    raise FileExistsError('Preserve existing shore evidence; use a new QA_REPORT path')


def read(name):
    with (ROOT / 'data' / name).open() as file:
        return list(csv.DictReader(file))


def write(name, fields, rows):
    output = io.StringIO()
    writer = csv.DictWriter(output, fields, lineterminator='\n')
    writer.writeheader()
    writer.writerows(rows)
    target = ROOT / 'data' / name
    if CHECK:
        assert target.read_text() == output.getvalue(), f'Stale authored CSV: {name}'
    else:
        target.write_text(output.getvalue())


def polygon(points):
    result = Polygon(points)
    assert result.is_valid
    return result


groups = read('rift-spatial-authored-groups.csv')
sectors = read('rift-spatial-sectors.csv')
sector_cuts = read('rift-spatial-sector-cuts.csv')
land_plates = read('rift-spatial-land-plates.csv')
assert len({(row['world_id'], row['id']) for row in land_plates}) == len(land_plates), 'Duplicate land plate'
assert all(any(sector['world_id'] == row['world_id'] for sector in sectors) for row in land_plates), 'Unregistered land plate world'
land_outlines, land_evidence, positive_lands = [], [], {}
for world_id in dict.fromkeys(row['world_id'] for row in land_plates):
    plates = [polygon([tuple(map(float, p.split(':'))) for p in row['points'].split('|')])
              for row in land_plates if row['world_id'] == world_id]
    assert all(plate.area >= 64 and box(0, 0, 2304, 1792).covers(plate) for plate in plates), (world_id, 'invalid positive plate')
    land = unary_union(plates)
    assert land.geom_type == 'Polygon' and land.is_valid and not land.interiors, (world_id, 'positive terrain must be one connected ring without holes')
    points = list(land.exterior.coords)[:-1]
    changed = True
    while changed:
        changed = False
        for i in range(len(points)):
            a, b, c = points[i-1], points[i], points[(i+1) % len(points)]
            if abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])) < 1e-6:
                points.pop(i); changed = True; break
    assert 3 <= len(points) <= 32, (world_id, 'positive outline vertex budget', len(points))
    positive_lands[world_id] = land
    land_outlines.append({'world_id': world_id, 'points': '|'.join(f'{x:.6f}:{y:.6f}' for x, y in points)})
    land_evidence.append({'worldId': world_id, 'plateCount': len(plates), 'vertexCount': len(points), 'unionArea': land.area,
                          'lostSourceArea': sum(plate.difference(land).area for plate in plates)})
sources = {row['world_id']: row for row in read('rift-native-worlds.csv')}
shores = {row['id']: polygon([tuple(map(float, pair.split(':'))) for pair in row['points'].split('|')])
          for row in read('rift-spatial-erosion.csv') if row['organization'] == 'authored-group'}
rows, evidence = [], []
for group in groups:
    world_id = group['world_id']
    scale, sx, sy, tx, ty = (float(group[key]) for key in ['scale', 'source_x', 'source_y', 'target_x', 'target_y'])
    affine = lambda x, y: (tx + (x - sx) * scale, ty + (y - sy) * scale)
    cell = sources[world_id]['erosion_polygons']
    original = [[tuple(map(float, p.split(':'))) for p in poly.split(';')] for poly in cell.split('|')] if cell else []
    transformed = [polygon([affine(x, y) for x, y in points]) for points in original]
    extensions = []
    edges = set()
    # Extend the complete original boundary segment, not only its endpoints.
    for points in original:
        for a, b in zip(points, points[1:] + points[:1]):
            aa, bb = affine(*a), affine(*b)
            if a[0] == b[0] == 0:
                extensions.append(box(0, min(aa[1], bb[1]), aa[0], max(aa[1], bb[1]))); edges.add('west')
            if a[0] == b[0] == 1024:
                extensions.append(box(aa[0], min(aa[1], bb[1]), 2304, max(aa[1], bb[1]))); edges.add('east')
            if a[1] == b[1] == 0:
                extensions.append(box(min(aa[0], bb[0]), 0, max(aa[0], bb[0]), aa[1])); edges.add('north')
            if a[1] == b[1] == 768:
                extensions.append(box(min(aa[0], bb[0]), aa[1], max(aa[0], bb[0]), 1792)); edges.add('south')
    # Four asymmetric corner cuts replace the previous shallow perimeter strips.
    # They stay disjoint unless an original sea mouth explicitly joins them.
    cuts = [shores[key] for key in ('corner-nw', 'corner-ne', 'corner-se', 'corner-sw')]
    # Peripheral cracks are independent of the preserved author's central group.
    peripheral = [shores[key] for key in (('rift-north', 'rift-south') if edges & {'east', 'west'} else ('rift-west', 'rift-east'))]
    union = unary_union(cuts + transformed + extensions + peripheral)
    polygons = list(union.geoms) if union.geom_type == 'MultiPolygon' else [union]
    # A corner plus the preserved sea-mouth extension can surround a small
    # isolated remnant beyond the source canvas. Remove that remnant, never any
    # protected authored ground. Output still uses simple polygons only.
    protected = box(*affine(0, 0), *affine(1024, 768))
    peripheral_pocket_area = 0
    peripheral_pockets = []
    for poly in polygons:
        for ring in poly.interiors:
            pocket = Polygon(ring)
            overlap = pocket.intersection(protected).area
            assert overlap < 1e-6, (world_id, 'coastal pocket intersects source canvas')
            peripheral_pocket_area += pocket.area
            peripheral_pockets.append({'area': pocket.area, 'bounds': list(pocket.bounds), 'sourceCanvasIntersectionArea': overlap})
    if peripheral_pocket_area:
        union = unary_union([Polygon(poly.exterior) for poly in polygons])
        polygons = list(union.geoms) if union.geom_type == 'MultiPolygon' else [union]
    assert len(polygons) <= 12, (world_id, len(polygons))
    for index, poly in enumerate(polygons):
        assert not poly.interiors and poly.is_valid, world_id
        # Remove only collinear middle vertices created by exact edge union.
        points = list(poly.exterior.coords)[:-1]
        changed = True
        while changed:
            changed = False
            for i in range(len(points)):
                a, b, c = points[i-1], points[i], points[(i+1) % len(points)]
                if abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])) < 1e-6:
                    points.pop(i); changed = True; break
        assert len(points) <= 32, (world_id, len(points))
        rows.append({'world_id': world_id, 'id': index, 'points': '|'.join(f'{x:.6f}:{y:.6f}' for x, y in points)})
    lost_area = sum(poly.difference(union).area for poly in transformed)
    assert lost_area < 1e-6, (world_id, lost_area)
    evidence.append({'worldId': world_id, 'sourceCutCount': len(original), 'boundaryEdges': sorted(edges),
                     'extensionCount': len(extensions), 'resultCutCount': len(polygons), 'lostSourceArea': lost_area,
                     'filledPeripheralPocketArea': peripheral_pocket_area, 'filledPeripheralPockets': peripheral_pockets})

# Sector revisions are complete, explicit author input, not modifications of the
# old common corner template. Their CSV is the only source of geometry. Union
# permits a bay to cross a shore input while the runtime still receives simple,
# pairwise-disjoint polygons. Never simplify or fill internal ground pockets.
for sector in sectors:
    world_id = sector['world_id']
    source_rows = [row for row in sector_cuts if row['world_id'] == world_id]
    assert source_rows, (world_id, 'missing sector cuts')
    cuts = [polygon([tuple(map(float, point.split(':'))) for point in row['points'].split('|')]) for row in source_rows]
    for cut in cuts:
        assert cut.area >= 64 and box(0, 0, 2304, 1792).covers(cut), (world_id, 'invalid authored sector bounds')
        if world_id in positive_lands:
            land = positive_lands[world_id]
            assert land.contains(cut) and land.boundary.disjoint(cut), (world_id, 'internal erosion must lie strictly inside positive terrain')
    union = unary_union(cuts)
    polygons = list(union.geoms) if union.geom_type == 'MultiPolygon' else [union]
    assert 4 <= len(polygons) <= 12, (world_id, 'sector polygon budget', len(polygons))
    for index, poly in enumerate(polygons):
        assert poly.is_valid and not poly.interiors, (world_id, 'sector polygon encloses unsupported ground island')
        points = list(poly.exterior.coords)[:-1]
        changed = True
        while changed:
            changed = False
            for i in range(len(points)):
                a, b, c = points[i-1], points[i], points[(i+1) % len(points)]
                if abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])) < 1e-6:
                    points.pop(i); changed = True; break
        assert len(points) <= 32, (world_id, 'sector vertex budget', len(points))
        rows.append({'world_id': world_id, 'id': index, 'points': '|'.join(f'{x:.6f}:{y:.6f}' for x, y in points)})
    evidence.append({'worldId': world_id, 'authoring': 'sector-cuts CSV', 'sourceCutCount': len(cuts),
                     'resultCutCount': len(polygons), 'sourceArea': sum(cut.area for cut in cuts),
                     'unionArea': union.area, 'lostSourceArea': sum(cut.difference(union).area for cut in cuts)})
write('rift-spatial-authored-erosion.csv', ['world_id', 'id', 'points'], rows)
write('rift-spatial-land-outlines.csv', ['world_id', 'points'], land_outlines)
if not CHECK:
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps({'worldCount': len(groups) + len(sectors), 'method': 'exact polygon union from CSV authoring; only collinear vertices removed', 'cases': evidence, 'positiveTerrain': land_evidence}, indent=2) + '\n')
print(f'{"Verified" if CHECK else "Authored"} {len(groups) + len(sectors)} world shores: {len(rows)} disjoint polygons')
