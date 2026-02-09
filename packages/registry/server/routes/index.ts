import type { Registry, RegistryItem } from 'shadcn-vue/schema'
import { defineHandler, getRequestURL } from 'nitro/h3'
import { useStorage } from 'nitro/storage'
import { config } from '../utils/config'

interface RegistryStats {
  total: number
  byType: Record<string, { count: number, items: { name: string, type: string, description?: string }[] }>
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function collectStats(registry: Registry): RegistryStats {
  const byType: RegistryStats['byType'] = {}
  let total = 0

  for (const item of (registry.items || []) as RegistryItem[]) {
    const type = (item.type || 'unknown').replace('registry:', '')
    if (!byType[type]) {
      byType[type] = { count: 0, items: [] }
    }
    byType[type].count++
    byType[type].items.push({ name: item.name, type, description: item.description })
    total++
  }

  return { total, byType }
}

// Inline SVG icons (16x16) to avoid external dependencies
const ICON_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>'
const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

function renderItemCards(stats: RegistryStats, baseUrl: string): string {
  return Object.entries(stats.byType)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([type, { count, items }]) => {
      const itemList = items
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => {
          const cmd = `npx shadcn-vue@latest add ${baseUrl}/${i.name}.json`
          return `<span class="item-chip">
            <a href="${baseUrl}/${i.name}.json" class="item-name" title="${escapeHtml(i.description || i.name)}">${i.name}</a>
            <button class="item-copy" onclick="copyText('${escapeHtml(cmd)}',this)" title="Copy install command">${ICON_COPY}</button>
          </span>`
        })
        .join('')
      return `
        <div class="type-card">
          <div class="type-header">
            <span class="type-label">${type}</span>
            <span class="type-count">${count}</span>
          </div>
          <div class="item-list">${itemList}</div>
        </div>`
    })
    .join('')
}

export default defineHandler(async (event) => {
  const url = getRequestURL(event)
  const baseUrl = url.origin
  const storage = useStorage('assets:registry')

  let registry: Registry = { name: config.baseName, homepage: config.homepage, items: [] }
  try {
    const data = await storage.getItem('registry.json') as Registry | null
    if (data)
      registry = data
  }
  catch {}

  const stats = collectStats(registry)
  const registryName = registry.name || 'Registry'
  const registryAlias = `@${config.baseName}`
  const description = config.registryDescription || `shadcn-vue compatible component registry`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${registryName} — shadcn-vue Registry</title>
<meta name="description" content="shadcn-vue compatible component registry serving ${stats.total} items">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📦</text></svg>">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#fafafa;--bg2:#fff;--fg:#18181b;--fg2:#71717a;--fg3:#a1a1aa;
  --border:#e4e4e7;--accent:#18181b;--accent-fg:#fafafa;
  --code-bg:#f4f4f5;--card-bg:#fff;--card-shadow:0 1px 3px rgba(0,0,0,.04),0 1px 2px rgba(0,0,0,.06);
  --tag-bg:#f4f4f5;--tag-fg:#3f3f46;--tag-hover:#e4e4e7;
  --green:#16a34a;--green-bg:#f0fdf4;
  --radius:10px;--font:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
  --mono:'SF Mono',SFMono-Regular,ui-monospace,Menlo,Monaco,Consolas,monospace;
}
@media(prefers-color-scheme:dark){
  :root{
    --bg:#09090b;--bg2:#18181b;--fg:#fafafa;--fg2:#a1a1aa;--fg3:#71717a;
    --border:#27272a;--accent:#fafafa;--accent-fg:#18181b;
    --code-bg:#1e1e22;--card-bg:#111113;--card-shadow:0 1px 3px rgba(0,0,0,.3),0 1px 2px rgba(0,0,0,.2);
    --tag-bg:#27272a;--tag-fg:#d4d4d8;--tag-hover:#3f3f46;
    --green:#4ade80;--green-bg:#052e16;
  }
}
html{font-family:var(--font);background:var(--bg);color:var(--fg);line-height:1.6;-webkit-font-smoothing:antialiased}
body{max-width:720px;margin:0 auto;padding:48px 24px 80px}
a{color:inherit;text-decoration:none}

/* Header */
.header{margin-bottom:48px}
.header h1{font-size:1.5rem;font-weight:600;letter-spacing:-.025em;margin-bottom:4px}
.header p{color:var(--fg2);font-size:.875rem}
.header .url{font-family:var(--mono);font-size:.8rem;color:var(--fg3);margin-top:8px;word-break:break-all;display:flex;align-items:center;gap:6px}
.header .url button{background:none;border:none;color:var(--fg3);cursor:pointer;padding:2px;display:inline-flex;align-items:center;border-radius:4px;transition:color .12s}
.header .url button:hover{color:var(--fg2)}

/* Stats bar */
.stats{display:flex;gap:24px;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid var(--border)}
.stat{display:flex;flex-direction:column}
.stat-value{font-size:1.75rem;font-weight:600;letter-spacing:-.03em;line-height:1.2}
.stat-label{font-size:.75rem;color:var(--fg2);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}

/* Section */
.section{margin-bottom:40px}
.section-title{font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--fg3);margin-bottom:16px}
.section-desc{font-size:.8rem;color:var(--fg2);margin-bottom:16px;line-height:1.5}

