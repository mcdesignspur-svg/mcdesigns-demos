import {
    load, save, reset, subscribe, emit, orderTotals, setStatus, simulateOrder, placeOrder, areaOf, dayNames,
    STATUSES, PRICE_LISTS, STAFF, CATEGORIES, IVU, SAMPLE_IMPORT, parseImport, applyImport,
} from './data.js'
import { icon, money, money0, fmtDate, fmtDay, ago, esc, initials, toast, chime, productArt, STATUS_STYLE } from './ui.js'

let state = load()
let me = null
let page = 'inicio'
let liveTimer = null
let notifs = []
const ui = { ordStatus: 'Pendientes', ordQ: '', prodQ: '', prodCat: '', prodLow: false, prodPage: 0, cliQ: '' }
const $ = id => document.getElementById(id)
const client = id => state.clients.find(c => c.id === id)
const product = id => state.products.find(p => p.id === id)
const totalOf = o => orderTotals(o, client(o.clientId)).total
const NEXT = { 'Recibida': 'Preparando', 'Preparando': 'En ruta', 'En ruta': 'Entregada' }
const NEXT_LABEL = { 'Recibida': 'Empezar a preparar', 'Preparando': 'Enviar a ruta', 'En ruta': 'Marcar entregada' }

// ---------------- sesión ----------------
try { const e = localStorage.getItem('siovera-staff'); if (e) me = STAFF.find(s => s.email === e) || null } catch (e) {}

$('loginFeatures').innerHTML = [
    ['Bell', 'Cada pedido nuevo llega al instante, con aviso y sonido.'],
    ['Boxes', 'Inventario al día desde Retail Manager.'],
    ['Users', 'Listas de precio y mínimos por cliente y por área.'],
    ['Printer', 'Factura y hoja de despacho listas para imprimir.'],
].map(([i, t]) => `<li class="flex gap-3 items-start"><span class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">${icon(i, 'w-4 h-4')}</span><span class="pt-1">${t}</span></li>`).join('')
$('eye').innerHTML = icon('Eye', 'w-5 h-5')
$('demoHintTitle').innerHTML = icon('Sparkles', 'w-4 h-4 text-brand') + ' Cuenta de demostración'
$('secureNote').innerHTML = icon('ShieldCheck', 'w-3.5 h-3.5') + ' Conexión segura · Las sesiones expiran a las 12 horas'
$('eye').onclick = () => { const p = $('pass'); p.type = p.type === 'password' ? 'text' : 'password'; $('eye').innerHTML = icon(p.type === 'password' ? 'Eye' : 'EyeOff', 'w-5 h-5') }
$('fillDemo').onclick = () => { $('email').value = STAFF[0].email; $('pass').value = STAFF[0].pass; $('email').focus() }
$('forgot').onclick = e => { e.preventDefault(); toast('Le enviamos un enlace a su correo para crear una contraseña nueva.', { kind: 'ok', title: 'Revise su correo' }) }
$('loginForm').addEventListener('submit', e => {
    e.preventDefault()
    const u = STAFF.find(s => s.email.toLowerCase() === $('email').value.trim().toLowerCase() && s.pass === $('pass').value)
    const btn = $('loginBtn')
    btn.disabled = true
    btn.innerHTML = `<svg class="w-5 h-5 spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity=".25" stroke-width="3"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg> Verificando…`
    setTimeout(() => {
        btn.disabled = false; btn.textContent = 'Entrar'
        if (!u) { $('loginErr').hidden = false; $('loginForm').classList.remove('shake'); void $('loginForm').offsetWidth; $('loginForm').classList.add('shake'); return }
        me = u
        try { localStorage.setItem('siovera-staff', u.email) } catch (e) {}
        boot()
    }, 650)
})
$('logout').onclick = () => { me = null; try { localStorage.removeItem('siovera-staff') } catch (e) {}; stopLive(); showLogin() }

function showLogin() { $('login').hidden = false; $('app').hidden = true; $('email').value = ''; $('pass').value = ''; $('loginErr').hidden = true }

// ---------------- estructura ----------------
const NAV = [
    ['inicio', 'Inicio', 'LayoutDashboard'],
    ['ordenes', 'Órdenes', 'ShoppingCart'],
    ['productos', 'Productos', 'Boxes'],
    ['clientes', 'Clientes', 'Users'],
    ['importar', 'Importar inventario', 'Upload'],
    ['ajustes', 'Ajustes', 'Settings'],
]
function renderNav() {
    const pending = state.orders.filter(o => o.status === 'Recibida').length
    $('nav').innerHTML = NAV.map(([id, label, ic]) => `<button class="nav-item ${page === id ? 'on' : ''}" data-nav="${id}">${icon(ic, 'w-[18px] h-[18px]')}<span class="flex-1 text-left">${label}</span>${id === 'ordenes' && pending ? `<span class="bg-brand text-white text-xs font-bold rounded-full px-2 py-0.5">${pending}</span>` : ''}</button>`).join('') +
        `<div class="pt-4 mt-4 border-t border-white/10"><p class="px-3 text-[11px] uppercase tracking-wider text-white/40 mb-2">Demo</p>
        <button class="nav-item" id="simBtn">${icon('Sparkles', 'w-[18px] h-[18px]')}<span>Simular pedido entrante</span></button>
        <button class="nav-item" id="resetBtn">${icon('RotateCcw', 'w-[18px] h-[18px]')}<span>Reiniciar datos</span></button></div>`
    $('simBtn').onclick = () => { closeMenu(); setTimeout(() => simulateOrder(state) && onRemoteOrder(), 900); toast('Llega en un segundo…') }
    $('resetBtn').onclick = () => { if (confirm('¿Reiniciar los datos del demo?')) { state = reset(); notifs = []; render(); toast('Datos reiniciados', { kind: 'ok' }) } }
}
$('nav').addEventListener('click', e => { const b = e.target.closest('[data-nav]'); if (b) go(b.dataset.nav) })
function go(p) { page = p; closeMenu(); render(); window.scrollTo(0, 0); try { history.replaceState(null, '', '#' + p) } catch (e) {} }
$('menuBtn').innerHTML = icon('Menu', 'w-6 h-6')
$('menuBtn').onclick = () => { $('sidebar').classList.remove('-translate-x-full'); $('scrim').hidden = false }
$('scrim').onclick = closeMenu
function closeMenu() { $('sidebar').classList.add('-translate-x-full'); $('scrim').hidden = true }
$('searchIcon').innerHTML = icon('Search', 'w-4 h-4')
$('bellIcon').innerHTML = icon('Bell', 'w-5 h-5')
$('dClose').innerHTML = icon('X', 'w-5 h-5')
$('logout').innerHTML = icon('LogOut', 'w-4 h-4')
$('portalLink').innerHTML = icon('Store', 'w-4 h-4') + ' Ver portal de clientes'

function boot() {
    $('login').hidden = true; $('app').hidden = false
    $('meAvatar').textContent = initials(me.name); $('meName').textContent = me.name; $('meRole').textContent = me.role
    const h = (location.hash || '').slice(1)
    if (NAV.some(n => n[0] === h)) page = h
    render()
}

function render() {
    renderNav(); renderBell(); renderLive()
    const fn = { inicio: pInicio, ordenes: pOrdenes, productos: pProductos, clientes: pClientes, importar: pImportar, ajustes: pAjustes }[page]
    $('page').innerHTML = fn()
    afterRender[page] && afterRender[page]()
}
const afterRender = {}

const pageHead = (title, sub, actions = '') => `<div class="flex flex-wrap items-end justify-between gap-3 mb-6"><div><h1 class="text-2xl font-extrabold">${title}</h1>${sub ? `<p class="text-navy/60 mt-0.5">${sub}</p>` : ''}</div><div class="flex gap-2 flex-wrap">${actions}</div></div>`
const statusPill = s => `<span class="pill ${STATUS_STYLE[s].cls}"><span class="w-1.5 h-1.5 rounded-full" style="background:${STATUS_STYLE[s].dot}"></span>${s}</span>`
const avatar = (name, cls = 'w-9 h-9 text-xs') => `<div class="${cls} rounded-full bg-navy/5 text-navy font-bold flex items-center justify-center shrink-0">${esc(initials(name))}</div>`
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()

