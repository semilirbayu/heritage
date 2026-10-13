// Server-rendered HTML for Heritage views. The family page mounts an
// interactive viewer (inline vanilla JS, no dependencies); pure geometry
// stays in src/views so tests never assert on markup.

import { personalPhoto } from "../domain/media";
import { kinOf, preferredEvent, preferredName } from "../domain/tree";
import type { ImportReport, Person, Tree } from "../domain/types";
import { NODE_H, NODE_W, type TreeViewMode } from "../views/family";
import { listPeople, yearOf, type ListQuery } from "../views/list";

/** Process start timestamp: every served page/API carries it so a stale dev
 *  server (old geometry in the browser) is detectable. Compare the
 *  `x-heritage-build` response header or console line after restarting. */
export const BUILD_ID = new Date().toISOString();

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const ICON_PATHS: Record<string, string> = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  home: '<path d="M3 10.8 12 3l9 7.8"/><path d="M5.5 9.6V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.6"/><path d="M10 21v-6h4v6"/>',
  fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M16 3h3a2 2 0 0 1 2 2v3"/><path d="M8 21H5a2 2 0 0 1-2-2v-3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>',
  expand: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
  collapse: '<path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l6-6"/><path d="M10 14l-6 6"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.8 20.8-4.6-4.6"/>',
  arrowLeft: '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
};