/* Steps */
.step{margin-bottom:20px}
.step-label{font-size:.75rem;font-weight:500;color:var(--fg2);margin-bottom:8px;display:flex;align-items:center;gap:8px}
.step-num{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;background:var(--tag-bg);color:var(--fg);font-size:.65rem;font-weight:600}

/* Type cards */
.type-card{background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius);padding:16px 20px;margin-bottom:12px;transition:border-color .15s}
.type-card:hover{border-color:var(--fg3)}
.type-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.type-label{font-size:.875rem;font-weight:600}
.type-count{font-size:.75rem;color:var(--fg2);background:var(--tag-bg);padding:2px 8px;border-radius:99px;font-variant-numeric:tabular-nums}
.item-list{display:flex;flex-wrap:wrap;gap:6px}

/* Item chip with copy */
.item-chip{display:inline-flex;align-items:center;gap:0;background:var(--tag-bg);border-radius:6px;overflow:hidden;transition:background .12s}
.item-chip:hover{background:var(--tag-hover)}
.item-name{font-size:.75rem;font-family:var(--mono);padding:4px 4px 4px 10px;color:var(--tag-fg);line-height:1.3}
.item-copy{display:inline-flex;align-items:center;justify-content:center;background:none;border:none;color:var(--fg3);cursor:pointer;padding:4px 8px 4px 4px;transition:color .12s;border-radius:0 6px 6px 0}
.item-copy:hover{color:var(--fg)}
.item-copy.copied{color:var(--green)}

/* Code block */
.code-block{position:relative;background:var(--code-bg);border:1px solid var(--border);border-radius:var(--radius);padding:14px 20px;font-family:var(--mono);font-size:.78rem;line-height:1.7;overflow-x:auto;white-space:pre;color:var(--fg);margin-bottom:0}
.code-block .comment{color:var(--fg3)}
.code-block .str{color:var(--fg2)}
.code-block .key{color:var(--fg)}
.copy-btn{position:absolute;top:8px;right:8px;background:var(--tag-bg);border:1px solid var(--border);color:var(--fg2);padding:4px 8px;border-radius:6px;font-size:.7rem;cursor:pointer;font-family:var(--font);transition:all .12s;display:inline-flex;align-items:center;gap:4px}
.copy-btn:hover{background:var(--tag-hover);color:var(--fg)}
.copy-btn.copied{color:var(--green);border-color:var(--green)}

/* Endpoints */
.endpoint{display:flex;align-items:baseline;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)}
.endpoint:last-child{border-bottom:none}
.endpoint-method{font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--fg3);min-width:32px}
.endpoint-path{font-family:var(--mono);font-size:.8rem;color:var(--fg)}
.endpoint-path a{border-bottom:1px dashed var(--border);transition:border-color .12s}
.endpoint-path a:hover{border-color:var(--fg3)}
.endpoint-desc{font-size:.75rem;color:var(--fg2);margin-left:auto;white-space:nowrap}

/* Toast */
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--fg);color:var(--bg);padding:8px 16px;border-radius:8px;font-size:.8rem;opacity:0;pointer-events:none;transition:all .25s ease;z-index:100;font-family:var(--font);white-space:nowrap}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

/* Footer */
.footer{margin-top:48px;padding-top:24px;border-top:1px solid var(--border);font-size:.75rem;color:var(--fg3);display:flex;justify-content:space-between;align-items:center}
.footer a{color:var(--fg2);border-bottom:1px dashed var(--border);transition:color .12s}
.footer a:hover{color:var(--fg)}