// ---------------- INICIO ----------------
function pInicio() {
    const now = new Date()
    const hour = now.getHours()
    const greet = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
    const dayStart = d => { const t = new Date(now); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - d); return t }
    const inRange = (o, from, to) => { const t = new Date(o.date); return t >= from && t < to }
    const sum = arr => arr.reduce((s, o) => s + totalOf(o), 0)
    const today = state.orders.filter(o => new Date(o.date) >= dayStart(0))
    const yest = state.orders.filter(o => inRange(o, dayStart(1), dayStart(0)))
    const last7 = state.orders.filter(o => new Date(o.date) >= dayStart(6))
    const prev7 = state.orders.filter(o => inRange(o, dayStart(13), dayStart(6)))
    const pending = state.orders.filter(o => o.status !== 'Entregada')
    const low = state.products.filter(p => p.active !== false && p.stock <= p.low)
    const delta = (a, b) => {
        if (!b) return ''
        const d = (a - b) / b * 100
        return `<span class="pill ${d >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}">${icon(d >= 0 ? 'TrendingUp' : 'TrendingDown', 'w-3.5 h-3.5')}${Math.abs(d).toFixed(0)}%</span>`
    }
    const kpi = (label, val, sub, ic, extra = '') => `<div class="card p-5"><div class="flex items-center justify-between"><p class="text-sm text-navy/60 font-medium">${label}</p><span class="w-9 h-9 rounded-lg bg-paper flex items-center justify-center text-navy/70">${icon(ic, 'w-[18px] h-[18px]')}</span></div><p class="text-[28px] font-extrabold mt-2 tracking-tight">${val}</p><div class="flex items-center gap-2 mt-1 text-sm text-navy/55">${extra}<span>${sub}</span></div></div>`

    // ventas por día (14 días)
    const days = Array.from({ length: 14 }, (_, i) => {
        const from = dayStart(13 - i), to = dayStart(12 - i)
        const os = state.orders.filter(o => inRange(o, from, to))
        return { d: from, total: sum(os), n: os.length }
    })
    const max = Math.max(...days.map(d => d.total), 1)
    const W = 700, H = 220, pad = 28, bw = (W - pad) / days.length
    const nice = Math.ceil(max / 500) * 500
    const grid = [0, .5, 1].map(f => `<line x1="${pad}" x2="${W}" y1="${H - 24 - f * (H - 44)}" y2="${H - 24 - f * (H - 44)}" stroke="#EEE9DF"/><text x="0" y="${H - 20 - f * (H - 44)}" font-size="10" fill="#14233C" fill-opacity=".45">${money0(nice * f)}</text>`).join('')
    const bars = days.map((d, i) => {
        const h = d.total / nice * (H - 44), x = pad + i * bw + bw * .18, y = H - 24 - h
        const isToday = i === days.length - 1
        return `<g class="bar"><title>${fmtDay(d.d)}: ${money(d.total)} · ${d.n} órdenes</title><rect class="b" x="${x}" y="${y}" width="${bw * .64}" height="${Math.max(h, 1)}" rx="5" fill="${isToday ? '#E8731C' : '#1F3557'}" fill-opacity="${isToday ? 1 : .85}"/><text x="${x + bw * .32}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#14233C" fill-opacity="${isToday ? .9 : .45}" font-weight="${isToday ? 700 : 400}">${d.d.getDay() === 0 ? '' : d.d.toLocaleDateString('es-PR', { day: 'numeric' })}</text></g>`
    }).join('')

    // top productos y clientes (30 días)
    const since30 = dayStart(29)
    const last30 = state.orders.filter(o => new Date(o.date) >= since30)
    const pc = {}, cc = {}
    last30.forEach(o => { o.items.forEach(i => { pc[i.pid] = (pc[i.pid] || 0) + i.qty * i.price }); cc[o.clientId] = (cc[o.clientId] || 0) + totalOf(o) })
    const topP = Object.entries(pc).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const topC = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const topPMax = topP[0] ? topP[0][1] : 1

    const queue = state.orders.filter(o => o.status === 'Recibida' || o.status === 'Preparando').slice(0, 6)
    const events = state.orders.flatMap(o => (o.history || []).map(h => ({ ...h, o }))).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 7)

    return `
    ${pageHead(`${greet}, ${esc(me.name.split(' ')[0])}`, fmtDay(now), `<button class="btn btn-ghost" data-nav="ordenes">${icon('ShoppingCart', 'w-4 h-4')} Ver órdenes</button><button class="btn btn-brand" data-act="newOrder">${icon('Plus', 'w-4 h-4')} Tomar pedido</button>`)}
    <div class="grid grid-cols-2 xl:grid-cols-4 gap-4">
        ${kpi('Ventas de hoy', money(sum(today)), `${today.length} órdenes · vs. ayer`, 'Receipt', delta(sum(today), sum(yest)))}
        ${kpi('Por entregar', pending.length, `${state.orders.filter(o => o.status === 'Recibida').length} sin empezar`, 'Truck')}
        ${kpi('Ventas 7 días', money0(sum(last7)), 'vs. semana anterior', 'TrendingUp', delta(sum(last7), sum(prev7)))}
        ${kpi('Inventario bajo', low.length, low.length ? 'productos por reponer' : 'todo en orden', 'AlertTriangle')}
    </div>
    <div class="grid xl:grid-cols-3 gap-4 mt-4">
        <div class="card p-5 xl:col-span-2">
            <div class="flex items-center justify-between"><div><p class="font-bold">Ventas por día</p><p class="text-sm text-navy/55">Últimos 14 días · ${money(days.reduce((s, d) => s + d.total, 0))}</p></div><span class="pill bg-paper text-navy/70">${icon('CalendarDays', 'w-3.5 h-3.5')} 14 días</span></div>
            <svg viewBox="0 0 ${W} ${H}" class="w-full mt-4">${grid}${bars}</svg>
        </div>
        <div class="card p-5">
            <div class="flex items-center justify-between mb-3"><p class="font-bold">Por atender</p><button class="text-sm text-brand font-semibold" data-nav="ordenes">Ver todas</button></div>
            <div class="space-y-1">${queue.length ? queue.map(o => `
                <div class="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-paper cursor-pointer ${o.isNew ? 'flash' : ''}" data-order="${o.id}">
                    ${avatar(client(o.clientId).name)}
                    <div class="flex-1 min-w-0"><p class="font-semibold text-sm truncate">${esc(client(o.clientId).name)}</p><p class="text-xs text-navy/55">${o.id} · ${ago(o.date)}</p></div>
                    <div class="text-right"><p class="font-bold text-sm">${money(totalOf(o))}</p>${statusPill(o.status)}</div>
                </div>`).join('') : `<p class="text-sm text-navy/55 py-6 text-center">Nada pendiente. ¡Todo al día!</p>`}</div>
        </div>
    </div>
    <div class="grid lg:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
        <div class="card p-5">
            <p class="font-bold mb-4">Más vendidos <span class="text-navy/45 font-normal text-sm">· 30 días</span></p>
            <div class="space-y-3">${topP.map(([pid, v]) => { const p = product(pid); return `<div class="flex items-center gap-3">${productArt(p, 'w-10 h-10', 'w-5 h-5')}<div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${esc(p.name)}</p><div class="h-1.5 bg-paper rounded-full mt-1.5"><div class="h-full rounded-full bg-brand" style="width:${v / topPMax * 100}%"></div></div></div><p class="text-sm font-bold w-20 text-right">${money0(v)}</p></div>` }).join('')}</div>
        </div>
        <div class="card p-5">
            <p class="font-bold mb-4">Mejores clientes <span class="text-navy/45 font-normal text-sm">· 30 días</span></p>
            <div class="space-y-3">${topC.map(([cid, v], i) => { const c = client(cid); return `<div class="flex items-center gap-3 cursor-pointer" data-client="${cid}"><span class="w-5 text-sm text-navy/40 font-bold">${i + 1}</span>${avatar(c.name)}<div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${esc(c.name)}</p><p class="text-xs text-navy/55">${esc(c.town)} · Lista ${c.list}</p></div><p class="text-sm font-bold">${money0(v)}</p></div>` }).join('')}</div>
        </div>
        <div class="card p-5 lg:col-span-2 xl:col-span-1">
            <p class="font-bold mb-4">Actividad reciente</p>
            <ol class="relative border-l border-line ml-2 space-y-4">${events.map(ev => `<li class="ml-5 cursor-pointer" data-order="${ev.o.id}"><span class="absolute -left-[7px] w-3.5 h-3.5 rounded-full ring-4 ring-white" style="background:${STATUS_STYLE[ev.status].dot}"></span><p class="text-sm"><b>${ev.o.id}</b> ${ev.status === 'Recibida' ? `recibida de ${esc(client(ev.o.clientId).name)}` : `pasó a <b>${ev.status}</b>`}</p><p class="text-xs text-navy/50">${ago(ev.at)} · ${esc(ev.by)}</p></li>`).join('')}</ol>
        </div>
    </div>
    ${low.length ? `<div class="card p-5 mt-4"><div class="flex items-center justify-between mb-3"><p class="font-bold flex items-center gap-2">${icon('AlertTriangle', 'w-4 h-4 text-amber-600')} Inventario bajo</p><button class="text-sm text-brand font-semibold" data-act="lowStock">Ver todos (${low.length})</button></div>
        <div class="flex gap-3 overflow-x-auto scroll-thin pb-2">${low.slice(0, 10).map(p => `<div class="min-w-[200px] p-3 rounded-xl bg-paper cursor-pointer" data-product="${p.id}"><div class="flex items-center gap-2">${productArt(p, 'w-9 h-9', 'w-4 h-4')}<p class="text-xs text-navy/55">${esc(p.sku)}</p></div><p class="text-sm font-semibold mt-2 line-clamp-2 leading-snug">${esc(p.name)}</p><p class="text-sm mt-1 ${p.stock ? 'text-amber-700' : 'text-red-700'} font-bold">${p.stock ? `Quedan ${p.stock}` : 'Agotado'}</p></div>`).join('')}</div></div>` : ''}`
}

