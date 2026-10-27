import type { Palette, Scheme } from './theme';

export type MapPoint = { id: string; lat: number; lon: number; title: string; text: string };

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const MAP_BASE_URL = 'https://akira-dude.github.io/plenka/';
const DARK_TILES = '.leaflet-tile-pane { filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9); }';

const toScript = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export function buildMapHtml(points: MapPoint[], focus: string | null, scheme: Scheme, c: Palette): string {
  return `<!doctype html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css">
<style>
  html, body, #map { height: 100%; margin: 0; background: ${c.bg}; }
  body { font-family: sans-serif; color: ${c.ink}; }
  .offline { padding: 24px; color: ${c.muted}; font-size: 15px; }
  .leaflet-popup-content-wrapper, .leaflet-popup-tip { background: ${c.card}; color: ${c.ink}; }
  .pop b { display: block; font-family: monospace; font-size: 12px; color: ${c.muted}; margin-bottom: 4px; }
  .pop p { margin: 0 0 8px; font-size: 14px; }
  .pop button { border: 0; border-radius: 8px; padding: 6px 10px; background: ${c.accent}; color: ${c.onAccent}; font-size: 13px; }
  ${scheme === 'dark' ? DARK_TILES : ''}
</style>
</head><body>
<div id="map"></div>
<script src="${LEAFLET}/leaflet.js"></script>
<script>
  const points = ${toScript(points)};
  const focus = ${toScript(focus)};
  const escape = (s) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  const openPost = (id) => window.ReactNativeWebView.postMessage(id);
  if (!window.L) {
    document.getElementById('map').innerHTML = '<div class="offline">Для карты нужен интернет: подложка и библиотека карт загружаются из сети.</div>';
  } else {
    const map = L.map('map', { zoomControl: false, worldCopyJump: true });
    L.tileLayer(${toScript(TILES)}, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const markers = {};
    for (const p of points) {
      const marker = L.circleMarker([p.lat, p.lon], {
        radius: 8, weight: 2, color: ${toScript(c.card)}, fillColor: ${toScript(c.accent)}, fillOpacity: 1,
      }).addTo(map);
      const text = p.text ? '<p>' + escape(p.text) + '</p>' : '';
      marker.bindPopup('<div class="pop"><b>' + escape(p.title) + '</b>' + text + '<button onclick="openPost(\\'' + p.id + '\\')">Открыть запись</button></div>');
      markers[p.id] = marker;
    }
    if (focus && markers[focus]) {
      map.setView(markers[focus].getLatLng(), 15);
      markers[focus].openPopup();
    } else if (points.length) {
      map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon])), { padding: [40, 40], maxZoom: 14 });
    } else {
      map.setView([30, 10], 2);
    }
  }
</script>
</body></html>`;
}
