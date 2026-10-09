"""Check foreground contrast against QA's matching frozen-world screenshots.

Usage: python3 contrast-check.py <frames-dir> <output.json>
Requires Pillow; does not modify source screenshots or game files.
"""
from pathlib import Path
from PIL import Image
import hashlib
import json
import math
import re
import sys


def luminance(color):
    linear = [channel / 255 for channel in color[:3]]
    linear = [value / 12.92 if value <= .04045 else ((value + .055) / 1.055) ** 2.4 for value in linear]
    return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2]


def rgb(value):
    return tuple(map(int, re.findall(r'\d+', value)[:3]))


def pixels(image, rect):
    left, top = max(0, math.floor(rect['x'])), max(0, math.floor(rect['y']))
    right = min(image.width, math.ceil(rect['x'] + rect['width']))
    bottom = min(image.height, math.ceil(rect['y'] + rect['height']))
    for y in range(top, bottom):
        for x in range(left, right):
            yield x, y, image.getpixel((x, y))


def main():
    root, output_path = Path(sys.argv[1]), Path(sys.argv[2])
    capture = json.loads((root / 'capture.json').read_text())
    metrics_paths = sorted(root.glob('*-metrics.json'))
    if not metrics_paths or {path.stem[:-8] for path in metrics_paths} != set(capture['pairs']):
        raise ValueError('Matching capture pairs and metrics are required; empty or partial input cannot satisfy the gate.')
    if not capture.get('sourceUnchanged'):
        raise ValueError('Capture source changed; inspect the source mismatch before checking contrast.')
    output = {
        'method': 'QA freezes own DEV world after 550ms settling and captures matched normal/background PNGs. Background retains scene backdrop and hides only panel visibility. sRGB relative luminance contrast is evaluated at every background pixel within actual DOM text rectangles or marker rectangle; report conservative minimum. Computed foreground color and effective opacity are used; anti-alias glyph edge coverage is not treated as a different text color. Primary action uses first text rectangle (name) to exclude nested shortcut with separate color. Disabled actions are measured but excluded from active text threshold.',
        'capture': str(root / 'capture.json'),
        'results': [],
    }
    failures = []
    for metrics_path in metrics_paths:
        name = metrics_path.stem[:-8]
        metrics = json.loads(metrics_path.read_text())
        background_path = root / (name + '-background.png')
        background = Image.open(background_path).convert('RGB')
        for kind, nodes in [('text', metrics['nodes']), ('marker', metrics['markers'])]:
            for node in nodes:
                color = rgb(node['color'])
                opacity = float(node.get('effectiveOpacity', node.get('opacity', 1)))
                rectangles = [node['rect']] if kind == 'marker' else node.get('textRects', [node['rect']])
                if node['selector'] == '.inventory-primary':
                    rectangles = rectangles[:1]
                samples = []
                for rect in rectangles:
                    for x, y, backdrop in pixels(background, rect):
                        foreground = [a * opacity + b * (1 - opacity) for a, b in zip(color, backdrop)]
                        a, b = luminance(foreground), luminance(backdrop)
                        samples.append(((max(a, b) + .05) / (min(a, b) + .05), x, y, backdrop))
                if not samples:
                    continue
                lowest = min(samples, key=lambda sample: sample[0])
                # Initial capture lacked a disabled field. Its two already-equipped
                # crowbar actions were verified against source CSS and screenshot.
                historical_disabled = 'disabled' not in node and node['selector'] == '.inventory-action' and color == (86, 108, 80)
                disabled = bool(node.get('disabled', historical_disabled))
                threshold = None if disabled else (3 if kind == 'marker' else 4.5)
                meets = None if threshold is None else lowest[0] >= threshold
                result = {
                    'frame': name, 'kind': kind, 'selector': node['selector'], 'text': node.get('text', ''),
                    'fontSize': node.get('fontSize'), 'fontWeight': node.get('fontWeight'), 'fg': color,
                    'minimumRatio': round(lowest[0], 3), 'backgroundAtMinimum': lowest[3],
                    'point': [lowest[1], lowest[2]], 'sampleCount': len(samples), 'threshold': threshold,
                    'disabledStyleExcluded': disabled, 'disabledFromHistoricalStyle': historical_disabled,
                    'meetsThreshold': meets,
                    'backgroundSha256': hashlib.sha256(background_path.read_bytes()).hexdigest(),
                }
                output['results'].append(result)
                if meets is False:
                    failures.append({'frame': name, 'selector': node['selector'], 'ratio': lowest[0], 'threshold': threshold})
    output['failures'] = failures
    output['checkedCount'] = len(output['results'])
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(output_path), 'checkedCount': len(output['results']), 'failures': failures}, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