// ---------------- ÓRDENES ----------------
function pOrdenes() {
    const tabs = ['Pendientes', ...STATUSES, 'Todas']
    const count = t => t === 'Todas' ? state.orders.length : t === 'Pendientes' ? state.orders.filter(o => o.status !== 'Entregada').length : state.orders.filter(o => o.status === t).length
    const q = ui.ordQ.toLowerCase()
    const list = state.orders.filter(o => (ui.ordStatus === 'Todas' || (ui.ordStatus === 'Pendientes' ? o.status !== 'Entregada' : o.status === ui.ordStatus)) &&
        (!q || (o.id + ' ' + client(o.clientId).name + ' ' + client(o.clientId).town).toLowerCase().includes(q))).slice(0, 80)
    return `${pageHead('Órdenes', `${state.orders.length} órdenes en total`, `<button class="btn btn-ghost" data-act="export">${icon('Download', 'w-4 h-4')} Exportar</button><button class="btn btn-brand" data-act="newOrder">${icon('Plus', 'w-4 h-4')} Tomar pedido</button>`)}
    <div class="card">
        <div class="flex flex-wrap gap-2 items-center justify-between p-3 border-b border-line">
            <div class="flex gap-1 overflow-x-auto scroll-thin">${tabs.map(t => `<button data-otab="${t}" class="px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap ${t === ui.ordStatus ? 'bg-navy text-white' : 'text-navy/65 hover:bg-paper'}">${t} <span class="opacity-60 font-medium">${count(t)}</span></button>`).join('')}</div>
            <div class="relative w-full sm:w-64"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40">${icon('Search', 'w-4 h-4')}</span><input id="ordQ" value="${esc(ui.ordQ)}" placeholder="Buscar orden o cliente" class="field !py-2 !pl-9"></div>
        </div>
        <div class="overflow-x-auto scroll-thin"><table class="w-full min-w-[820px]">
            <thead><tr><th>Orden</th><th>Cliente</th><th>Área</th><th>Fecha</th><th class="text-right">Artículos</th><th class="text-right">Total</th><th>Estado</th><th></th></tr></thead>
            <tbody>${list.map(o => { const c = client(o.clientId), t = orderTotals(o, c); return `<tr class="click ${o.isNew ? 'flash' : ''}" data-order="${o.id}">
                <td class="font-bold">${o.id}${o.isNew ? ' <span class="pill bg-brand text-white ml-1">Nueva</span>' : ''}</td>
                <td><div class="flex items-center gap-3">${avatar(c.name, 'w-8 h-8 text-[11px]')}<div><p class="font-semibold">${esc(c.name)}</p><p class="text-xs text-navy/50">${esc(c.town)}</p></div></div></td>
                <td>${esc(c.area)}</td><td class="text-navy/65">${fmtDate(o.date)}</td>
                <td class="text-right">${t.units}</td><td class="text-right font-bold">${money(t.total)}</td>
                <td>${statusPill(o.status)}</td>
                <td class="text-right">${NEXT[o.status] ? `<button class="btn btn-ghost !py-1.5 !text-xs" data-advance="${o.id}">${NEXT_LABEL[o.status]}</button>` : ''}</td></tr>` }).join('') || `<tr><td colspan="8" class="text-center text-navy/55 py-10">No hay órdenes aquí.</td></tr>`}</tbody>
        </table></div>
    </div>`
}
afterRender.ordenes = () => {
    const i = $('ordQ'); i.oninput = () => { ui.ordQ = i.value; const pos = i.selectionStart; render(); const n = $('ordQ'); n.focus(); n.setSelectionRange(pos, pos) }
}

function openOrder(id) {
    const o = state.orders.find(x => x.id === id), c = client(o.clientId), t = orderTotals(o, c)
    if (o.isNew) { delete o.isNew; save(state); renderNav() }
    const steps = STATUSES.map(s => { const h = (o.history || []).find(x => x.status === s); return { s, h } })
    const curIdx = STATUSES.indexOf(o.status)
    $('dHead').innerHTML = `<div class="flex items-center gap-3"><p class="text-lg font-extrabold">Orden ${o.id}</p>${statusPill(o.status)}</div>`
    $('dBody').innerHTML = `
        <div class="p-5 border-b border-line">
            <div class="flex items-center gap-4">${avatar(c.name, 'w-12 h-12 text-sm')}<div class="flex-1 min-w-0"><p class="font-bold text-lg leading-tight cursor-pointer hover:underline" data-client="${c.id}">${esc(c.name)}</p><p class="text-sm text-navy/60">${esc(c.contact)} · Cliente #${c.id}</p></div>
            <a href="tel:${c.phone}" class="btn btn-ghost !px-3">${icon('Phone', 'w-4 h-4')}</a></div>
            <div class="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div class="p-3 rounded-xl bg-paper"><p class="text-navy/50 text-xs">Entrega</p><p class="font-semibold">${esc(c.town)} · Área ${esc(c.area)}</p></div>
                <div class="p-3 rounded-xl bg-paper"><p class="text-navy/50 text-xs">Precios y pago</p><p class="font-semibold">Lista ${c.list} · Contra entrega</p></div>
            </div>
            ${o.notes ? `<div class="mt-3 p-3 rounded-xl bg-amber-50 text-amber-900 text-sm flex gap-2">${icon('Info', 'w-4 h-4 mt-0.5 shrink-0')}<span><b>Nota del cliente:</b> ${esc(o.notes)}</span></div>` : ''}
        </div>
        <div class="p-5 border-b border-line">
            <p class="font-bold mb-4">Seguimiento</p>
            <div class="flex items-start">${steps.map(({ s, h }, i) => `<div class="flex-1 flex flex-col items-center text-center relative">
                ${i ? `<div class="absolute top-4 right-1/2 w-full h-0.5 ${i <= curIdx ? 'bg-emerald-500' : 'bg-line'}"></div>` : ''}
                <div class="relative w-8 h-8 rounded-full flex items-center justify-center ${i <= curIdx ? 'bg-emerald-500 text-white' : 'bg-paper text-navy/35'}">${icon(STATUS_STYLE[s].icon, 'w-4 h-4')}</div>
                <p class="text-xs font-semibold mt-2 ${i <= curIdx ? '' : 'text-navy/40'}">${s}</p>
                <p class="text-[11px] text-navy/50">${h ? fmtDate(h.at, { hour: 'numeric', minute: '2-digit' }) : '—'}</p></div>`).join('')}</div>
            <div class="mt-4 space-y-1.5">${(o.history || []).slice().reverse().map(h => `<p class="text-xs text-navy/55">${fmtDate(h.at)} · <b class="text-navy/80">${h.status}</b> · ${esc(h.by)}</p>`).join('')}</div>
        </div>
        <div class="p-5">
            <p class="font-bold mb-2">${o.items.length} productos</p>
            <div class="divide-y divide-line">${o.items.map(i => { const p = product(i.pid); return `<div class="py-3 flex items-center gap-3">${productArt(p, 'w-11 h-11', 'w-5 h-5')}<div class="flex-1 min-w-0"><p class="text-sm font-semibold leading-snug">${esc(p.name)}</p><p class="text-xs text-navy/50">${esc(p.sku)} · ${money(i.price)} c/u</p></div><p class="text-sm w-10 text-right">×${i.qty}</p><p class="text-sm font-bold w-24 text-right">${money(i.qty * i.price)}</p></div>` }).join('')}</div>
            <div class="mt-3 pt-3 border-t border-line space-y-1 text-sm">
                <div class="flex justify-between"><span class="text-navy/60">Subtotal</span><span>${money(t.subtotal)}</span></div>
                <div class="flex justify-between"><span class="text-navy/60">IVU (11.5%)</span><span>${c.exempt ? 'Exento' : money(t.ivu)}</span></div>
                <div class="flex justify-between text-lg font-extrabold pt-1"><span>Total a cobrar</span><span>${money(t.total)}</span></div>
            </div>
        </div>`
    $('dFoot').innerHTML = `<div class="flex gap-2"><button class="btn btn-ghost" data-print="factura" data-id="${o.id}">${icon('Receipt', 'w-4 h-4')} Factura</button><button class="btn btn-ghost" data-print="despacho" data-id="${o.id}">${icon('Printer', 'w-4 h-4')} Despacho</button><div class="flex-1"></div>${NEXT[o.status] ? `<button class="btn btn-brand" data-advance="${o.id}" data-reopen="1">${NEXT_LABEL[o.status]} ${icon('ArrowRight', 'w-4 h-4')}</button>` : `<span class="pill bg-emerald-50 text-emerald-700 !py-2">${icon('CircleCheck', 'w-4 h-4')} Completada</span>`}</div>`
    $('drawer').hidden = false
}