/* Responsive */
@media(max-width:480px){
  body{padding:32px 16px 60px}
  .stats{gap:16px}
  .stat-value{font-size:1.35rem}
  .endpoint{flex-wrap:wrap;gap:4px}
  .endpoint-desc{margin-left:40px}
}
</style>
</head>
<body>
  <div class="header">
    <h1>${registryName?.toUpperCase()}</h1>
    <p>${description}</p>
    <div class="url">
      <span>${baseUrl}</span>
      <button onclick="copyText('${baseUrl}',this)" title="Copy URL">${ICON_COPY}</button>
    </div>
  </div>

  <div class="stats">
    <div class="stat">
      <span class="stat-value">${stats.total}</span>
      <span class="stat-label">Items</span>
    </div>
    <div class="stat">
      <span class="stat-value">${Object.keys(stats.byType).length}</span>
      <span class="stat-label">Types</span>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Quick Start</div>

    <div class="step">
      <div class="step-label"><span class="step-num">1</span> Add registry to components.json</div>
      <div class="code-block" id="code-registries"><button class="copy-btn" onclick="copyBlock('code-registries')">${ICON_COPY} Copy</button><span class="comment">// components.json</span>
{
  <span class="key">"registries"</span>: {
    <span class="key">"${registryAlias}"</span>: <span class="str">"${baseUrl}/{name}.json"</span>
  }
}</div>
    </div>

    <div class="step">
      <div class="step-label"><span class="step-num">2</span> Install items</div>
      <div class="code-block" id="code-add"><button class="copy-btn" onclick="copyBlock('code-add')">${ICON_COPY} Copy</button><span class="comment"># Install a specific item</span>
npx shadcn-vue@latest add ${registryAlias}/&lt;name&gt;

<span class="comment"># Install a specific item by URL</span>
npx shadcn-vue@latest add ${baseUrl}/&lt;name&gt;.json

<span class="comment"># Or install all items at once</span>
npx shadcn-vue@latest add ${baseUrl}/all.json</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Registry Items</div>
    <p class="section-desc">Click an item name to view its JSON. Use the copy button to copy the install command.</p>
    ${stats.total > 0 ? renderItemCards(stats, baseUrl) : '<p style="color:var(--fg2);font-size:.875rem">No items found. Build the registry first.</p>'}
  </div>

  <div class="section">
    <div class="section-title">API Endpoints</div>
    <div class="endpoint">
      <span class="endpoint-method">GET</span>
      <span class="endpoint-path"><a href="${baseUrl}/registry.json">registry.json</a></span>
      <span class="endpoint-desc">Registry index</span>
    </div>
    <div class="endpoint">
      <span class="endpoint-method">GET</span>
      <span class="endpoint-path"><a href="${baseUrl}/all.json">all.json</a></span>
      <span class="endpoint-desc">All items bundled</span>
    </div>
    <div class="endpoint">
      <span class="endpoint-method">GET</span>
      <span class="endpoint-path">{name}.json</span>
      <span class="endpoint-desc">Individual item</span>
    </div>
  </div>

  <div class="footer">
    <span>Powered by <a href="https://nitro.build" target="_blank">Nitro</a> + <a href="https://www.shadcn-vue.com" target="_blank">shadcn-vue</a></span>
    <span>${registry.homepage !== 'https://example.com' ? `<a href="${registry.homepage}" target="_blank">Homepage</a>` : ''}</span>
  </div>

  <div class="toast" id="toast"></div>

<script>
function showToast(msg){
  var t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid=setTimeout(function(){t.classList.remove('show')},1800);
}
function copyText(text,btn){
  navigator.clipboard.writeText(text).then(function(){
    if(btn){
      var orig=btn.innerHTML;
      btn.innerHTML='${ICON_CHECK}';
      btn.classList.add('copied');
      setTimeout(function(){btn.innerHTML=orig;btn.classList.remove('copied')},1500);
    }
    showToast('Copied to clipboard');
  });
}
function copyBlock(id){
  var el=document.getElementById(id);
  if(!el)return;
  var btn=el.querySelector('.copy-btn');
  var lines=el.innerText.split('\\n').filter(function(l){
    var t=l.trim();
    return t && !t.startsWith('//') && !t.startsWith('#') && t!=='Copy';
  });
  navigator.clipboard.writeText(lines.join('\\n')).then(function(){
    if(btn){
      var orig=btn.innerHTML;
      btn.innerHTML='${ICON_CHECK} Copied!';
      btn.classList.add('copied');
      setTimeout(function(){btn.innerHTML=orig;btn.classList.remove('copied')},1500);
    }
    showToast('Copied to clipboard');
  });
}
</script>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
})