function icon(name: string, size = 18): string {
  const sw = size <= 16 ? 2.25 : 2;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[name] ?? ""}</svg>`;
}

const TOKENS = `:root{
color-scheme:light;
--paper:#eceef1;--surface:#fff;--surface-alt:#f6f7f9;
--ink:#151a20;--muted:#59636d;--label:#3f4952;
--line:#d6dae1;--line-strong:#aeb6bf;
--accent:#b23a2b;--accent-pale:#f7eae8;
--sex-m:#5c87ae;--sex-f:#b5738a;--sex-m-tint:#e4ecf3;--sex-f-tint:#f3e5ea;
--wire:#98a2ac;--canvas:#f2f3f5;--dot:#d3d8de;--fan-base:#3e5c74;
--shadow:0 1px 2px rgba(21,26,32,.06),0 10px 28px rgba(21,26,32,.07);
--shadow-lift:0 18px 44px rgba(21,26,32,.18);
--r1:6px;--r2:10px;
--font-sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
--font-display:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
--fs-sm:13px;--fs:15px;--fs-md:17px;--fs-lg:21px;
}
*{box-sizing:border-box}
html{min-width:320px}
body{margin:0;background:var(--paper);color:var(--ink);font:400 var(--fs)/1.55 var(--font-sans);min-height:100vh;-webkit-font-smoothing:antialiased}
a{color:var(--ink);text-decoration:underline;text-decoration-color:var(--line-strong);text-underline-offset:2px}
a:hover{color:var(--accent);text-decoration-color:var(--accent)}
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.site-header{height:64px;background:var(--surface);border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 clamp(16px,4vw,48px);gap:36px;position:relative;z-index:4}
.brand{display:flex;align-items:center;gap:10px;color:var(--ink);font:600 20px/1 var(--font-display);letter-spacing:-.01em;white-space:nowrap;text-decoration:none}
.brand:hover{color:var(--ink)}
.brand-mark{width:32px;height:32px;border-radius:8px;background:var(--ink);display:grid;place-items:center;color:#fff}
.brand-mark svg{width:20px;height:20px}
.site-nav{height:100%;display:flex;align-items:center;gap:4px}
.site-nav a{height:38px;padding:0 13px;display:flex;align-items:center;border-radius:var(--r1);color:var(--muted);font-weight:500;font-size:14px;text-decoration:none}
.site-nav a:hover{background:var(--surface-alt);color:var(--ink)}
.site-nav a.active{color:var(--ink);font-weight:600;box-shadow:inset 0 -2px 0 var(--accent)}
.breadcrumb{font-size:var(--fs-sm);color:var(--muted);margin:0 0 7px}
.breadcrumb a{color:var(--muted);text-decoration-color:var(--line-strong)}
.breadcrumb a:hover{color:var(--accent)}
.page{max-width:1440px;margin:0 auto;padding:32px clamp(16px,4vw,48px) 56px}
.page:has(#viewer){max-width:none;height:calc(100vh - 64px);height:calc(100dvh - 64px);display:flex;flex-direction:column;padding:18px clamp(12px,2vw,28px) 16px}
.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px 24px;margin-bottom:20px;flex-wrap:wrap}
.page-heading h1{font:600 clamp(26px,3vw,34px)/1.15 var(--font-display);letter-spacing:-.01em;margin:0}
.page-heading p{margin:8px 0 0;color:var(--muted);font-size:14px;max-width:62ch}
.page-heading.compact{align-items:center;margin-bottom:14px}
.page-heading.compact h1{font-size:23px;white-space:nowrap}
.heading-actions{display:flex;align-items:center;gap:10px}
.primary,.secondary,.icon-button{height:40px;border-radius:var(--r1);border:1px solid transparent;padding:0 15px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;font-size:14px;white-space:nowrap;text-decoration:none}
.primary{background:var(--ink);color:#fff}
.primary:hover{background:#000;color:#fff}
.secondary{background:var(--surface);color:var(--ink);border-color:var(--line)}
.secondary:hover{background:var(--surface-alt);border-color:var(--line-strong);color:var(--ink)}
.icon-button{width:40px;padding:0;background:var(--surface);color:var(--ink);border-color:var(--line);font-size:16px}
.icon-button:hover{background:var(--surface-alt);border-color:var(--line-strong);color:var(--ink)}
.icon-button>svg{display:block;width:18px;height:18px}
.primary>svg,.secondary>svg{display:block;width:16px;height:16px}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:var(--r2);box-shadow:var(--shadow)}
.muted{color:var(--muted)}
.quiet{font-size:var(--fs-sm);color:var(--muted)}
input,select,textarea{height:40px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r1);padding:0 11px;min-width:0}
select{-webkit-appearance:none;appearance:none;background-color:var(--surface);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2359636d' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;background-size:16px 16px;padding-right:33px}
select:hover{border-color:var(--line-strong)}
input::placeholder,textarea::placeholder{color:#6f7881}
textarea{height:auto;padding:10px 11px;resize:vertical}
label{font-weight:500;color:var(--label);font-size:var(--fs-sm)}
label input,label select{display:block;margin-top:6px;width:100%}
input[type=file]{height:auto;padding:10px 11px;background:var(--surface)}
input[type=file]::file-selector-button{margin-right:12px;height:32px;padding:0 13px;border:1px solid var(--line);border-radius:var(--r1);background:var(--surface-alt);color:var(--ink);font:600 13px/1 var(--font-sans);cursor:pointer}
input[type=file]::file-selector-button:hover{background:var(--surface);border-color:var(--line-strong)}
.check-option{display:flex;align-items:center;gap:9px;min-height:40px;cursor:pointer;color:var(--label);font-size:14px}
.check-option input[type=checkbox]{display:inline-block;width:17px;height:17px;margin:0;accent-color:var(--accent);flex:0 0 auto}
.form-grid label textarea{display:block;width:100%;margin-top:6px}
form.inline{display:inline}
form.inline button{background:none;border:0;color:var(--accent);font-size:var(--fs-sm);font-weight:600;padding:2px 4px;text-decoration:underline;text-decoration-color:transparent;text-underline-offset:2px}
form.inline button:hover{text-decoration-color:var(--accent)}
button:disabled{opacity:.5;cursor:not-allowed}
#toolbar{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface);border:1px solid var(--line);border-bottom:0;border-radius:var(--r2) var(--r2) 0 0;flex-wrap:wrap}
#toolbar label,#toolbar .tb-label{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:var(--fs-sm);white-space:nowrap}
#toolbar label>select{margin-top:0}
#toolbar .secondary,#toolbar .icon-button{height:36px}
#toolbar .icon-button{width:36px}
#toolbar select{height:36px;min-width:150px;padding-right:33px}
#toolbar .control-divider{height:24px;width:1px;background:var(--line);margin:0 2px}
#toolbar .toolbar-search{margin-left:auto;position:relative;flex:1;min-width:180px;max-width:270px}
#toolbar .toolbar-search input{height:36px;width:100%;margin-top:0;padding-left:33px;background:var(--surface-alt)}
#toolbar .toolbar-search>svg{position:absolute;left:10px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--muted);pointer-events:none}
#toolbar .toolbar-count{font-size:var(--fs-sm);color:var(--muted);padding:0 6px;white-space:nowrap}
#toolbar strong{color:var(--ink);font-weight:600;max-width:170px;overflow:hidden;text-overflow:ellipsis}
#siblingsBtn[aria-pressed="true"]{background:var(--accent-pale);border-color:var(--accent);color:var(--accent)}
.tree-notice{margin:0;padding:9px 13px;border:1px solid var(--line);border-left:3px solid var(--accent);background:var(--surface-alt);color:var(--label);font-size:var(--fs-sm)}
.tree-notice[hidden]{display:none}
.person-suggestions{position:absolute;left:0;right:0;top:calc(100% + 7px);z-index:5;background:var(--surface);border:1px solid var(--line);border-radius:var(--r1);box-shadow:var(--shadow-lift);overflow:hidden}
.person-suggestion{display:block;width:100%;border:0;border-bottom:1px solid var(--line);border-radius:0;padding:10px 12px;text-align:left;background:var(--surface);color:var(--ink);font-weight:500;font-size:14px}
.person-suggestion:last-child{border-bottom:0}
.person-suggestion:hover{background:var(--surface-alt);color:var(--accent)}
.person-suggestion.empty{font-size:var(--fs-sm);color:var(--muted);font-weight:400;cursor:default}
.person-suggestion.empty:hover{background:var(--surface);color:var(--muted)}
.toolbar-menu-wrap{position:relative}
.settings-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:6;width:250px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r2);box-shadow:var(--shadow-lift);padding:16px}
.settings-menu[hidden]{display:none}
.settings-menu .settings-title{font-size:12px;font-weight:600;color:var(--muted);margin:0 0 8px}
.settings-menu .settings-title:not(:first-child){margin-top:14px}
.settings-menu .check-option{margin-bottom:6px}
.canvas-shell{display:flex;flex-direction:column;flex:1;min-height:0}
.canvas-shell:fullscreen{height:100vh;max-height:none;padding:12px 12px 0;background:var(--paper)}
.canvas-shell:fullscreen #toolbar{border-radius:var(--r2)}
.canvas-shell:fullscreen #viewer{border-radius:0}
#viewer{position:relative;flex:1;min-height:260px;background-color:var(--canvas);background-image:radial-gradient(var(--dot) .8px,transparent .8px);background-size:22px 22px;overflow:hidden;touch-action:none;border:1px solid var(--line);border-radius:0 0 var(--r2) var(--r2);box-shadow:var(--shadow)}
#stage{display:block;width:100%;height:100%;cursor:grab}
#stage:active{cursor:grabbing}
#viewer .node{cursor:pointer}
#viewer .node rect{fill:#fff;stroke:var(--line-strong);stroke-width:1.5;filter:drop-shadow(0 4px 9px rgba(21,26,32,.08))}
#viewer .node.sex-m rect{fill:var(--sex-m-tint)}
#viewer .node.sex-f rect{fill:var(--sex-f-tint)}
#viewer text{font-family:var(--font-sans);fill:var(--ink)}
#viewer .node .node-name{font-family:var(--font-display);font-weight:600;font-size:15px;fill:var(--ink)}
#viewer .node .node-sub{fill:var(--muted);font-size:12px}
#viewer .node-add{fill:var(--ink)}
#viewer .node-add-bg{fill:#fff;stroke:var(--line-strong);stroke-width:1.25}
#viewer .node .node-avatar-m{fill:var(--sex-m)}
#viewer .node .node-avatar-f{fill:var(--sex-f)}
#viewer .node .node-avatar-u{fill:var(--surface-alt)}
#viewer .node .node-initials-m{fill:#fff;font-weight:700}
#viewer .node .node-initials-f{fill:#fff;font-weight:700}
#viewer .node .node-initials-u{fill:var(--muted);font-weight:700}
#viewer .node.focus rect{stroke:var(--ink);stroke-width:2.5;filter:drop-shadow(0 5px 13px rgba(21,26,32,.16))}
#viewer .node.sib rect{stroke:var(--accent);stroke-width:2;stroke-dasharray:6 3}
#viewer .node:hover rect{stroke:var(--ink);stroke-width:2}
#viewer .node.selected rect{stroke:var(--accent);stroke-width:2.5;fill:var(--accent-pale)}
#viewer .node .fan-person{stroke:var(--wire);stroke-width:1.4;filter:drop-shadow(0 3px 5px rgba(21,26,32,.12))}
#viewer .node .fan-initials{font-size:10px;font-weight:700;fill:var(--ink)}
#viewer .node .fan-name{font-size:9px;fill:var(--muted)}
#viewer .node.dimmed{opacity:.25}
.canvas-status{position:absolute;left:12px;bottom:12px;display:flex;flex-wrap:wrap;gap:8px;pointer-events:none}
.canvas-hint,.canvas-legend{display:flex;align-items:center;gap:12px;padding:7px 11px;border:1px solid var(--line);border-radius:var(--r1);background:rgba(255,255,255,.94);font-size:12px;color:var(--muted)}
.legend-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.legend-dot.m{background:var(--sex-m)}
.legend-dot.f{background:var(--sex-f)}
#drawer{position:absolute;top:12px;left:12px;bottom:12px;width:min(340px,calc(100% - 24px));background:var(--surface);border:1px solid var(--line);border-radius:var(--r2);padding:20px;overflow:auto;box-shadow:var(--shadow-lift);z-index:2}
#drawer[hidden]{display:none}
#drawer h2{font:600 24px/1.2 var(--font-display);letter-spacing:-.01em;margin:0 0 4px;padding-right:34px}
#drawer h3{font-size:13px;font-weight:600;color:var(--muted);margin:20px 0 6px}
#drawer .drawer-close{position:absolute;right:12px;top:12px}
#drawer .drawer-fact{padding:9px 0;border-bottom:1px solid var(--line);font-size:14px}
#drawer .drawer-actions{display:flex;gap:8px;margin-top:20px}
#drawer .drawer-actions>*{flex:1}
#viewer .branch-pill{fill:#fff;stroke:var(--line-strong);stroke-width:1.25;filter:drop-shadow(0 2px 4px rgba(21,26,32,.12))}
#viewer a{text-decoration:none}
#viewer a:hover .branch-pill{stroke:var(--accent);stroke-width:1.75}
#viewer .branch-pill-text{fill:var(--ink);font-weight:600}
#viewer .branch-toggle{opacity:0;transition:opacity .15s ease}
#viewer .branch-toggle.always{opacity:1}
#viewer .node:hover .branch-toggle,#viewer .node:focus-within .branch-toggle{opacity:1}
.zoom-cluster{position:absolute;right:12px;bottom:12px;display:flex;flex-direction:column;gap:6px;z-index:2}
.zoom-cluster .icon-button{box-shadow:0 4px 12px rgba(21,26,32,.14)}
.canvas-tip{margin:10px 2px 0;font-size:var(--fs-sm);color:var(--muted)}
.empty-panel{max-width:820px;margin:48px auto;padding:44px;display:grid;grid-template-columns:1fr 240px;gap:36px;align-items:center}
.empty-illustration{height:180px;display:grid;place-items:center;background:var(--surface-alt);border:1px solid var(--line);border-radius:var(--r2)}
.empty-illustration svg{width:140px;height:140px}
.empty-panel h2{font:600 26px/1.2 var(--font-display);letter-spacing:-.01em;margin:0 0 10px}
.empty-panel p{color:var(--muted);margin:0 0 22px}
.quick-add{display:flex;gap:8px;flex-wrap:wrap}
.quick-add input{flex:1;min-width:140px}
.empty-divider{border-top:1px solid var(--line);margin-top:24px;padding-top:16px;font-size:var(--fs-sm);color:var(--muted)}
.list-tools{display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;padding:16px;margin-bottom:14px}
.list-tools label:first-child{flex:1;min-width:220px}
.list-tools label:first-child input{max-width:420px}
.result-count{margin-left:auto;color:var(--muted);font-size:var(--fs-sm);padding-bottom:10px}
.people-table-wrap{overflow:auto}
.people-table{width:100%;border-collapse:collapse}
.people-table th{background:var(--surface-alt);color:var(--muted);font-size:12px;font-weight:600;padding:11px 16px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
.people-table td{padding:12px 16px;border-bottom:1px solid var(--line);color:var(--label)}
.people-table tr:last-child td{border-bottom:0}
.people-table tbody tr:hover{background:var(--surface-alt)}
.person-link{font-weight:600;color:var(--ink);text-decoration:none}
.person-link:hover{color:var(--accent)}
.person-cell{display:flex;align-items:center;gap:11px}
.mini-avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:var(--surface-alt);border:1px solid var(--line);color:var(--muted);font:600 12px/1 var(--font-display)}
.record-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:18px;align-items:start}
.record-main,.record-side{display:grid;gap:16px}
.section-card{padding:22px}
.section-card h2{font:600 var(--fs-lg)/1.3 var(--font-display);letter-spacing:-.01em;margin:0 0 16px}
.section-card h3{font-size:14px;font-weight:600;color:var(--label);margin:20px 0 8px}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
.form-grid .span-2{grid-column:span 2}
.form-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.fact-list{width:100%;border-collapse:collapse}
.fact-list th{text-align:left;color:var(--muted);font-size:12px;font-weight:600;padding:8px;border-bottom:1px solid var(--line)}
.fact-list td{padding:10px 8px;border-bottom:1px solid var(--line);color:var(--label)}
.fact-list tbody tr:last-child td{border-bottom:0}
.relation-list{list-style:none;margin:0;padding:0}
.relation-list li{padding:10px 0;border-bottom:1px solid var(--line)}
.stack-form{display:grid;gap:12px}
.stack-form .pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.upload-panel{padding:28px;max-width:760px}.upload-panel h2,.import-report h2{font:600 var(--fs-lg)/1.3 var(--font-display);letter-spacing:-.01em;margin:0 0 6px}
.upload-zone{border:1.5px dashed var(--line-strong);background:var(--surface-alt);border-radius:var(--r2);padding:28px;text-align:center;margin:16px 0}
.upload-zone p{color:var(--muted);font-size:var(--fs-sm);margin:12px 0 0}
.import-report{padding:22px;margin-top:18px}
.report-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:18px 0}
.stat{background:var(--surface-alt);border:1px solid var(--line);border-radius:var(--r1);padding:12px}
.stat strong{display:block;font:600 22px/1.2 var(--font-display)}
.stat span{font-size:12px;color:var(--muted)}
.export-panel{max-width:760px;padding:26px}
.option-row{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:15px 0;border-bottom:1px solid var(--line)}
.option-row:last-of-type{border-bottom:0}
.option-row label{font-size:14px;color:var(--ink)}
.option-row p{margin:4px 0 0;font-size:var(--fs-sm);color:var(--muted)}
.option-row select{min-width:220px}
@media(max-width:760px){.site-header{height:auto;min-height:64px;padding:10px 16px;gap:14px;flex-wrap:wrap}.brand{font-size:18px}.site-nav{height:auto;order:3;width:100%;justify-content:space-between}.site-nav a{padding:0 10px}.page{padding:22px 16px 32px}.page:has(#viewer){height:auto;padding:16px}.page-heading,.page-heading.compact{align-items:flex-start;flex-direction:column;margin-bottom:16px}.page-heading.compact h1{white-space:normal}.heading-actions{width:100%}.heading-actions .primary{flex:1}#toolbar{gap:8px;padding:10px}#toolbar>.tb-label{order:1;flex:1 1 auto;min-width:120px}#toolbar .tb-cap{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}#toolbar>label:not(.toolbar-search){order:2;flex:0 0 auto}#toolbar>label:not(.toolbar-search) select{min-width:0;width:156px;padding-right:24px}#toolbar>#siblingsBtn{order:3}#toolbar .control-divider{display:none}#toolbar .toolbar-count{order:6;margin-left:auto}#toolbar .toolbar-menu-wrap{order:7}#toolbar .toolbar-search{order:9;margin:0;flex:1 1 100%;min-width:100%}#toolbar .toolbar-search input{width:100%}#viewer{height:70vh;min-height:400px;flex:none}.canvas-legend{display:none}.canvas-hint{font-size:11px;padding:6px 9px}.empty-panel{margin:20px auto;padding:24px;grid-template-columns:1fr}.empty-illustration{height:130px;grid-row:1}.empty-illustration svg{width:110px;height:110px}.record-grid{grid-template-columns:1fr}.section-card{padding:18px}.report-stats{grid-template-columns:repeat(2,1fr)}.report-stats .stat:last-child{grid-column:span 2}.upload-panel,.export-panel{padding:20px}.option-row{align-items:flex-start;flex-direction:column;gap:10px}.option-row select{width:100%}.result-count{margin-left:0;width:100%;padding:0}.people-table th,.people-table td{padding:10px 9px}.people-table th:nth-child(3),.people-table td:nth-child(3){display:none}.people-table th:nth-child(1){min-width:150px}.form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.form-grid .span-2{grid-column:span 2}.option-row .check-option{align-self:stretch}}
@media(prefers-reduced-motion:no-preference){.primary,.secondary,.icon-button,.site-nav a{transition:background-color .16s ease,border-color .16s ease,color .16s ease,box-shadow .16s ease}}`;

function shell(title: string, body: string, active: "tree" | "people" | "import" | "export" = "tree"): string {
  const item = (key: typeof active, href: string, label: string): string =>
    `<a href="${href}" class="${active === key ? "active" : ""}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Heritage</title>
<style>${TOKENS}</style>
</head><body><header class="site-header"><a href="/" class="brand"><span class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 20V11M12 14 7 9M12 14l5-5M7 9V5M17 9V5M12 11V5"/><circle cx="7" cy="4" r="2" fill="currentColor"/><circle cx="17" cy="4" r="2" fill="currentColor"/><circle cx="12" cy="4" r="2" fill="currentColor"/></svg></span>Heritage</a><nav class="site-nav" aria-label="Main navigation">${item("tree", "/", "Tree")}${item("people", "/list", "People")}${item("import", "/import", "Import")}${item("export", "/export", "Export")}</nav></header>
<main class="page">${body}</main></body></html>`;
}

function lifeYears(p: Person): string {
  const b = yearOf(preferredEvent(p.events, "BIRT")?.dateRaw);
  const d = yearOf(preferredEvent(p.events, "DEAT")?.dateRaw);
  if (!b && !d) return "";
  return `${b ?? "?"}–${d ?? (p.isLiving ? "" : "?")}`;
}

function initialsFor(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0] ?? "").join("").toUpperCase() || "?";
}

/** Interactive tree viewer: drag-pan, wheel-zoom, click for details, double-click to refocus. */
const VIEWER_JS = `(() => {
const mount = document.getElementById('viewer');
const svg = document.getElementById('stage');
const drawer = document.getElementById('drawer');
const counts = document.getElementById('counts');
const rootName = document.getElementById('rootName');
const personSearch = document.getElementById('treeSearch');
const suggestions = document.getElementById('personSuggestions');
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
  notice.hidden = !data.truncatedCount;
  notice.textContent = data.truncatedCount ? 'Showing a limited branch for performance. Search or focus on a person to explore other branches.' : '';
  counts.textContent = nodes.length + ' people shown';
  draw();
  if (recenter !== false) centerOnRoot();
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
  const matchCount = search ? nodes.filter(n => n.name.toLowerCase().includes(search)).length : nodes.length;
  counts.textContent = search
    ? (matchCount ? matchCount + ' match' + (matchCount === 1 ? '' : 'es') : 'No matches') + ' · ' + totalPeople + ' in tree'
    : nodes.length + ' shown · ' + totalPeople + ' in tree';
  for (const n of nodes) {
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
    // Descendant toggle below the card, mirroring the ancestor toggle
    // above: persistent "+ N" pill only while descendants are hidden
    // (collapsed or depth-capped); a plain hover "−" while shown.
    if (n.hasDescendants && currentView === 'family') {
      const hidden = n.collapsed || n.atDepthLimit;
      if (hidden) {
        const pill = el('a', { href: '#', role: 'button', 'aria-label': 'Expand branch of ' + n.name + ' (' + n.descendantCount + ' descendants)', title: 'Expand this branch' });
        const px = n.x + W / 2, py = n.y + (n.h || H) + 12;
        pill.appendChild(el('rect', { x: px - 30, y: py - 10, width: 60, height: 20, rx: 10, class: 'branch-pill' }));
        pill.appendChild(el('text', { x: px, y: py + 4, 'font-size': 11, 'text-anchor': 'middle', class: 'branch-pill-text' }, '+ ' + n.descendantCount));
        pill.addEventListener('click', ev => {
          ev.preventDefault(); ev.stopPropagation();
          if (n.collapsed) n.branchFamilyIds.forEach(id => collapsed.delete(id));
          else if (n.atDepthLimit && depth) depth = String(Math.min(12, Number(depth) + 1));
          load();
        });
        pill.addEventListener('pointerdown', ev => ev.stopPropagation());
        viewport.appendChild(pill);
      } else {
        const min = el('a', { href: '#', role: 'button', 'aria-label': 'Collapse branch of ' + n.name + ' (' + n.descendantCount + ' descendants)', title: 'Minimize this branch', class: 'branch-toggle' });
        min.appendChild(el('circle', { class: 'node-add-bg', cx: n.x + W / 2, cy: n.y + (n.h || H) + 14, r: 11 }));
        min.appendChild(el('text', { class: 'node-add', x: n.x + W / 2, y: n.y + (n.h || H) + 19, 'font-size': 14, 'text-anchor': 'middle' }, '−'));
        min.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); n.branchFamilyIds.forEach(id => collapsed.add(id)); load(); });
        min.addEventListener('pointerdown', ev => ev.stopPropagation());
        g.appendChild(min);
      }
    }
    // Per-card upstream toggle above the card (MyHeritage branch-icon spot):
    // ↑ maximizes a hidden parent line (in-law, depth cap, minimized);
    // − minimizes a shown one. Each line toggles independently — expanding
    // never minimizes the others, minimizing re-runs the whole layout so
    // everything visible repositions tidily.
    // Ancestor toggle above the card — the mirror of the descendant pill
    // below: "↑ N" maximizes N hidden ancestors (in-law line, depth cap,
    // minimized), "−" on hover minimizes a shown line. Same per-line logic
    // both ways: independent toggles, URL state, full layout recompute.
    if (n.hiddenAncestorCount > 0 && currentView === 'family') {
      const up = el('a', { href: '#', role: 'button', 'aria-label': 'Show ' + n.hiddenAncestorCount + ' hidden ancestors of ' + n.name, title: 'Show this parent line (' + n.hiddenAncestorCount + ' hidden)', class: 'branch-toggle always' });
      const px = n.x + W / 2, py = n.y - 12;
      up.appendChild(el('rect', { x: px - 30, y: py - 10, width: 60, height: 20, rx: 10, class: 'branch-pill' }));
      up.appendChild(el('text', { x: px, y: py + 4, 'font-size': 11, 'text-anchor': 'middle', class: 'branch-pill-text' }, '↑ ' + n.hiddenAncestorCount));
      up.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); minimizedAncestors.delete(n.personId); expandedAncestors.add(n.personId); load(); });
      up.addEventListener('pointerdown', ev => ev.stopPropagation());
      g.appendChild(up);
    } else if (n.hasAncestors && !n.hasHiddenParents && currentView === 'family') {
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
  const ea = document.createElement('a'); ea.className = 'secondary'; ea.href = '/person/' + p.id; ea.textContent = 'Edit record';
  actions.appendChild(ea);
  const ka = document.createElement('a'); ka.className = 'primary'; ka.href = '/person/' + p.id + '#add-kin'; ka.textContent = 'Add family';
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

const byId = (tree: Tree) => new Map(tree.persons.map((p) => [p.id, p]));

export function familyPage(
  tree: Tree,
  rootId: string | undefined,
  depth: number | undefined,
  collapsedFamilyIds: ReadonlySet<string> = new Set(),
  expandedAncestorIds: ReadonlySet<string> = new Set(),
  showSiblings = false,
  siblingPersonIds: ReadonlySet<string> = new Set(),
  view: TreeViewMode = "family",
  minimizedAncestorIds: ReadonlySet<string> = new Set(),
): string {
  if (tree.persons.length === 0) {
    return shell(
      "Family tree",
      `<div class="panel empty-panel"><div><h2>Start your family tree</h2><p>Add a person to begin building your family history, or bring in a tree you already have.</p>
      <form class="quick-add" method="post" action="/person/new"><input name="given" placeholder="First name" aria-label="First name" required><input name="surname" placeholder="Last name" aria-label="Last name"><button class="primary">Add person</button></form>
      <div class="empty-divider">Already have a family tree? <a href="/import">Import a GEDCOM file</a></div></div>
      <div class="empty-illustration" aria-hidden="true"><svg viewBox="0 0 160 160" fill="none"><path d="M80 142V93M80 111 51 83M80 111l29-28M51 83V51M109 83V51M80 93V43" style="stroke:var(--line-strong)" stroke-width="3" stroke-linecap="round"/><path d="M35 48c0-9 7-16 16-16s16 7 16 16-7 16-16 16-16-7-16-16ZM93 48c0-9 7-16 16-16s16 7 16 16-7 16-16 16-16-7-16-16ZM64 39c0-9 7-16 16-16s16 7 16 16-7 16-16 16-16-7-16-16Z" style="fill:var(--surface);stroke:var(--line-strong)" stroke-width="3"/><circle cx="80" cy="126" r="15" style="fill:var(--accent-pale);stroke:var(--accent)" stroke-width="3"/></svg></div></div>`,
      "tree",
    );
  }
  const root = rootId && tree.persons.some((p) => p.id === rootId) ? rootId : tree.persons[0]!.id;
  const depthValue = depth === undefined ? (view === "family" ? "all" : "5") : Number.isFinite(depth) ? String(depth) : "all";
  const depthOptions = view === "family"
    ? ["1", "2", "3", "4", "5", "6", "12", "all"]
    : view === "fan"
      ? ["3", "4", "5", "6", "7", "8", "9"]
      : ["1", "2", "3", "4", "5", "11", "all"];
  const depths = depthOptions
    .map((d) => {
      const label = d === "all"
        ? "All generations"
        : view === "family"
          ? d + (d === "1" ? " generation" : " generations")
          : `${Number(d) + 1} generations`;
      return `<option value="${d}"${depthValue === d ? " selected" : ""}>${label}</option>`;
    })
    .join("");
  const rootPerson = tree.persons.find((p) => p.id === root)!;
  const siblingCount = view === "family" ? new Set(
    rootPerson.famc.flatMap((link) => tree.families.find((f) => f.id === link.familyId)?.children ?? []).filter((id) => id !== root),
  ).size : 0;
  const viewTitle = view === "pedigree" ? "Pedigree view" : view === "fan" ? "Fan view" : "Family tree";
  const fallback = tree.persons
    .map((p) => `<li><a href="/person/${p.id}">${esc(preferredName(p))}</a></li>`)
    .join("");
  return shell(
    viewTitle,
    `<div class="page-heading compact"><div><h1>${viewTitle}</h1></div><div class="heading-actions"><a class="primary" href="/person/new">${icon("plus", 16)} Add person</a></div></div>
    <div class="canvas-shell">
    <div id="toolbar" role="toolbar" aria-label="Tree controls">
      <span class="tb-label">Branch <strong id="rootName">${esc(preferredName(rootPerson))}</strong></span>
      <label><span class="tb-cap">Generations</span><select id="depthSel" aria-label="Number of generations">${depths}</select></label>
      <button id="siblingsBtn" class="secondary" type="button"${siblingCount ? "" : " hidden"} aria-pressed="${showSiblings}">${showSiblings ? "Hide siblings" : `Show siblings (${siblingCount})`}</button>
      <span class="control-divider"></span>
      <label class="toolbar-search">${icon("search", 16)}<input id="treeSearch" type="search" placeholder="Search everyone" aria-label="Search everyone in the tree" autocomplete="off"><div id="personSuggestions" class="person-suggestions" role="listbox" hidden></div></label>
      <span class="toolbar-count" id="counts" aria-live="polite"></span>
      <div class="toolbar-menu-wrap">
        <button id="settingsBtn" class="icon-button" type="button" aria-label="Tree settings" aria-haspopup="true" aria-expanded="false">${icon("gear")}</button>
        <div id="settingsMenu" class="settings-menu" hidden role="menu" aria-label="Tree settings">
          <p class="settings-title">Cards show</p>
          <label class="check-option"><input id="setPhotos" type="checkbox"><span>Photos on cards</span></label>
          <label class="check-option"><input id="setYears" type="checkbox" checked><span>Birth and death years</span></label>
        </div>
      </div>
    </div>
    <p id="treeNotice" class="tree-notice" hidden></p>
    <div id="viewer" data-root="${esc(root)}" data-view="${view}" data-depth="${depthValue}" data-collapsed="${esc([...collapsedFamilyIds].join(","))}" data-expanded="${esc([...expandedAncestorIds].join(","))}" data-minimized="${esc([...minimizedAncestorIds].join(","))}" data-siblings="${showSiblings ? "1" : "0"}" data-sibexp="${esc([...siblingPersonIds].join(","))}" data-w="${NODE_W}" data-h="${NODE_H}">
      <svg id="stage" role="img" aria-label="family tree"></svg>
      <aside id="drawer" hidden aria-label="person details"></aside>
      <div class="zoom-cluster" role="toolbar" aria-label="Zoom controls">
        <button id="zoomIn" class="icon-button" type="button" aria-label="Zoom in">${icon("plus")}</button>
        <button id="zoomOut" class="icon-button" type="button" aria-label="Zoom out">${icon("minus")}</button>
        <button id="homeBtn" class="icon-button" type="button" aria-label="Center on main person at normal zoom" title="Center on main person">${icon("home")}</button>
        <button id="fitBtn" class="icon-button" type="button" aria-label="Fit whole tree in view" title="Fit whole tree in view">${icon("fit")}</button>
        <button id="fullBtn" class="icon-button" type="button" aria-label="View full screen" title="Full screen">${icon("expand")}</button>
      </div>
      <noscript><ul>${fallback}</ul></noscript>
      <div class="canvas-status"><div class="canvas-hint">Drag to move · scroll to zoom · click a person for details</div><div class="canvas-legend"><span><i class="legend-dot m"></i>Male</span><span><i class="legend-dot f"></i>Female</span></div></div>
    </div>
    </div>
    <p class="canvas-tip">Tip: double-click a person to center the tree on them.</p>
    <script>${VIEWER_JS}</script>`,
    "tree",
  );
}

export function listPage(tree: Tree, q: ListQuery): string {
  const rows = listPeople(tree, q);
  const opts = (v: string | undefined, options: [string, string][]): string =>
    options.map(([val, label]) => `<option value="${val}"${v === val ? " selected" : ""}>${label}</option>`).join("");
  const trs = rows
    .map(
      (r) =>
        `<tr><td><div class="person-cell"><span class="mini-avatar">${esc(initialsFor(r.display))}</span><a class="person-link" href="/person/${r.personId}">${esc(r.display)}</a></div></td><td>${esc(r.birthYear ?? "—")}</td><td>${esc(r.birthPlace ?? "—")}</td><td>${esc(r.deathYear ?? "—")}</td></tr>`,
    )
    .join("");
  return shell(
    "People",
    `<div class="page-heading"><div><h1>People</h1></div><div class="heading-actions"><a class="primary" href="/person/new">${icon("plus", 16)} Add person</a></div></div>
    <form class="panel list-tools" method="get" action="/list"><label>Find by surname<input name="surname" type="search" placeholder="Try a surname" value="${esc(q.surname ?? "")}"></label>
    <label>Sort by<select name="sort">${opts(q.sort, [["surname", "Last name"], ["given", "First name"], ["birth", "Birth year"], ["death", "Death year"]])}</select></label>
    <button class="secondary">Update list</button><span class="result-count">${rows.length} ${rows.length === 1 ? "person" : "people"}</span></form>
    <div class="panel people-table-wrap"><table class="people-table"><thead><tr><th>Name</th><th>Born</th><th>Birthplace</th><th>Died</th></tr></thead><tbody>${trs || '<tr><td colspan="4" class="quiet">No people match that surname.</td></tr>'}</tbody></table></div>`,
    "people",
  );
}

export function personOptions(tree: Tree, exclude?: string): string {
  return tree.persons
    .filter((p) => p.id !== exclude)
    .map((p) => `<option value="${p.id}">${esc(preferredName(p))}</option>`)
    .join("");
}

export function personPage(tree: Tree, p: Person): string {
  const persons = byId(tree);
  const photo = personalPhoto(p, tree);
  const facts = p.events
    .map(
      (e) =>
        `<tr><td>${esc(e.type)}</td><td>${esc(e.dateRaw ?? "")}</td><td>${esc(e.place?.raw ?? "")}</td>
        <td><form class="inline" method="post" action="/person/${p.id}/fact/delete"><input type="hidden" name="id" value="${e.id}"><button aria-label="Delete ${esc(e.type)} event">Delete</button></form></td></tr>`,
    )
    .join("");
  const rel = (ids: string[]): string =>
    ids.map((id) => `<a href="/person/${id}">${esc(preferredName(persons.get(id)!))}</a>`).join(", ") || "—";
  const kin = kinOf(tree, p);
  const fams = p.fams.map((fid) => tree.families.find((f) => f.id === fid)!).filter(Boolean);
  const partners = kin.partners.map((q) => q.id);
  const children = kin.children.map((q) => q.id);
  const parents = kin.parents.map((q) => q.id);
  const detach = (fid: string, role: string): string =>
    `<form class="inline" method="post" action="/person/${p.id}/detach"><input type="hidden" name="family" value="${fid}"><input type="hidden" name="role" value="${role}"><button aria-label="Detach from this family">Detach</button></form>`;
  const famsRows = fams
    .map((f) => `<li>With ${rel(f.partners.filter((id) => id !== p.id)) || "no partner"}<div class="quiet">Children: ${rel(f.children) || "none recorded"}</div>${detach(f.id, "partner")}</li>`)
    .join("");
  return shell(
    preferredName(p),
    `<div class="page-heading"><div><p class="breadcrumb"><a href="/">Family tree</a> / Person record</p><h1>${esc(preferredName(p) || "Unnamed person")}</h1><p>${lifeYears(p) ? esc(lifeYears(p)) + " · " : ""}${p.isLiving ? "Living" : "Deceased"}${p.private ? " · Private" : ""}</p></div><div class="heading-actions"><a class="secondary" href="/">${icon("arrowLeft", 16)} Back to tree</a></div></div>
    <div class="record-grid"><div class="record-main">
      <section class="panel section-card"><h2>Personal details</h2><form method="post" action="/person/${p.id}/edit">
      <div class="form-grid"><label>First name<input name="given" value="${esc(p.names[0]?.given ?? "")}" autocomplete="given-name"></label>
      <label>Last name<input name="surname" value="${esc(p.names[0]?.surname ?? "")}" autocomplete="family-name"></label>
      <label>Preferred display name<input name="display" placeholder="Optional name"></label>
      <label>Gender<select name="sex"><option value="U" ${p.sex === "U" ? "selected" : ""}>Not specified</option><option value="F" ${p.sex === "F" ? "selected" : ""}>Female</option><option value="M" ${p.sex === "M" ? "selected" : ""}>Male</option><option value="X" ${p.sex === "X" ? "selected" : ""}>Another identity</option></select></label>
      <label class="span-2">Biography<textarea name="biography" rows="3" placeholder="A short life story">${esc(p.biography)}</textarea></label>
      <label class="check-option"><input type="checkbox" name="living" value="1"${p.isLiving ? " checked" : ""}><span>Living person</span></label>
      <label class="check-option"><input type="checkbox" name="private" value="1"${p.private ? " checked" : ""}><span>Keep private when sharing</span></label></div>
      <div class="form-actions"><button class="primary">Save details</button></div></form></section>
      <section class="panel section-card"><h2>Life events</h2><table class="fact-list"><thead><tr><th>Event</th><th>Date</th><th>Place</th><th></th></tr></thead><tbody>${facts || '<tr><td colspan="4" class="quiet">No events recorded yet.</td></tr>'}</tbody></table>
      <h3>Add an event</h3><form class="form-grid" method="post" action="/person/${p.id}/fact"><label>Event type<input name="type" placeholder="Birth, marriage…" required></label><label>Date<input name="date" placeholder="10 Dec 1815"></label><label class="span-2">Place<input name="place" placeholder="City, region, country"></label><div class="span-2 form-actions"><button class="secondary">Add event</button></div></form></section>
      <section class="panel section-card"><h2>Family connections</h2><h3>Parents</h3><ul class="relation-list">${parents.map((id) => `<li>${rel([id])}</li>`).join("") || '<li class="quiet">No parents linked yet.</li>'}</ul><h3>Partners and children</h3><ul class="relation-list">${famsRows || '<li class="quiet">No partners or children linked yet.</li>'}</ul></section>
    </div><aside class="record-side">
      <section class="panel section-card" id="add-kin"><h2>Add family</h2><form class="stack-form" method="post" action="/person/${p.id}/relation">
      <label>Relationship<select name="kind"><option value="child">Child</option><option value="parent">Parent</option><option value="spouse">Partner or spouse</option><option value="sibling">Sibling</option></select></label>
      <div class="pair"><label>First name<input name="given" placeholder="First name"></label><label>Last name<input name="surname" placeholder="Last name"></label></div>
      <label>Or link an existing person<select name="existing"><option value="">Create a new person</option>${personOptions(tree, p.id)}</select></label>
      <label>Parent relationship<select name="pedi"><option value="">Biological / not specified</option><option value="adoptive">Adoptive</option><option value="foster">Foster</option></select></label>
      <button class="primary">Add relationship</button></form></section>
      <section class="panel section-card"><h2>Portrait</h2>${photo ? `<div class="quiet">Current photo: ${esc(photo.title ?? photo.path)}</div>` : '<p class="quiet">Add a photo link to recognize this person in the tree.</p>'}<form class="stack-form" method="post" action="/person/${p.id}/photo"><label>Photo URL or sidecar path<input name="path" placeholder="media/portrait.jpg or https://…" required></label><label>Caption<input name="title" placeholder="Photo caption"></label><div class="pair"><label>Date<input name="date" placeholder="Year or date"></label><label>Place<input name="place" placeholder="Place"></label></div><button class="secondary">Set portrait</button></form></section>
      <section class="panel section-card"><h2>Research notes</h2><ul class="relation-list">${p.researchNotes.map((n) => `<li>${esc(n)}</li>`).join("") || '<li class="quiet">No research notes yet.</li>'}</ul><form class="stack-form" method="post" action="/person/${p.id}/note"><label>Add a note<textarea name="text" rows="2" placeholder="Source leads, questions, context" required></textarea></label><button class="secondary">Save note</button></form></section>
    </aside></div>`,
    "people",
  );
}

export function newPersonPage(): string {
  return shell(
    "New person",
    `<div class="page-heading"><div><p class="breadcrumb"><a href="/list">People</a> / New record</p><h1>Add a person</h1><p>Start with a name. You can fill in dates and relationships later.</p></div><div class="heading-actions"><a href="/list" class="secondary">Cancel</a></div></div><section class="panel section-card" style="max-width:680px"><form class="form-grid" method="post" action="/person/new"><label>First name<input name="given" placeholder="First name" required autofocus></label><label>Last name<input name="surname" placeholder="Last name"></label><div class="span-2 form-actions"><button class="primary">Create person</button></div></form></section>`,
    "people",
  );
}

export function importPage(report: ImportReport | undefined): string {
  const rep = report
    ? `<section class="panel import-report"><h2>Import complete</h2><p class="quiet">GEDCOM ${esc(report.version)} · ${esc(report.encoding)}${report.hadBom ? " · BOM" : ""}</p><div class="report-stats">${[[report.counts.individuals,"People"],[report.counts.families,"Families"],[report.counts.notes,"Notes"],[report.counts.sources,"Sources"],[report.counts.media,"Media"]].map(([n,label]) => `<div class="stat"><strong>${n}</strong><span>${label}</span></div>`).join("")}</div><h3>${report.warnings.length ? "Things to review" : "Everything imported cleanly"}</h3><ul>${report.warnings.map((w) => `<li><b>${esc(w.code)}</b> ${esc(w.message)}</li>`).join("") || "<li>No warnings were reported.</li>"}</ul><a class="primary" href="/">Open family tree</a></section>`
    : "";
  return shell(
    "Import GEDCOM",
    `<div class="page-heading"><div><h1>Import a family tree</h1><p>Upload a GEDCOM file to add its people, relationships, dates, and notes.</p></div></div><section class="panel upload-panel"><h2>Choose a GEDCOM file</h2><form method="post" action="/import" enctype="multipart/form-data"><div class="upload-zone"><input type="file" name="file" accept=".ged" required><p>GEDCOM 5.5, 5.5.1 or 7.x</p></div><p class="quiet">Your current tree will be replaced by this import.</p><button class="primary">Import family tree</button></form></section>${rep}`,
    "import",
  );
}

export function exportPage(tree: Tree): string {
  const roots = personOptions(tree);
  return shell(
    "Export",
    `<div class="page-heading"><div><h1>Export your tree</h1><p>Save a GEDCOM copy or share a branch with another genealogy tool.</p></div></div><section class="panel export-panel"><form method="get" action="/export.ged"><div class="option-row"><div><label for="branch">People to include</label><p>Choose the whole family or one person's descendant branch.</p></div><select id="branch" name="branch"><option value="">Whole tree</option>${roots}</select></div>
    <div class="option-row"><div><label for="living">Living people</label><p>Choose whether private details appear in the exported file.</p></div><select id="living" name="living"><option value="none">Include all details</option><option value="redact">Redact names and facts</option><option value="exclude">Exclude living people</option></select></div>
    <div class="option-row"><div><label for="media">Photos</label><p>GEDCOM contains links, not the photo files themselves.</p></div><label class="check-option"><input id="media" type="checkbox" name="media" value="0"><span>Exclude photo links</span></label></div>
    <div class="form-actions"><button class="primary">Download GEDCOM</button></div></form></section>`,
    "export",
  );
}

export function notFound(what: string): string {
  return shell("Not found", `<section class="panel section-card"><p>We couldn't find ${esc(what)}.</p><a class="primary" href="/">Back to family tree</a></section>`);
}