function advance(id, reopen) {
    const o = state.orders.find(x => x.id === id)
    const to = NEXT[o.status]; if (!to) return
    setStatus(state, id, to, me.name)
    toast(`${id} ahora está <b>${to}</b>. El cliente fue notificado.`, { kind: 'ok' })
    render()
    if (reopen) openOrder(id)
}

// ---------------- impresión ----------------
function printDoc(kind, id) {
    const o = state.orders.find(x => x.id === id), c = client(o.clientId), t = orderTotals(o, c)
    const isF = kind === 'factura'
    $('print').innerHTML = `<div style="font-family:Inter,sans-serif;color:#14233C;padding:32px;max-width:780px;margin:auto">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #14233C;padding-bottom:16px">
            <div style="display:flex;gap:12px;align-items:center"><div style="width:48px;height:48px;border-radius:10px;background:#E8731C;color:#fff;font-weight:800;font-size:24px;display:flex;align-items:center;justify-content:center">S</div>
            <div><div style="font-weight:800;font-size:20px">Siovera Distributor</div><div style="font-size:12px;opacity:.65">Distribuidor de ferretería · Puerto Rico</div></div></div>
            <div style="text-align:right"><div style="font-weight:800;font-size:22px">${isF ? 'FACTURA' : 'HOJA DE DESPACHO'}</div><div style="font-size:13px">${o.id}</div><div style="font-size:12px;opacity:.65">${fmtDate(o.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
        </div>
        <div style="display:flex;gap:32px;margin:18px 0;font-size:13px">
            <div style="flex:1"><div style="font-size:11px;text-transform:uppercase;opacity:.55;font-weight:700">Cliente</div><div style="font-weight:700;font-size:15px">${esc(c.name)}</div><div>${esc(c.contact)} · #${c.id}</div><div>${esc(c.town)}, PR · ${esc(c.phone)}</div></div>
            <div><div style="font-size:11px;text-transform:uppercase;opacity:.55;font-weight:700">Condiciones</div><div>Pago contra entrega</div><div>Lista de precio ${c.list}</div><div>${c.exempt ? 'Exento de IVU' : 'IVU 11.5%'}</div></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#F6F4EF">${isF ? '<th style="text-align:left;padding:8px">Código</th><th style="text-align:left;padding:8px">Descripción</th><th style="text-align:right;padding:8px">Cant.</th><th style="text-align:right;padding:8px">Precio</th><th style="text-align:right;padding:8px">Importe</th>' : '<th style="padding:8px;width:30px">✓</th><th style="text-align:left;padding:8px">Código</th><th style="text-align:left;padding:8px">Descripción</th><th style="text-align:left;padding:8px">Empaque</th><th style="text-align:right;padding:8px">Cant.</th>'}</tr></thead>
        <tbody>${o.items.map(i => { const p = product(i.pid); return `<tr style="border-bottom:1px solid #eee">${isF ? `<td style="padding:8px">${esc(p.sku)}</td><td style="padding:8px">${esc(p.name)}</td><td style="padding:8px;text-align:right">${i.qty}</td><td style="padding:8px;text-align:right">${money(i.price)}</td><td style="padding:8px;text-align:right">${money(i.qty * i.price)}</td>` : `<td style="padding:8px"><div style="width:14px;height:14px;border:1.5px solid #14233C;border-radius:3px"></div></td><td style="padding:8px">${esc(p.sku)}</td><td style="padding:8px">${esc(p.name)}</td><td style="padding:8px">${esc(p.unit)}</td><td style="padding:8px;text-align:right;font-weight:700">${i.qty}</td>`}</tr>` }).join('')}</tbody></table>
        ${isF ? `<div style="margin-left:auto;width:260px;margin-top:16px;font-size:13px"><div style="display:flex;justify-content:space-between;padding:4px 0"><span>Subtotal</span><span>${money(t.subtotal)}</span></div><div style="display:flex;justify-content:space-between;padding:4px 0"><span>IVU</span><span>${c.exempt ? 'Exento' : money(t.ivu)}</span></div><div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid #14233C;font-weight:800;font-size:16px"><span>Total</span><span>${money(t.total)}</span></div></div>` :
        `<div style="display:flex;gap:40px;margin-top:48px;font-size:12px"><div style="flex:1;border-top:1px solid #14233C;padding-top:6px">Preparado por</div><div style="flex:1;border-top:1px solid #14233C;padding-top:6px">Recibido por (nombre y firma)</div></div>`}
        ${o.notes ? `<p style="margin-top:20px;font-size:13px"><b>Nota:</b> ${esc(o.notes)}</p>` : ''}
        <p style="margin-top:32px;font-size:11px;opacity:.5;text-align:center">Gracias por su compra · Siovera Distributor</p></div>`
    setTimeout(() => window.print(), 50)
}

// ---------------- PRODUCTOS ----------------
const PER = 40
function prodList() {
    const q = ui.prodQ.toLowerCase()
    return state.products.filter(p => (!ui.prodCat || p.cat === ui.prodCat) && (!ui.prodLow || p.stock <= p.low) && (!q || (p.name + ' ' + p.sku + ' ' + (p.sub || '')).toLowerCase().includes(q)))
}
function pProductos() {
    const all = prodList(), pages = Math.max(1, Math.ceil(all.length / PER))
    ui.prodPage = Math.min(ui.prodPage, pages - 1)
    const list = all.slice(ui.prodPage * PER, ui.prodPage * PER + PER)
    const catName = id => (CATEGORIES.find(c => c.id === id) || { name: 'Otros' }).name
    return `${pageHead('Productos', `${state.products.length} productos en el catálogo`, `<button class="btn btn-ghost" data-nav="importar">${icon('Upload', 'w-4 h-4')} Importar</button><button class="btn btn-brand" data-act="newProduct">${icon('Plus', 'w-4 h-4')} Nuevo producto</button>`)}
    <div class="card">
        <div class="flex flex-wrap gap-2 items-center p-3 border-b border-line">
            <div class="relative flex-1 min-w-[200px]"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40">${icon('Search', 'w-4 h-4')}</span><input id="prodQ" value="${esc(ui.prodQ)}" placeholder="Buscar por nombre o código" class="field !py-2 !pl-9"></div>
            <select id="prodCat" class="field !py-2 !w-auto"><option value="">Todas las categorías</option>${CATEGORIES.map(c => `<option value="${c.id}" ${ui.prodCat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
            <label class="flex items-center gap-2 text-sm px-2"><input type="checkbox" id="prodLow" ${ui.prodLow ? 'checked' : ''} class="rounded text-brand"> Solo inventario bajo</label>
        </div>
        <div class="overflow-x-auto scroll-thin"><table class="w-full min-w-[900px]">
            <thead><tr><th>Producto</th><th>Categoría</th><th class="text-right">Lista A</th><th class="text-right">Lista B</th><th class="text-right">Lista C</th><th class="text-right">Existencia</th><th>Estado</th></tr></thead>
            <tbody>${list.map(p => `<tr class="click" data-product="${p.id}">
                <td><div class="flex items-center gap-3">${productArt(p, 'w-10 h-10', 'w-5 h-5')}<div class="min-w-0"><p class="font-semibold leading-snug max-w-[340px] truncate">${esc(p.name)}</p><p class="text-xs text-navy/50">${esc(p.sku)} · ${esc(p.unit)}</p></div></div></td>
                <td class="text-navy/65">${catName(p.cat)}</td>
                <td class="text-right">${money(p.prices.A)}</td><td class="text-right">${money(p.prices.B)}</td><td class="text-right">${money(p.prices.C)}</td>
                <td class="text-right font-semibold ${p.stock === 0 ? 'text-red-700' : p.stock <= p.low ? 'text-amber-700' : ''}">${p.stock}</td>
                <td>${p.active === false ? '<span class="pill bg-paper text-navy/50">Oculto</span>' : p.stock === 0 ? '<span class="pill bg-red-50 text-red-700">Agotado</span>' : p.stock <= p.low ? '<span class="pill bg-amber-50 text-amber-800">Bajo</span>' : '<span class="pill bg-emerald-50 text-emerald-700">Disponible</span>'}</td></tr>`).join('') || `<tr><td colspan="7" class="text-center text-navy/55 py-10">No hay productos con ese filtro.</td></tr>`}</tbody>
        </table></div>
        <div class="flex items-center justify-between p-3 border-t border-line text-sm text-navy/60">
            <span>${all.length ? `${ui.prodPage * PER + 1}–${Math.min(all.length, (ui.prodPage + 1) * PER)} de ${all.length}` : '0 productos'}</span>
            <div class="flex gap-2"><button class="btn btn-ghost !py-1.5" data-ppage="-1" ${ui.prodPage === 0 ? 'disabled style="opacity:.4"' : ''}>${icon('ChevronLeft', 'w-4 h-4')}</button><button class="btn btn-ghost !py-1.5" data-ppage="1" ${ui.prodPage >= pages - 1 ? 'disabled style="opacity:.4"' : ''}>${icon('ChevronRight', 'w-4 h-4')}</button></div>
        </div>
    </div>`
}
afterRender.productos = () => {
    const i = $('prodQ'); i.oninput = () => { ui.prodQ = i.value; ui.prodPage = 0; const pos = i.selectionStart; render(); const n = $('prodQ'); n.focus(); n.setSelectionRange(pos, pos) }
    $('prodCat').onchange = e => { ui.prodCat = e.target.value; ui.prodPage = 0; render() }
    $('prodLow').onchange = e => { ui.prodLow = e.target.checked; ui.prodPage = 0; render() }
}

function openProduct(id) {
    const isNew = !id
    const p = isNew ? { id: '', sku: '', name: '', sub: '', cat: 'herramientas', unit: 'Unidad', prices: { A: 0, B: 0, C: 0 }, min: 1, stock: 0, low: 10, active: true } : product(id)
    const sold = state.orders.reduce((s, o) => s + o.items.filter(i => i.pid === p.id).reduce((a, i) => a + i.qty, 0), 0)
    $('dHead').innerHTML = `<p class="text-lg font-extrabold">${isNew ? 'Nuevo producto' : 'Editar producto'}</p>`
    $('dBody').innerHTML = `<form id="pForm" class="p-5 space-y-4">
        ${isNew ? '' : `<div class="flex gap-4 items-center p-4 rounded-xl bg-paper">${productArt(p, 'w-16 h-16', 'w-8 h-8')}<div><p class="text-xs text-navy/50">${esc(p.sku)}</p><p class="font-bold leading-snug">${esc(p.name)}</p><p class="text-sm text-navy/60 mt-0.5">${sold} unidades vendidas en 35 días</p></div></div>`}
        <div class="grid grid-cols-3 gap-3"><div class="col-span-1"><label class="lbl">Código</label><input name="sku" class="field" value="${esc(p.sku)}" ${isNew ? 'required' : 'readonly'}></div><div class="col-span-2"><label class="lbl">Categoría</label><select name="cat" class="field">${CATEGORIES.map(c => `<option value="${c.id}" ${p.cat === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select></div></div>
        <div><label class="lbl">Descripción</label><input name="name" class="field" value="${esc(p.name)}" required></div>
        <div class="grid grid-cols-2 gap-3"><div><label class="lbl">Empaque</label><input name="unit" class="field" value="${esc(p.unit)}"></div><div><label class="lbl">Marca / compatible con</label><input name="sub" class="field" value="${esc(p.sub || '')}"></div></div>
        <div><p class="lbl">Precios por lista</p><div class="grid grid-cols-3 gap-3">${['A', 'B', 'C'].map(l => `<div><div class="relative"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40 text-sm">$</span><input name="p${l}" type="number" step="0.01" min="0" class="field !pl-6" value="${p.prices[l]}"></div><p class="text-xs text-navy/50 mt-1">Lista ${l} · ${PRICE_LISTS[l]}</p></div>`).join('')}</div></div>
        <div class="grid grid-cols-3 gap-3"><div><label class="lbl">Existencia</label><input name="stock" type="number" min="0" class="field" value="${p.stock}"></div><div><label class="lbl">Avisar si baja de</label><input name="low" type="number" min="0" class="field" value="${p.low}"></div><div><label class="lbl">Mínimo por pedido</label><input name="min" type="number" min="1" class="field" value="${p.min}"></div></div>
        <label class="flex items-center justify-between p-4 rounded-xl border border-line"><span><span class="font-semibold block">Visible en el portal</span><span class="text-sm text-navy/55">Los clientes lo pueden ver y pedir</span></span><input name="active" type="checkbox" class="w-5 h-5 rounded text-brand" ${p.active !== false ? 'checked' : ''}></label>
    </form>`
    $('dFoot').innerHTML = `<div class="flex gap-2 justify-end"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-navy" id="pSave">${icon('Check', 'w-4 h-4')} Guardar</button></div>`
    $('pSave').onclick = () => {
        const f = new FormData($('pForm'))
        if (!f.get('name') || (isNew && !f.get('sku'))) { toast('Complete el código y la descripción.', { kind: 'warn' }); return }
        const t = isNew ? { id: f.get('sku'), prices: {} } : p
        Object.assign(t, { sku: f.get('sku'), name: f.get('name'), cat: f.get('cat'), unit: f.get('unit'), sub: f.get('sub'), stock: +f.get('stock'), low: +f.get('low'), min: Math.max(1, +f.get('min')), active: !!f.get('active') })
        t.prices = { A: +f.get('pA'), B: +f.get('pB'), C: +f.get('pC') }
        if (isNew) state.products.unshift(t)
        save(state); emit('products'); closeDrawer(); render(); toast(isNew ? 'Producto creado' : 'Cambios guardados', { kind: 'ok' })
    }
    $('drawer').hidden = false
}

// ---------------- CLIENTES ----------------
function pClientes() {
    const q = ui.cliQ.toLowerCase()
    const list = state.clients.filter(c => !q || (c.name + c.contact + c.town + c.id).toLowerCase().includes(q))
    const stats = c => {
        const os = state.orders.filter(o => o.clientId === c.id)
        const since = Date.now() - 30 * 864e5
        return { n: os.length, total30: os.filter(o => new Date(o.date) >= since).reduce((s, o) => s + orderTotals(o, c).total, 0), last: os[0] }
    }
    return `${pageHead('Clientes', `${state.clients.length} clientes con acceso al portal`, `<button class="btn btn-brand" data-act="newClient">${icon('Plus', 'w-4 h-4')} Nuevo cliente</button>`)}
    <div class="card">
        <div class="p-3 border-b border-line"><div class="relative max-w-sm"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40">${icon('Search', 'w-4 h-4')}</span><input id="cliQ" value="${esc(ui.cliQ)}" placeholder="Buscar cliente o pueblo" class="field !py-2 !pl-9"></div></div>
        <div class="overflow-x-auto scroll-thin"><table class="w-full min-w-[860px]">
            <thead><tr><th>Cliente</th><th>Pueblo / área</th><th>Lista</th><th>Vendedor</th><th class="text-right">Ventas 30 días</th><th>Último pedido</th><th></th></tr></thead>
            <tbody>${list.map(c => { const s = stats(c); return `<tr class="click" data-client="${c.id}">
                <td><div class="flex items-center gap-3">${avatar(c.name)}<div><p class="font-semibold">${esc(c.name)}</p><p class="text-xs text-navy/50">#${c.id} · ${esc(c.contact)}</p></div></div></td>
                <td>${esc(c.town)}<p class="text-xs text-navy/50">Área ${esc(c.area)}</p></td>
                <td><span class="pill bg-paper">${c.list} · ${PRICE_LISTS[c.list]}</span></td>
                <td class="text-navy/70">${esc(c.rep)}</td>
                <td class="text-right font-bold">${money(s.total30)}</td>
                <td class="text-navy/65">${s.last ? ago(s.last.date) : '—'}</td>
                <td>${c.exempt ? '<span class="pill bg-emerald-50 text-emerald-700">Exento IVU</span>' : ''}</td></tr>` }).join('')}</tbody>
        </table></div>
    </div>`
}
afterRender.clientes = () => { const i = $('cliQ'); i.oninput = () => { ui.cliQ = i.value; const pos = i.selectionStart; render(); const n = $('cliQ'); n.focus(); n.setSelectionRange(pos, pos) } }

function openClient(id) {
    const isNew = !id
    const c = isNew ? { id: String(1001 + state.clients.length), pin: String(Math.floor(1000 + Math.random() * 9000)), name: '', contact: '', town: '', area: Object.keys(state.areas)[0], list: 'A', exempt: true, phone: '', email: '', rep: me.name, since: new Date().getFullYear(), active: true } : client(id)
    const os = state.orders.filter(o => o.clientId === c.id)
    const total = os.reduce((s, o) => s + orderTotals(o, c).total, 0)
    $('dHead').innerHTML = `<p class="text-lg font-extrabold">${isNew ? 'Nuevo cliente' : esc(c.name)}</p>`
    $('dBody').innerHTML = `${isNew ? '' : `<div class="p-5 border-b border-line"><div class="grid grid-cols-3 gap-3 text-center">
            <div class="p-3 rounded-xl bg-paper"><p class="text-xl font-extrabold">${os.length}</p><p class="text-xs text-navy/55">órdenes</p></div>
            <div class="p-3 rounded-xl bg-paper"><p class="text-xl font-extrabold">${money0(total)}</p><p class="text-xs text-navy/55">comprado</p></div>
            <div class="p-3 rounded-xl bg-paper"><p class="text-xl font-extrabold">${os.length ? money0(total / os.length) : '$0'}</p><p class="text-xs text-navy/55">promedio</p></div></div>
            <div class="flex gap-2 mt-3"><a href="tel:${c.phone}" class="btn btn-ghost flex-1">${icon('Phone', 'w-4 h-4')} ${esc(c.phone)}</a><a href="mailto:${c.email}" class="btn btn-ghost flex-1 min-w-0">${icon('Mail', 'w-4 h-4')} <span class="truncate">Correo</span></a></div></div>`}
        <form id="cForm" class="p-5 space-y-4">
            <div><label class="lbl">Nombre del negocio</label><input name="name" class="field" value="${esc(c.name)}" required></div>
            <div class="grid grid-cols-2 gap-3"><div><label class="lbl">Contacto</label><input name="contact" class="field" value="${esc(c.contact)}"></div><div><label class="lbl">Teléfono</label><input name="phone" class="field" value="${esc(c.phone)}"></div></div>
            <div class="grid grid-cols-2 gap-3"><div><label class="lbl">Pueblo</label><input name="town" class="field" value="${esc(c.town)}"></div><div><label class="lbl">Área de entrega</label><select name="area" class="field">${Object.keys(state.areas).map(a => `<option ${c.area === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div></div>
            <div class="grid grid-cols-2 gap-3"><div><label class="lbl">Lista de precio</label><select name="list" class="field">${Object.entries(PRICE_LISTS).map(([k, v]) => `<option value="${k}" ${c.list === k ? 'selected' : ''}>Lista ${k} · ${v}</option>`).join('')}</select></div><div><label class="lbl">Vendedor</label><select name="rep" class="field">${STAFF.map(s => `<option ${c.rep === s.name ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div></div>
            <label class="flex items-center justify-between p-4 rounded-xl border border-line"><span class="font-semibold">Exento de IVU</span><input name="exempt" type="checkbox" class="w-5 h-5 rounded text-brand" ${c.exempt ? 'checked' : ''}></label>
            <div class="p-4 rounded-xl bg-paper flex items-center gap-3">${icon('Lock', 'w-5 h-5 text-navy/50')}<div class="flex-1"><p class="font-semibold text-sm">Acceso al portal</p><p class="text-sm text-navy/60">Cliente #${c.id} · PIN ${c.pin}</p></div><button type="button" class="btn btn-ghost !py-1.5 !text-xs" id="newPin">Cambiar PIN</button></div>
        </form>
        ${os.length ? `<div class="px-5 pb-5"><p class="font-bold mb-2">Órdenes recientes</p>${os.slice(0, 5).map(o => `<div class="flex items-center justify-between py-2.5 border-t border-line text-sm cursor-pointer" data-order="${o.id}"><span class="font-semibold">${o.id}</span><span class="text-navy/55">${fmtDate(o.date)}</span><span class="font-bold">${money(orderTotals(o, c).total)}</span>${statusPill(o.status)}</div>`).join('')}</div>` : ''}`
    $('dFoot').innerHTML = `<div class="flex gap-2 justify-end"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-navy" id="cSave">${icon('Check', 'w-4 h-4')} ${isNew ? 'Crear cliente' : 'Guardar'}</button></div>`
    $('newPin').onclick = () => { c.pin = String(Math.floor(1000 + Math.random() * 9000)); $('newPin').previousElementSibling.lastElementChild.textContent = `Cliente #${c.id} · PIN ${c.pin}`; toast('PIN nuevo generado. Se le envió por mensaje al cliente.', { kind: 'ok' }) }
    $('cSave').onclick = () => {
        const f = new FormData($('cForm'))
        if (!f.get('name')) { toast('Escriba el nombre del negocio.', { kind: 'warn' }); return }
        Object.assign(c, { name: f.get('name'), contact: f.get('contact'), phone: f.get('phone'), town: f.get('town'), area: f.get('area'), list: f.get('list'), rep: f.get('rep'), exempt: !!f.get('exempt') })
        if (isNew) { state.clients.push(c); state.favorites[c.id] = [] }
        save(state); emit('clients'); closeDrawer(); render()
        toast(isNew ? `Cliente creado. Acceso: #${c.id}, PIN ${c.pin}` : 'Cambios guardados', { kind: 'ok' })
    }
    $('drawer').hidden = false
}

// ---------------- TOMAR PEDIDO (vendedor) ----------------
function openNewOrder() {
    let cid = '', cart = {}, q = ''
    $('dHead').innerHTML = `<p class="text-lg font-extrabold">Tomar pedido</p><p class="text-xs text-navy/55 -mt-0.5">Para pedidos por teléfono o en la calle</p>`
    const draw = () => {
        const c = client(cid)
        const res = q.length > 1 ? state.products.filter(p => p.active !== false && (p.name + ' ' + p.sku).toLowerCase().includes(q.toLowerCase())).slice(0, 8) : []
        const lines = Object.entries(cart)
        const sub = c ? lines.reduce((s, [pid, n]) => s + n * product(pid).prices[c.list], 0) : 0
        $('dBody').innerHTML = `<div class="p-5 space-y-4">
            <div><label class="lbl">Cliente</label><select id="noC" class="field"><option value="">Seleccione…</option>${state.clients.map(x => `<option value="${x.id}" ${cid === x.id ? 'selected' : ''}>${esc(x.name)} · ${esc(x.town)}</option>`).join('')}</select></div>
            ${c ? `<div><label class="lbl">Añadir producto</label><input id="noQ" class="field" placeholder="Escriba nombre o código" value="${esc(q)}">
            <div class="mt-1">${res.map(p => `<button class="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-paper text-left" data-add="${p.id}">${productArt(p, 'w-9 h-9', 'w-4 h-4')}<span class="flex-1 min-w-0"><span class="block text-sm font-semibold truncate">${esc(p.name)}</span><span class="text-xs text-navy/50">${esc(p.sku)} · ${p.stock} disp.</span></span><span class="text-sm font-bold">${money(p.prices[c.list])}</span></button>`).join('')}</div></div>
            <div class="divide-y divide-line">${lines.map(([pid, n]) => { const p = product(pid); return `<div class="py-2.5 flex items-center gap-3"><div class="flex-1 min-w-0"><p class="text-sm font-semibold truncate">${esc(p.name)}</p><p class="text-xs text-navy/50">${money(p.prices[c.list])} c/u</p></div><div class="flex items-center gap-1"><button class="btn btn-ghost !p-1.5" data-dec="${pid}">${icon('Minus', 'w-3.5 h-3.5')}</button><span class="w-8 text-center font-bold">${n}</span><button class="btn btn-ghost !p-1.5" data-inc="${pid}">${icon('Plus', 'w-3.5 h-3.5')}</button></div><span class="w-20 text-right text-sm font-bold">${money(n * p.prices[c.list])}</span></div>` }).join('')}</div>
            ${lines.length ? `<div class="flex justify-between font-extrabold text-lg pt-2 border-t border-line"><span>Total</span><span>${money(sub * (c.exempt ? 1 : 1 + IVU))}</span></div>` : '<p class="text-sm text-navy/50">Busque productos para añadirlos.</p>'}` : ''}
        </div>`
        $('dFoot').innerHTML = `<div class="flex gap-2 justify-end"><button class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-brand" id="noSave" ${c && lines.length ? '' : 'disabled style="opacity:.45"'}>${icon('Check', 'w-4 h-4')} Crear orden</button></div>`
        $('noC').onchange = e => { cid = e.target.value; draw() }
        const qi = $('noQ'); if (qi) { qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; draw(); const n = $('noQ'); n.focus(); n.setSelectionRange(pos, pos) } }
        $('dBody').onclick = e => {
            const a = e.target.closest('[data-add]'), i = e.target.closest('[data-inc]'), d = e.target.closest('[data-dec]')
            if (a) { cart[a.dataset.add] = (cart[a.dataset.add] || 0) + 1; q = ''; draw() }
            if (i) { cart[i.dataset.inc]++; draw() }
            if (d) { if (--cart[d.dataset.dec] <= 0) delete cart[d.dataset.dec]; draw() }
        }
        const sv = $('noSave'); if (sv && c && lines.length) sv.onclick = () => { const o = placeOrder(state, cid, cart, '', me.name); delete o.isNew; save(state); closeDrawer(); page = 'ordenes'; render(); toast(`Orden ${o.id} creada para ${c.name}`, { kind: 'ok' }) }
    }
    draw()
    $('drawer').hidden = false
}

// ---------------- IMPORTAR ----------------
let lastChanges = null
function pImportar() {
    return `${pageHead('Importar inventario', 'Actualice existencias y precios con el archivo que exporta Retail Manager.')}
    <div class="grid lg:grid-cols-5 gap-4">
        <div class="lg:col-span-2 space-y-4">
            <div class="card p-5">
                <ol class="space-y-3 text-sm mb-5">${['En Retail Manager, exporte el inventario a Excel o CSV.', 'Arrastre el archivo aquí o selecciónelo.', 'Revise los cambios. El portal se actualiza al momento.'].map((t, i) => `<li class="flex gap-3"><span class="w-6 h-6 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center shrink-0">${i + 1}</span><span class="pt-0.5">${t}</span></li>`).join('')}</ol>
                <label id="drop" class="block border-2 border-dashed border-line rounded-xl p-8 text-center cursor-pointer hover:border-navy hover:bg-paper transition">
                    <span class="inline-flex w-12 h-12 rounded-xl bg-paper items-center justify-center text-navy/60">${icon('FileSpreadsheet', 'w-6 h-6')}</span>
                    <p class="font-bold mt-3">Arrastre el archivo aquí</p>
                    <p class="text-sm text-navy/55">o haga clic para buscarlo (.csv)</p>
                    <input type="file" id="fileInput" accept=".csv,text/csv" class="hidden">
                </label>
                <button id="useSample" class="btn btn-brand w-full mt-3">${icon('Sparkles', 'w-4 h-4')} Probar con un archivo de ejemplo</button>
                <p class="text-sm text-navy/55 mt-3">${state.lastImport ? 'Última importación: ' + fmtDate(state.lastImport) : 'Todavía no se ha importado ningún archivo.'}</p>
            </div>
        </div>
        <div class="card p-5 lg:col-span-3">
            <p class="font-bold mb-3">Resultado</p>
            <div id="importResult">${lastChanges ? lastChanges : `<div class="py-16 text-center text-navy/45">${icon('Upload', 'w-8 h-8 mx-auto mb-2')}<p>Aquí verá lo que cambió.</p></div>`}</div>
        </div>
    </div>`
}
afterRender.importar = () => {
    const run = (text, name) => {
        let rows = []; try { rows = parseImport(text) } catch (e) {}
        if (!rows.length) { toast('No pudimos leer el archivo. Verifique las columnas.', { kind: 'warn' }); return }
        const ch = applyImport(state, rows, money)
        lastChanges = `<div class="flex flex-wrap gap-2 mb-4"><span class="pill bg-paper">${icon('FileSpreadsheet', 'w-3.5 h-3.5')} ${esc(name)}</span><span class="pill bg-paper">${rows.length} filas</span><span class="pill bg-emerald-50 text-emerald-700">${ch.filter(c => c.kind === 'Actualizado').length} actualizados</span><span class="pill bg-sky-50 text-sky-800">${ch.filter(c => c.kind === 'Nuevo').length} nuevos</span></div>
            <div class="divide-y divide-line">${ch.map(c => `<div class="py-3 flex gap-3 items-start"><span class="pill shrink-0 ${c.kind === 'Nuevo' ? 'bg-sky-50 text-sky-800' : 'bg-emerald-50 text-emerald-700'}">${c.kind}</span><div class="min-w-0"><p class="font-semibold text-sm">${esc(c.name)} <span class="text-navy/45 font-normal">${esc(c.sku)}</span></p><p class="text-sm text-navy/60">${esc(c.detail)}</p></div></div>`).join('') || '<p class="text-sm text-navy/55">Todo estaba al día.</p>'}</div>`
        render(); toast(`Inventario actualizado: ${ch.length} cambios`, { kind: 'ok' })
    }
    $('useSample').onclick = () => run(SAMPLE_IMPORT, 'inventario-retail-manager.csv')
    $('fileInput').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => run(r.result, f.name); r.readAsText(f) }
    const d = $('drop')
    d.ondragover = e => { e.preventDefault(); d.classList.add('border-navy', 'bg-paper') }
    d.ondragleave = () => d.classList.remove('border-navy', 'bg-paper')
    d.ondrop = e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => run(r.result, f.name); r.readAsText(f) }
}

// ---------------- AJUSTES ----------------
function pAjustes() {
    const D = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
    return `${pageHead('Ajustes', 'Reglas de pedido y usuarios del sistema')}
    <div class="grid xl:grid-cols-2 gap-4">
        <div class="card p-5">
            <p class="font-bold">Áreas de entrega</p><p class="text-sm text-navy/55 mb-4">Pedido mínimo y días de entrega de cada área.</p>
            <div class="space-y-3" id="areas">${Object.entries(state.areas).map(([a, v]) => `<div class="p-3 rounded-xl bg-paper flex flex-wrap items-center gap-3" data-area="${esc(a)}">
                <p class="font-semibold w-24">${esc(a)}</p>
                <div class="relative w-28"><span class="absolute left-3 top-1/2 -translate-y-1/2 text-navy/40 text-sm">$</span><input type="number" class="field !py-1.5 !pl-6 !bg-white" data-min value="${v.min}"></div>
                <div class="flex gap-1">${D.map((l, i) => `<button type="button" data-day="${i}" class="w-8 h-8 rounded-lg text-xs font-bold ${v.days.includes(i) ? 'bg-navy text-white' : 'bg-white text-navy/40 border border-line'}">${l}</button>`).join('')}</div>
            </div>`).join('')}</div>
            <button class="btn btn-navy mt-4" id="saveAreas">${icon('Check', 'w-4 h-4')} Guardar áreas</button>
        </div>
        <div class="space-y-4">
            <div class="card p-5"><p class="font-bold mb-3">Usuarios</p>${STAFF.map(s => `<div class="flex items-center gap-3 py-2.5 border-t border-line first:border-0">${avatar(s.name)}<div class="flex-1"><p class="font-semibold text-sm">${esc(s.name)}</p><p class="text-xs text-navy/55">${esc(s.email)}</p></div><span class="pill bg-paper">${s.role}</span></div>`).join('')}
                <button class="btn btn-ghost mt-3" onclick="return false">${icon('Plus', 'w-4 h-4')} Invitar usuario</button></div>
            <div class="card p-5"><p class="font-bold mb-3">Negocio</p><div class="grid grid-cols-2 gap-3 text-sm">
                <div><p class="text-navy/50 text-xs">Impuesto</p><p class="font-semibold">IVU 11.5%</p></div><div><p class="text-navy/50 text-xs">Forma de pago</p><p class="font-semibold">Contra entrega (COD)</p></div>
                <div><p class="text-navy/50 text-xs">Listas de precio</p><p class="font-semibold">A, B y C</p></div><div><p class="text-navy/50 text-xs">Inventario</p><p class="font-semibold">Retail Manager (archivo)</p></div></div></div>
        </div>
    </div>`
}
afterRender.ajustes = () => {
    $('areas').onclick = e => { const b = e.target.closest('[data-day]'); if (!b) return; b.classList.toggle('bg-navy'); b.classList.toggle('text-white'); b.classList.toggle('bg-white'); b.classList.toggle('text-navy/40'); b.classList.toggle('border') }
    $('saveAreas').onclick = () => {
        document.querySelectorAll('[data-area]').forEach(r => {
            const a = state.areas[r.dataset.area]
            a.min = +r.querySelector('[data-min]').value || 0
            a.days = [...r.querySelectorAll('[data-day]')].filter(b => b.classList.contains('bg-navy')).map(b => +b.dataset.day)
        })
        save(state); emit('areas'); toast('Áreas guardadas. El portal ya usa los nuevos mínimos.', { kind: 'ok' })
    }
}

// ---------------- búsqueda global ----------------
$('gsearch').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase()
    const box = $('gresults')
    if (q.length < 2) { box.hidden = true; return }
    const os = state.orders.filter(o => o.id.toLowerCase().includes(q)).slice(0, 3)
    const cs = state.clients.filter(c => (c.name + c.town).toLowerCase().includes(q)).slice(0, 3)
    const ps = state.products.filter(p => (p.name + p.sku).toLowerCase().includes(q)).slice(0, 4)
    const sec = (t, items) => items.length ? `<p class="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider text-navy/45 font-semibold">${t}</p>${items.join('')}` : ''
    box.innerHTML = (sec('Órdenes', os.map(o => `<button class="w-full text-left px-4 py-2 hover:bg-paper flex justify-between text-sm" data-order="${o.id}"><span class="font-semibold">${o.id} · ${esc(client(o.clientId).name)}</span>${statusPill(o.status)}</button>`)) +
        sec('Clientes', cs.map(c => `<button class="w-full text-left px-4 py-2 hover:bg-paper text-sm" data-client="${c.id}"><span class="font-semibold">${esc(c.name)}</span> <span class="text-navy/50">${esc(c.town)}</span></button>`)) +
        sec('Productos', ps.map(p => `<button class="w-full text-left px-4 py-2 hover:bg-paper text-sm truncate" data-product="${p.id}"><span class="text-navy/50">${esc(p.sku)}</span> <span class="font-semibold">${esc(p.name)}</span></button>`))) || '<p class="p-4 text-sm text-navy/55">Sin resultados.</p>'
    box.hidden = false
})
document.addEventListener('click', e => { if (!e.target.closest('#gresults') && e.target.id !== 'gsearch') $('gresults').hidden = true; if (!e.target.closest('#bellMenu') && !e.target.closest('#bellBtn')) $('bellMenu').hidden = true })

