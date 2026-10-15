// Interactive tree viewer client script. Served at GET /viewer.js so the
// viewer page ships a file instead of one inline blob (ticket 01).
import { BUILD_ID } from "./pages";

export const VIEWER_JS = `(() => {
const mount = document.getElementById('viewer');
const svg = document.getElementById('stage');
const drawer = document.getElementById('drawer');
const counts = document.getElementById('counts');
const rootName = document.getElementById('rootName');
const personSearch = document.getElementById('treeSearch');
const suggestions = document.getElementById('personSuggestions');
const outlinePanel = document.getElementById('outline');
const outlineBtn = document.getElementById('outlineBtn');
const NS = 'http://www.w3.org/2000/svg';
const ICON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
const ICON_CLOSE = ICON_SVG + '<path d="M6 6l12 12"/><path d="M18 6 6 18"/></svg>';
const ICON_EXPAND = ICON_SVG + '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>';
const ICON_COLLAPSE = ICON_SVG + '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l6-6"/><path d="M10 14l-6 6"/></svg>';
// Canvas colors come from the same design tokens as the page chrome so the
// SVG wires and fan ramp can never drift from the stylesheet palette.
const rootStyle = getComputedStyle(document.documentElement);
const token = (name, fallback) => (rootStyle.getPropertyValue(name) || '').trim() || fallback;
const WIRE = token('--wire', '#98a2ac');
const mixWhite = (hex, t) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0x3e5c74;
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => Math.round(255 + (c - 255) * t));
  return 'rgb(' + ch.join(',') + ')';
};
const FAN_RAMP = [0.06, 0.18, 0.3, 0.42, 0.54, 0.66, 0.78].map(t => mixWhite(token('--fan-base', '#3e5c74'), t));
let W = Number(mount.dataset.w), H = Number(mount.dataset.h);
let root = mount.dataset.root, depth = mount.dataset.depth || 'all';
let currentView = mount.dataset.view || 'family';
let collapsed = new Set((mount.dataset.collapsed || '').split(',').filter(Boolean));
let expandedAncestors = new Set((mount.dataset.expanded || '').split(',').filter(Boolean));
let sibExpanded = new Set((mount.dataset.sibexp || '').split(',').filter(Boolean));
let minimizedAncestors = new Set((mount.dataset.minimized || '').split(',').filter(Boolean));
let showSiblings = mount.dataset.siblings === '1';
let nodes = [], edges = [], buses = [], worldW = 1, worldH = 1, totalPeople = 0;
let scale = 1, tx = 0, ty = 0, selected = null, highlightIds = new Set();
const settingsKey = 'heritage-viewer-settings';
console.info('[heritage] viewer build ${BUILD_ID} — hard-refresh after server restarts; check x-heritage-build header to confirm');
let settings = { showPhotos: false, showYears: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem(settingsKey) || '{}')); } catch {}
delete settings.defaultView;
const saveSettings = () => { try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch {} };
const apply = () => viewport.setAttribute('transform', 'translate(' + tx + ' ' + ty + ') scale(' + scale + ')');
let viewport;
const el = (tag, attrs, text) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (text !== undefined) n.textContent = text;
  return n;
};
function focusBranch(id, name, afterLoad) {
  root = id;
  rootName.textContent = name;
  collapsed.clear();
  expandedAncestors.clear();
  minimizedAncestors.clear();
  sibExpanded.clear();
  showSiblings = true;
  selected = null;
  highlightIds = new Set();
  drawer.hidden = true;
  suggestions.hidden = true;
  personSearch.value = '';
  load().then(() => { if (afterLoad) afterLoad(); });
}
let searchTimer = 0, searchRequest = 0;
async function searchPeople(term) {
  const requestId = ++searchRequest;
  if (term.trim().length < 2) { suggestions.hidden = true; return; }
  const res = await fetch('/api/people?q=' + encodeURIComponent(term.trim()));
  if (!res.ok || requestId !== searchRequest) return;
  const data = await res.json();
  if (requestId !== searchRequest) return;
  suggestions.replaceChildren();
  for (const person of data.people) {
    const option = document.createElement('button');
    option.type = 'button'; option.className = 'person-suggestion'; option.textContent = person.name;
    option.addEventListener('click', () => focusBranch(person.id, person.name));
    suggestions.appendChild(option);
  }
  if (!data.people.length) {
    const empty = document.createElement('span'); empty.className = 'person-suggestion empty'; empty.textContent = 'No people found';
    suggestions.appendChild(empty);
  } else if (data.total > data.people.length) {
    const more = document.createElement('span'); more.className = 'person-suggestion empty'; more.textContent = 'Keep typing to narrow ' + data.total + ' matches';
    suggestions.appendChild(more);
  }
  suggestions.hidden = false;
}
async function load(syncUrl, recenter) {
  const q = new URLSearchParams({ root });
  q.set('view', currentView);
  q.set('depth', depth);
  if (collapsed.size) q.set('collapsed', [...collapsed].join(','));
  if (expandedAncestors.size) q.set('expand', [...expandedAncestors].join(','));
  if (minimizedAncestors.size) q.set('min', [...minimizedAncestors].join(','));
  if (sibExpanded.size) q.set('siblingsOf', [...sibExpanded].join(','));
  q.set('siblings', showSiblings ? '1' : '0');
  q.set('years', settings.showYears ? '1' : '0');
  q.set('photos', settings.showPhotos ? '1' : '0');
  if (syncUrl !== false) {
    const url = new URL(location.href);
    url.searchParams.set('root', root);
    if (currentView === 'family') url.searchParams.delete('view'); else url.searchParams.set('view', currentView);
    url.searchParams.set('depth', depth);
    if (collapsed.size) url.searchParams.set('collapsed', [...collapsed].join(',')); else url.searchParams.delete('collapsed');
    if (expandedAncestors.size) url.searchParams.set('expand', [...expandedAncestors].join(',')); else url.searchParams.delete('expand');
    if (minimizedAncestors.size) url.searchParams.set('min', [...minimizedAncestors].join(',')); else url.searchParams.delete('min');
    if (sibExpanded.size) url.searchParams.set('siblingsOf', [...sibExpanded].join(',')); else url.searchParams.delete('siblingsOf');
    url.searchParams.set('siblings', showSiblings ? '1' : '0');
    url.searchParams.set('years', settings.showYears ? '1' : '0');
    url.searchParams.set('photos', settings.showPhotos ? '1' : '0');
    history.replaceState(null, '', url);
  }
  const res = await fetch('/api/tree?' + q);
  if (!res.ok) { counts.textContent = 'tree failed to load'; return; }
  const data = await res.json();
  nodes = data.nodes; edges = data.edges; buses = data.buses || []; worldW = data.width; worldH = data.height; totalPeople = data.totalPeople;
  W = data.nodeWidth || W; H = data.nodeHeight || H; currentView = data.view || currentView;
  rootName.textContent = nodes.find(n => n.personId === root)?.name || 'Selected person';
  const siblingButton = document.getElementById('siblingsBtn');
  siblingButton.hidden = !data.siblingCount;
  siblingButton.textContent = showSiblings ? 'Hide siblings' : 'Show siblings (' + data.siblingCount + ')';
  siblingButton.setAttribute('aria-pressed', String(showSiblings));
  const notice = document.getElementById('treeNotice');
  notice.replaceChildren();
  if (data.truncatedCount) {
    notice.hidden = false;
    notice.append('Showing up to ' + (data.limit || 500) + ' people of ' + totalPeople + '. Use the ');
    const depthBtn = document.createElement('button');
    depthBtn.type = 'button';
    depthBtn.textContent = 'Generations control';
    depthBtn.addEventListener('click', () => document.getElementById('depthSel').focus());
    notice.append(depthBtn);
    if (!siblingButton.hidden) {
      notice.append(' or ');
      const sibBtn = document.createElement('button');
      sibBtn.type = 'button';
      sibBtn.textContent = 'siblings control';
      sibBtn.addEventListener('click', () => siblingButton.click());
      notice.append(sibBtn);
    }
    notice.append(' to reveal more of the tree.');
  } else {
    notice.hidden = true;
  }
  counts.textContent = nodes.filter(n => !n.kind).length + ' people shown';
  draw();
  lastTreeQuery = q.toString();
  if (outlinePanel && !outlinePanel.hidden) refreshOutline();
  if (recenter !== false) centerOnRoot();
}
let outlineReq = 0;
let lastTreeQuery = '';
function refreshOutline() {
  const seq = ++outlineReq;
  fetch('/api/outline?' + lastTreeQuery)
    .then(r => (r.ok ? r.json() : null))
    .then(data => { if (seq === outlineReq) renderOutline(data); })
    .catch(() => {});
}
function renderOutline(data) {
  if (!outlinePanel) return;
  outlinePanel.replaceChildren();
  if (!data || !data.tree) return;
  const h = document.createElement('h2');
  h.textContent = 'Outline';
  outlinePanel.appendChild(h);
  const list = document.createElement('ul');
  list.className = 'outline-list';
  list.appendChild(outlineEntry(data.tree, true));
  outlinePanel.appendChild(list);
}
function outlineEntry(node, isFocus) {
  const li = document.createElement('li');
  if (isFocus) li.className = 'outline-focus';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = node.name;
  const badges = [];
  if (node.hiddenAncestors) badges.push('↑ ' + node.hiddenAncestors);
  if (node.hiddenDescendants) badges.push('↓ ' + node.hiddenDescendants);
  if (badges.length) {
    const badge = document.createElement('span');
    badge.className = 'outline-count';
    badge.textContent = badges.join(' ');
    badge.title = 'Hidden people in this branch';
    btn.appendChild(badge);
  }
  btn.addEventListener('click', () => focusBranch(node.id, node.name, () => select(node.id)));
  li.appendChild(btn);
  const kids = [...node.parents, ...node.children];
  if (kids.length) {
    const ul = document.createElement('ul');
    for (const kid of kids) ul.appendChild(outlineEntry(kid, false));
    li.appendChild(ul);
  }
  return li;
}
function draw() {
  svg.replaceChildren();
  viewport = el('g', {});
  svg.appendChild(viewport);
  const byId = new Map(nodes.map(n => [n.personId, n]));
  // MyHeritage Family-view wiring: spouses read as a couple by proximity
  // (no bar between cards); children hang off a horizontal bus dropped
  // from the parents' midpoint. Every corner is rounded (radius R) exactly
  // like MyHeritage — the server precomputes bus geometry, we fillet here.
  // WIRE is the shared connector token (see top of viewer).
  // Generous MyHeritage-like corner radius (~0.09 × card width). Crowded
  // ends (a kid within one diameter of the drop) stay straight instead.
  const R = 20;
  const sameX = (a, b) => Math.abs(a - b) < 0.01;
  const path = (d) => viewport.appendChild(el('path', { d, fill: 'none', stroke: WIRE, 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  for (const e of edges) {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) continue;
    if (currentView === 'fan') {
      const x1 = a.x + W / 2, y1 = a.y + H / 2, x2 = b.x + W / 2, y2 = b.y + H / 2;
      viewport.appendChild(el('path', { d: 'M' + x1 + ' ' + y1 + ' Q' + (worldW / 2) + ' ' + (worldH - H / 2) + ' ' + x2 + ' ' + y2, fill: 'none', stroke: WIRE, 'stroke-width': 1.25 }));
    } else if (e.kind === 'parent' && !buses.length) {
      const x1 = a.x + W / 2, y1 = a.y + H, x2 = b.x + W / 2, y2 = b.y;
      if (y2 <= y1) continue;
      const mid = (y1 + y2) / 2, s = x2 >= x1 ? 1 : -1;
      if (Math.abs(x2 - x1) < 2 * R || (mid - y1) < R || (y2 - mid) < R) {
        path('M' + x1 + ' ' + y1 + ' V' + mid + ' H' + x2 + ' V' + y2);
      } else {
        path('M' + x1 + ' ' + y1 + ' V' + (mid - R) + ' Q' + x1 + ' ' + mid + ' ' + (x1 + s * R) + ' ' + mid + ' H' + (x2 - s * R) + ' Q' + x2 + ' ' + mid + ' ' + x2 + ' ' + (mid + R) + ' V' + y2);
      }
    }
  }
  for (const b of buses) {
    const legs = Array.isArray(b.legs) && b.legs.length ? [...b.legs].sort((p, q) => p - q) : [b.x];
    const pbot = typeof b.pbot === 'number' ? b.pbot : b.top;
    const span = [...legs, ...b.kids];
    const left = Math.min(...span), right = Math.max(...span);
    if (sameX(left, right)) {
      path('M' + left + ' ' + Math.min(pbot, b.kidTop) + ' V' + Math.max(pbot, b.kidTop));
      continue;
    }
    // Rounded elbows at every bus span end — whether the vertical is a
    // parent drop (card→bus) or a child drop (bus→card). Exactly one curve
    // per end (kid wins if both share the end); the bus meets elbow tips.
    const roomy = right - left > 2 * R + 4;
    const legAt = (x) => legs.some((v) => sameX(v, x));
    const kidAt = (x) => b.kids.some((kx) => sameX(kx, x));
    const elbowLeft = roomy && (kidAt(left) || (!kidAt(left) && legAt(left)));
    const elbowRight = roomy && (kidAt(right) || (!kidAt(right) && legAt(right)));
    // Parent drops: straight verticals; rounded elbow only at bus ends.
    for (const lx of legs) {
      if (sameX(lx, left) && elbowLeft && !kidAt(left)) {
        path('M' + lx + ' ' + pbot + ' V' + (b.bus - R) + ' Q' + lx + ' ' + b.bus + ' ' + (lx + R) + ' ' + b.bus);
      } else if (sameX(lx, right) && elbowRight && !kidAt(right)) {
        path('M' + lx + ' ' + pbot + ' V' + (b.bus - R) + ' Q' + lx + ' ' + b.bus + ' ' + (lx - R) + ' ' + b.bus);
      } else {
        path('M' + lx + ' ' + pbot + ' V' + b.bus);
      }
    }
    // Kid drops: rounded elbow at bus ends, straight T-joint in the middle.
    for (const kx of b.kids) {
      if (sameX(kx, left) && elbowLeft) {
        path('M' + (kx + R) + ' ' + b.bus + ' Q' + kx + ' ' + b.bus + ' ' + kx + ' ' + (b.bus + R) + ' V' + b.kidTop);
      } else if (sameX(kx, right) && elbowRight) {
        path('M' + (kx - R) + ' ' + b.bus + ' Q' + kx + ' ' + b.bus + ' ' + kx + ' ' + (b.bus + R) + ' V' + b.kidTop);
      } else {
        path('M' + kx + ' ' + b.bus + ' V' + b.kidTop);
      }
    }
    // Bus bar meets elbow tips exactly — tangent-continuous, never overlaps.
    const h0 = left + (elbowLeft ? R : 0), h1 = right - (elbowRight ? R : 0);
    path('M' + h0 + ' ' + b.bus + ' H' + Math.max(h1, h0));
  }
  const search = (document.getElementById('treeSearch').value || '').trim().toLowerCase();
  const matchCount = search ? nodes.filter(n => n.name && n.name.toLowerCase().includes(search)).length : nodes.length;
  counts.textContent = search
    ? (matchCount ? matchCount + ' match' + (matchCount === 1 ? '' : 'es') : 'No matches') + ' · ' + totalPeople + ' in tree'
    : nodes.filter(n => !n.kind).length + ' shown · ' + totalPeople + ' in tree';
  for (const n of nodes) {
    // Placeholder cards stand in for a hidden branch: dashed outline, the
    // branch's display name and both hidden counts. Click expands the cut.
    if (n.kind === 'placeholder') {
      const parts = [];
      if (n.hiddenDescendants) parts.push(n.hiddenDescendants + ' hidden below');
      if (n.hiddenAncestors) parts.push(n.hiddenAncestors + ' hidden above');
      const label = n.label || 'Hidden branch';
      const pg = el('g', { class: 'node placeholder', tabindex: '0', role: 'button', 'aria-label': label + ': ' + (parts.join(', ') || 'hidden people') });
      pg.appendChild(el('rect', { x: n.x, y: n.y, width: W, height: n.h || 56, rx: 8 }));
      pg.appendChild(el('text', { class: 'node-name', x: n.x + 12, y: n.y + 20, 'font-size': 13 }, label.length > 26 ? label.slice(0, 25) + '…' : label));
      pg.appendChild(el('text', { class: 'node-sub', x: n.x + 12, y: n.y + 40, 'font-size': 11 }, parts.join(' · ') || 'Hidden branch'));
      pg.appendChild(el('title', {}, label + ' — click to expand'));
      const expand = ev => {
        ev.preventDefault(); ev.stopPropagation();
        if (n.direction === 'above') {
          minimizedAncestors.delete(n.anchorId);
          expandedAncestors.add(n.anchorId);
        } else if (n.collapsed) {
          (n.branchFamilyIds || []).forEach(id => collapsed.delete(id));
        } else if (n.atDepthLimit && depth && Number.isFinite(Number(depth))) {
          depth = String(Math.min(12, Number(depth) + 1));
        }
        load();
      };
      pg.addEventListener('click', expand);
      pg.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') expand(ev); });
      pg.addEventListener('pointerdown', ev => ev.stopPropagation());
      viewport.appendChild(pg);
      continue;
    }
    const matches = !search || n.name.toLowerCase().includes(search);
    const sexCls = n.sex === 'M' ? 'sex-m' : n.sex === 'F' ? 'sex-f' : 'sex-u';
    const g = el('g', { class: 'node ' + sexCls + (selected === n.personId ? ' selected' : '') + (n.isFocus ? ' focus' : '') + (highlightIds.has(n.personId) ? ' sib' : '') + (!matches ? ' dimmed' : ''), tabindex: '0', role: 'button', 'aria-label': n.name });
    if (currentView === 'fan') {
      const fanColors = FAN_RAMP;
      const radius = Math.min(W, H) * 0.34;
      const cx = n.x + W / 2, cy = n.y + H / 2;
      if (settings.showPhotos) {
        const initials = n.name.split(/\\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
        g.appendChild(el('circle', { class: 'fan-person', cx, cy, r: radius, fill: fanColors[Math.min(fanColors.length - 1, Math.abs(n.generation))] }));
        g.appendChild(el('text', { class: 'fan-initials', x: cx, y: cy + 4, 'font-size': 11, 'text-anchor': 'middle' }, initials || '?'));
      }
      const shortName = n.name.split(/\\s+/).filter(Boolean).slice(-1)[0] || n.name;
      g.appendChild(el('text', { class: 'fan-name', x: cx, y: cy + radius + 14, 'font-size': 9, 'text-anchor': 'middle' }, shortName.length > 12 ? shortName.slice(0, 11) + '…' : shortName));
      g.appendChild(el('title', {}, n.name));
    } else {
      const nh = n.h || H;
      g.appendChild(el('rect', { x: n.x, y: n.y, width: W, height: nh, rx: 8, class: n.isFocus ? 'focus-card' : '' }));
      // MyHeritage horizontal cards: name (+ years) only when photos are
      // off; round avatar left of the text when photos are on.
      let textX = n.x + 12;
      if (settings.showPhotos) {
        const avatarSize = Math.min(44, nh - 16);
        const avatarX = n.x + 14 + avatarSize / 2;
        const avatarY = n.y + nh / 2;
        const avKind = n.sex === 'M' ? 'm' : n.sex === 'F' ? 'f' : 'u';
        if (n.photo && new RegExp('^https?://', 'i').test(n.photo)) {
          g.appendChild(el('image', { href: n.photo, x: avatarX - avatarSize / 2, y: avatarY - avatarSize / 2, width: avatarSize, height: avatarSize, preserveAspectRatio: 'xMidYMid slice' }));
        } else {
          const initials = n.name.split(/\\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
          g.appendChild(el('circle', { class: 'node-avatar-' + avKind, cx: avatarX, cy: avatarY, r: avatarSize / 2 }));
          g.appendChild(el('text', { class: 'node-initials-' + avKind, x: avatarX, y: avatarY + 4.5, 'font-size': 13, 'text-anchor': 'middle' }, initials || '?'));
        }
        textX = n.x + avatarSize + 24;
      }
      const nameLines = Array.isArray(n.nameLines) && n.nameLines.length ? n.nameLines : [n.name];
      const nameY = settings.showYears ? n.y + 40 : n.y + nh / 2 + 5;
      nameLines.forEach((line) => {
        g.appendChild(el('text', { class: 'node-name', x: textX, y: nameY, 'font-size': 14 }, line.length > 26 ? line.slice(0, 25) + '…' : line));
      });
      g.appendChild(el('title', {}, n.name));
      if (settings.showYears) {
        const years = [n.birthYear, n.deathYear].filter(Boolean).join(' – ');
        g.appendChild(el('text', { class: 'node-sub', x: textX, y: n.y + nh - 14, 'font-size': 12 }, years || (!n.living ? 'Deceased' : 'Living')));
      }
    }
    // Collapse toggle below the card while the branch is visible: "−"
    // collapses it; the layout then answers with a placeholder card that
    // carries the hidden counts and expands the branch again on click.
    if (n.hasDescendants && currentView === 'family' && !n.collapsed && !n.atDepthLimit) {
      const min = el('a', { href: '#', role: 'button', 'aria-label': 'Collapse branch of ' + n.name + ' (' + n.descendantCount + ' descendants)', title: 'Minimize this branch', class: 'branch-toggle' });
      min.appendChild(el('circle', { class: 'node-add-bg', cx: n.x + W / 2, cy: n.y + (n.h || H) + 14, r: 11 }));
      min.appendChild(el('text', { class: 'node-add', x: n.x + W / 2, y: n.y + (n.h || H) + 19, 'font-size': 14, 'text-anchor': 'middle' }, '−'));
      min.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); n.branchFamilyIds.forEach(id => collapsed.add(id)); load(); });
      min.addEventListener('pointerdown', ev => ev.stopPropagation());
      g.appendChild(min);
    }
    // Minimize a shown parent line: "−" hides it upstream; the layout
    // replaces it with an ancestor placeholder that expands independently
    // per line (no accordion).
    if (n.hasAncestors && !n.hasHiddenParents && currentView === 'family') {
      const down = el('a', { href: '#', role: 'button', 'aria-label': 'Hide parents of ' + n.name, title: 'Minimize this parent line', class: 'branch-toggle' });
      down.appendChild(el('circle', { class: 'node-add-bg', cx: n.x + W / 2, cy: n.y - 14, r: 11 }));
      down.appendChild(el('text', { class: 'node-add', x: n.x + W / 2, y: n.y - 9, 'font-size': 14, 'text-anchor': 'middle' }, '−'));
      down.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); minimizedAncestors.add(n.personId); load(); });
      down.addEventListener('pointerdown', ev => ev.stopPropagation());
      g.appendChild(down);
    }
    g.addEventListener('pointerdown', ev => ev.stopPropagation());
    g.addEventListener('click', ev => { ev.stopPropagation(); select(n.personId); });
    g.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(n.personId); } });
    g.addEventListener('dblclick', ev => { ev.stopPropagation(); focusBranch(n.personId, n.name); });
    viewport.appendChild(g);
  }
  apply();
}
function fit() {
  const r = svg.getBoundingClientRect();
  scale = Math.min(r.width / Math.max(worldW, 1), r.height / Math.max(worldH, 1), 1.35);
  tx = (r.width - worldW * scale) / 2; ty = (r.height - worldH * scale) / 2;
  apply();
}
// MyHeritage opens centered on the main person at reading zoom, not
// fit-to-width (wide ancestor pyramids would shrink cards to dots).
function centerOnRoot() {
  const r = svg.getBoundingClientRect();
  const me = nodes.find(n => n.personId === root) || nodes.find(n => n.isFocus);
  scale = 1;
  const cx = me ? me.x + W / 2 : worldW / 2;
  const cy = me ? me.y + (me.h || H) / 2 : worldH / 2;
  tx = r.width / 2 - cx * scale; ty = r.height / 2 - cy * scale;
  apply();
}
function zoomAt(cx, cy, factor) {
  const next = Math.min(4, Math.max(0.15, scale * factor));
  tx = cx - (cx - tx) * (next / scale); ty = cy - (cy - ty) * (next / scale);
  scale = next; apply();
}
async function select(id) {
  selected = id;
  highlightIds = new Set();
  const me = nodes.find(n => n.personId === id);
  if (me) {
    const cx = me.x + W / 2;
    // Siblings: fellow kids off the same bus bars (geometry carries this;
    // the API below covers parents/partners/children by id instead).
    for (const b of buses) {
      if (b.kids.some(kx => Math.abs(kx - cx) < 0.01)) {
        for (const kx of b.kids) {
          const sib = nodes.find(n => Math.abs((n.x + W / 2) - kx) < 0.01);
          if (sib && sib.personId !== id) highlightIds.add(sib.personId);
        }
      }
    }
  }
  draw();
  const res = await fetch('/api/person/' + encodeURIComponent(id));
  if (!res.ok) return;
  const p = await res.json();
  // Trace the immediate family by id: parents, partners, children, plus
  // the geometric siblings above. Answers "whose child is this?" in one
  // click, at any generation.
  for (const list of [p.parents, p.partners, p.children, p.siblings || []]) {
    for (const q of list || []) {
      if (q && q.id !== id && nodes.some(n => n.personId === q.id)) highlightIds.add(q.id);
    }
  }
  draw();
  drawer.replaceChildren();
  const closeTop = document.createElement('button'); closeTop.type = 'button'; closeTop.className = 'icon-button drawer-close'; closeTop.setAttribute('aria-label', 'Close details'); closeTop.innerHTML = ICON_CLOSE;
  closeTop.addEventListener('click', () => { drawer.hidden = true; selected = null; highlightIds = new Set(); draw(); }); drawer.appendChild(closeTop);
  const h = document.createElement('h2'); h.textContent = p.name; drawer.appendChild(h);
  const meta = document.createElement('p'); meta.className = 'muted';
  meta.textContent = [p.sex, p.living ? 'living' : 'deceased', [p.birthYear, p.deathYear].filter(Boolean).join('–')].filter(Boolean).join(' · ');
  drawer.appendChild(meta);
  const factTitle = document.createElement('h3'); factTitle.textContent = 'Life events'; drawer.appendChild(factTitle);
  const ul = document.createElement('div');
  for (const f of p.facts) {
    const li = document.createElement('div'); li.className = 'drawer-fact';
    li.textContent = f.type + (f.date ? ' ' + f.date : '') + (f.place ? ', ' + f.place : '');
    ul.appendChild(li);
  }
  if (!p.facts.length) { const li = document.createElement('div'); li.className = 'drawer-fact muted'; li.textContent = 'No life events yet'; ul.appendChild(li); }
  drawer.appendChild(ul);
  const rel = (title, list) => {
    const h3 = document.createElement('h3'); h3.textContent = title; drawer.appendChild(h3);
    const d = document.createElement('div');
    list.forEach((q, i) => {
      if (i) d.appendChild(document.createTextNode(', '));
      const a = document.createElement('a'); a.href = '#'; a.textContent = q.name;
      a.addEventListener('click', ev => { ev.preventDefault();
        if (!nodes.some(n => n.personId === q.id)) { focusBranch(q.id, q.name, () => select(q.id)); }
        else select(q.id);
      });
      d.appendChild(a);
    });
    if (!list.length) d.textContent = '—';
    drawer.appendChild(d);
  };
  rel('Parents', p.parents); rel('Partners', p.partners); rel('Children', p.children);
  if ((p.siblingCount || 0) > 0) {
    const globallyShown = new URL(location.href).searchParams.get('siblings') !== '0';
    const shown = globallyShown || sibExpanded.has(p.id);
    if (!shown) {
      const sibBtn = document.createElement('button');
      sibBtn.type = 'button'; sibBtn.className = 'secondary'; sibBtn.style.marginTop = '10px';
      sibBtn.textContent = 'Show ' + p.siblingCount + ' sibling' + (p.siblingCount === 1 ? '' : 's');
      sibBtn.setAttribute('aria-pressed', 'false');
      sibBtn.addEventListener('click', () => {
        sibExpanded.add(p.id);
        load().then(() => select(p.id));
      });
      drawer.appendChild(sibBtn);
    }
  }
  const actions = document.createElement('div'); actions.className = 'drawer-actions';
  const ea = document.createElement('a'); ea.className = 'secondary edit-only'; ea.href = '/person/' + p.id; ea.textContent = 'Edit record';
  actions.appendChild(ea);
  const ka = document.createElement('a'); ka.className = 'primary edit-only'; ka.href = '/person/' + p.id + '#add-kin'; ka.textContent = 'Add family';
  actions.appendChild(ka); drawer.appendChild(actions);
  const focus = document.createElement('button'); focus.type = 'button'; focus.className = 'secondary'; focus.style.marginTop = '10px'; focus.textContent = 'Center tree here';
  focus.addEventListener('click', () => focusBranch(p.id, p.name));
  drawer.appendChild(focus);
  drawer.hidden = false;
}
let drag = null;
svg.addEventListener('pointerdown', ev => { drag = { x: ev.clientX, y: ev.clientY, tx, ty }; svg.setPointerCapture(ev.pointerId); });
svg.addEventListener('pointermove', ev => {
  if (!drag) return;
  tx = drag.tx + (ev.clientX - drag.x); ty = drag.ty + (ev.clientY - drag.y); apply();
});
svg.addEventListener('pointerup', () => { drag = null; });
svg.addEventListener('wheel', ev => {
  ev.preventDefault();
  const r = svg.getBoundingClientRect();
  zoomAt(ev.clientX - r.left, ev.clientY - r.top, ev.deltaY < 0 ? 1.12 : 1 / 1.12);
}, { passive: false });
svg.addEventListener('click', () => { drawer.hidden = true; selected = null; highlightIds = new Set(); draw(); });
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !drawer.hidden) { drawer.hidden = true; selected = null; highlightIds = new Set(); draw(); } });
document.getElementById('fitBtn').addEventListener('click', fit);
document.getElementById('homeBtn').addEventListener('click', centerOnRoot);
document.getElementById('zoomIn').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.25); });
document.getElementById('zoomOut').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / 1.25); });
const fullBtn = document.getElementById('fullBtn');
const shell = mount.closest('.canvas-shell') || mount;
if (!document.fullscreenEnabled) {
  fullBtn.hidden = true;
} else {
  fullBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else { const p = shell.requestFullscreen(); if (p && p.catch) p.catch(() => {}); }
  });
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    fullBtn.innerHTML = on ? ICON_COLLAPSE : ICON_EXPAND;
    fullBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'View full screen');
    fit();
  });
}
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
const setPhotos = document.getElementById('setPhotos');
const setYears = document.getElementById('setYears');
setPhotos.checked = settings.showPhotos;
setYears.checked = settings.showYears;
settingsBtn.addEventListener('click', ev => {
  ev.stopPropagation();
  const open = settingsMenu.hidden;
  settingsMenu.hidden = !open;
  settingsBtn.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', ev => {
  if (!ev.target.closest('.toolbar-menu-wrap')) { settingsMenu.hidden = true; settingsBtn.setAttribute('aria-expanded', 'false'); }
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && !settingsMenu.hidden) { settingsMenu.hidden = true; settingsBtn.setAttribute('aria-expanded', 'false'); }
});
setPhotos.addEventListener('change', () => { settings.showPhotos = setPhotos.checked; saveSettings(); load(undefined, false); });
setYears.addEventListener('change', () => { settings.showYears = setYears.checked; saveSettings(); load(undefined, false); });
document.getElementById('depthSel').addEventListener('change', ev => { depth = ev.target.value; load(); });
outlineBtn.addEventListener('click', ev => {
  ev.stopPropagation();
  const open = outlinePanel.hidden;
  outlinePanel.hidden = !open;
  outlineBtn.setAttribute('aria-expanded', String(open));
  if (open) refreshOutline();
});
// Print: clear search dimming, state the title, fit the chart, print.
// The print stylesheet hides the chrome; matchMedia refits to paper size.
const printBtn = document.getElementById('printBtn');
const printTitle = document.getElementById('printTitle');
const printMedia = window.matchMedia('print');
if (printMedia.addEventListener) printMedia.addEventListener('change', ev => { if (ev.matches) fit(); });
printBtn.addEventListener('click', () => {
  const prevSearch = personSearch.value;
  const prevZoom = { scale, tx, ty };
  personSearch.value = '';
  draw();
  const viewLabel = currentView === 'pedigree' ? 'Pedigree view' : currentView === 'fan' ? 'Fan view' : 'Family tree';
  printTitle.textContent = rootName.textContent + ' · ' + viewLabel + ' · ' + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  fit();
  window.print();
  personSearch.value = prevSearch;
  scale = prevZoom.scale; tx = prevZoom.tx; ty = prevZoom.ty;
  apply();
  draw();
});
// Download SVG: clone the stage, inline resolved styles (the page
// stylesheet does not travel with the file), reset pan and zoom, download.
// The search stays as it is, so the file matches the current view exactly.
document.getElementById('svgBtn').addEventListener('click', () => {
  const clone = svg.cloneNode(true);
  const srcEls = svg.querySelectorAll('*');
  const dstEls = clone.querySelectorAll('*');
  const props = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight'];
  for (let i = 0; i < srcEls.length && i < dstEls.length; i++) {
    const cs = getComputedStyle(srcEls[i]);
    let style = '';
    for (const p of props) {
      const v = cs.getPropertyValue(p);
      if (v) style += p + ':' + v + ';';
    }
    if (style) dstEls[i].setAttribute('style', style);
  }
  const inner = clone.querySelector('g');
  if (inner) inner.removeAttribute('transform');
  clone.setAttribute('xmlns', NS);
  clone.setAttribute('width', worldW);
  clone.setAttribute('height', worldH);
  clone.setAttribute('viewBox', '0 0 ' + worldW + ' ' + worldH);
  const xml = new XMLSerializer().serializeToString(clone);
  const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>' + xml], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  const slug = (rootName.textContent || 'tree').trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'tree';
  a.href = URL.createObjectURL(blob);
  a.download = slug + '-' + new Date().toISOString().slice(0, 10) + '.svg';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
});
document.getElementById('siblingsBtn').addEventListener('click', () => { showSiblings = !showSiblings; load(); });
personSearch.addEventListener('input', () => {
  draw(); clearTimeout(searchTimer);
  searchTimer = setTimeout(() => searchPeople(personSearch.value), 180);
});
personSearch.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { suggestions.hidden = true; return; }
  if (ev.key !== 'Enter') return;
  ev.preventDefault();
  const first = suggestions.querySelector('button.person-suggestion');
  if (first) first.click();
});
document.addEventListener('click', ev => { if (!ev.target.closest('.toolbar-search')) suggestions.hidden = true; });
load();
})();`;