// ---------------- notificaciones y modo en vivo ----------------
function renderBell() {
    const unread = notifs.filter(n => !n.read).length
    $('bellCount').hidden = !unread; $('bellCount').textContent = unread
    $('bellMenu').innerHTML = `<div class="p-4 border-b border-line flex justify-between items-center"><p class="font-bold">Notificaciones</p>${notifs.length ? '<button class="text-xs text-brand font-semibold" id="markRead">Marcar leídas</button>' : ''}</div>
        <div class="max-h-80 overflow-y-auto scroll-thin">${notifs.length ? notifs.map(n => `<button class="w-full text-left p-4 border-b border-line hover:bg-paper flex gap-3 ${n.read ? '' : 'bg-orange-50/50'}" data-order="${n.id}"><span class="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0">${icon('ShoppingCart', 'w-4 h-4')}</span><span><span class="block text-sm"><b>Pedido nuevo ${n.id}</b> de ${esc(n.name)}</span><span class="text-xs text-navy/55">${money(n.total)} · ${ago(n.at)}</span></span></button>`).join('') : '<p class="p-6 text-center text-sm text-navy/55">No hay notificaciones nuevas.</p>'}</div>`
    const mr = $('markRead'); if (mr) mr.onclick = () => { notifs.forEach(n => n.read = true); renderBell() }
}
$('bellBtn').onclick = () => { $('bellMenu').hidden = !$('bellMenu').hidden }

function renderLive() {
    $('liveBtn').innerHTML = liveTimer ? `<span class="w-2 h-2 rounded-full bg-red-500 live-dot"></span> En vivo` : `${icon('Radio', 'w-4 h-4')} Modo en vivo`
    $('liveBtn').classList.toggle('!border-red-300', !!liveTimer)
}
$('liveBtn').onclick = () => {
    if (liveTimer) { stopLive(); toast('Modo en vivo apagado') }
    else { liveTimer = setInterval(() => { simulateOrder(state); onRemoteOrder() }, 40000); toast('Llegará un pedido de prueba cada 40 segundos.', { title: 'Modo en vivo encendido' }); setTimeout(() => { if (liveTimer) { simulateOrder(state); onRemoteOrder() } }, 5000) }
    renderLive()
}
function stopLive() { clearInterval(liveTimer); liveTimer = null; renderLive() }

function onRemoteOrder() {
    const fresh = load()
    const known = new Set(state.orders.map(o => o.id))
    state = fresh
    const added = state.orders.filter(o => !known.has(o.id) || o.isNew && !notifs.some(n => n.id === o.id))
    added.filter(o => o.isNew).forEach(o => {
        if (notifs.some(n => n.id === o.id)) return
        const c = client(o.clientId)
        notifs.unshift({ id: o.id, name: c.name, total: totalOf(o), at: o.date, read: false })
        chime()
        toast(`${esc(c.name)} · ${money(totalOf(o))} · ${o.items.length} productos`, { kind: 'order', title: `Pedido nuevo ${o.id}`, ms: 6000 })
    })
    if (me) render()
}
subscribe(msg => {
    if (!me) { state = load(); return }
    if (msg.type === 'order') onRemoteOrder()
    else { state = load(); render() }
})
window.addEventListener('storage', e => { if (e.key && e.key.startsWith('siovera-demo') && me) { const before = state.orders.length; const s = load(); if (s.orders.length > before) onRemoteOrder(); else { state = s; render() } } })

// ---------------- clics globales ----------------
document.addEventListener('click', e => {
    const t = e.target
    const pick = sel => t.closest(sel)
    let el
    if ((el = pick('[data-close]'))) { closeDrawer(); return }
    if ((el = pick('[data-advance]'))) { e.stopPropagation(); advance(el.dataset.advance, el.dataset.reopen); return }
    if ((el = pick('[data-print]'))) { printDoc(el.dataset.print, el.dataset.id); return }
    if ((el = pick('[data-order]'))) { $('gresults').hidden = true; $('bellMenu').hidden = true; const n = notifs.find(x => x.id === el.dataset.order); if (n) { n.read = true; renderBell() }; openOrder(el.dataset.order); return }
    if ((el = pick('[data-client]'))) { $('gresults').hidden = true; openClient(el.dataset.client); return }
    if ((el = pick('[data-product]'))) { $('gresults').hidden = true; openProduct(el.dataset.product); return }
    if ((el = pick('[data-otab]'))) { ui.ordStatus = el.dataset.otab; render(); return }
    if ((el = pick('[data-ppage]'))) { ui.prodPage += +el.dataset.ppage; render(); return }
    if ((el = pick('#page [data-nav]'))) { go(el.dataset.nav); return }
    if ((el = pick('[data-act]'))) {
        const a = el.dataset.act
        if (a === 'newOrder') openNewOrder()
        if (a === 'newProduct') openProduct(null)
        if (a === 'newClient') openClient(null)
        if (a === 'lowStock') { ui.prodLow = true; ui.prodCat = ''; ui.prodQ = ''; go('productos') }
        if (a === 'export') exportCsv()
    }
})
function closeDrawer() { $('drawer').hidden = true }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer() })

function exportCsv() {
    const rows = [['orden', 'fecha', 'cliente', 'area', 'estado', 'total']].concat(state.orders.map(o => { const c = client(o.clientId); return [o.id, o.date.slice(0, 10), c.name, c.area, o.status, totalOf(o).toFixed(2)] }))
    const blob = new Blob([rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ordenes-siovera.csv'; a.click()
    toast('Archivo de órdenes descargado', { kind: 'ok' })
}

// refrescar los "hace X min"
setInterval(() => { if (me && page === 'inicio' && $('drawer').hidden) render() }, 60000)

if (me) boot(); else showLogin()
