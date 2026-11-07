import { load, save, subscribe, placeOrder, orderTotals, areaOf, nextDelivery, STATUSES, PRICE_LISTS, CATEGORIES, IVU } from './data.js'
import { icon, money, fmtDate, fmtDay, ago, esc, initials, toast, chime, productArt, STATUS_STYLE } from './ui.js'

let state = load()
let me = null
let cart = {}
let view = 'home'
let cat = 'todo'
let query = ''
let shown = 24
let draftNote = ''
const $ = id => document.getElementById(id)
const product = id => state.products.find(p => p.id === id)
const visible = () => state.products.filter(p => p.active !== false)
const price = p => p.prices[me.list]
const myOrders = () => state.orders.filter(o => o.clientId === me.id)
const SKEY = 'siovera-portal'

document.querySelectorAll('[data-ic]').forEach(el => el.innerHTML = icon(el.dataset.ic, 'w-5 h-5'))

// ---------------- sesión ----------------
function restore() {
    try {
        const s = JSON.parse(localStorage.getItem(SKEY) || 'null')
        if (s) { me = state.clients.find(c => c.id === s.id) || null; cart = s.cart || {} }
    } catch (e) {}
}
function persist() { try { localStorage.setItem(SKEY, JSON.stringify({ id: me && me.id, cart })) } catch (e) {} }

$('artWall').innerHTML = ['herramientas', 'presion', 'jardineria', 'electrico', 'plomeria', 'pintura', 'auto', 'tornilleria', 'lonas'].map(c => productArt({ cat: c }, 'w-32 h-32 !rounded-3xl shadow-2xl', 'w-14 h-14')).join('')
$('demoTitle').innerHTML = `<span class="inline-flex items-center gap-2">${icon('Sparkles', 'w-4 h-4 text-brand')} Cuentas de prueba · PIN 1234</span>`
$('demoAccounts').innerHTML = state.clients.slice(0, 3).map(c => `<button type="button" class="w-full flex items-center justify-between py-1.5 text-left hover:text-brand" data-acc="${c.id}"><span><b>${c.id}</b> · ${esc(c.name)}</span>${icon('ChevronRight', 'w-4 h-4 opacity-50')}</button>`).join('')
$('demoAccounts').onclick = e => { const b = e.target.closest('[data-acc]'); if (b) { $('cid').value = b.dataset.acc; $('pin').value = '1234'; $('loginBtn').focus() } }
$('forgot').onclick = e => { e.preventDefault(); toast('Le avisamos a su vendedor. Le enviará un PIN nuevo por mensaje de texto.', { kind: 'ok', title: 'Solicitud enviada' }) }
$('loginForm').addEventListener('submit', e => {
    e.preventDefault()
    const c = state.clients.find(x => x.id === $('cid').value.trim() && x.pin === $('pin').value.trim())
    const b = $('loginBtn'); b.disabled = true
    b.innerHTML = `<svg class="w-6 h-6 spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity=".3" stroke-width="3"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`
    setTimeout(() => {
        b.disabled = false; b.textContent = 'Entrar'
        if (!c) { $('loginErr').hidden = false; const f = $('loginForm'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); return }
        me = c; cart = {}; persist(); view = 'home'; render()
    }, 600)
})
function logout() { me = null; cart = {}; persist(); $('cid').value = ''; $('pin').value = ''; $('loginErr').hidden = true; render() }

// ---------------- render ----------------
function render() {
    $('login').hidden = !!me; $('app').hidden = !me
    if (!me) return
    $('acctBtn').textContent = initials(me.name)
    const unseen = myOrders().some(o => o.unseenByClient)
    $('ordDot').hidden = !unseen
    $('tabbar').innerHTML = [['home', 'Inicio', 'Home'], ['catalog', 'Catálogo', 'Boxes'], ['orders', 'Pedidos', 'ClipboardList']].map(([v, l, ic]) =>
        `<button data-go="${v}" class="flex flex-col items-center justify-center gap-0.5 text-[13px] font-semibold relative ${view === v ? 'text-brand' : 'text-navy/55'}">${icon(ic, 'w-6 h-6')}${l}${v === 'orders' && unseen ? '<span class="absolute top-2 right-[34%] w-2.5 h-2.5 rounded-full bg-brand"></span>' : ''}</button>`).join('')
    const fn = { home: vHome, catalog: vCatalog, orders: vOrders, done: vDone }[view]
    $('view').innerHTML = fn()
    after[view] && after[view]()
    renderCartBtn()
}
const after = {}

function renderCartBtn() {
    const n = Object.values(cart).reduce((s, q) => s + q, 0)
    $('cartBadge').hidden = !n; $('cartBadge').textContent = n
    $('cartTotalTop').textContent = n ? money(cartSubtotal()) : 'Carrito'
}
function cartSubtotal() { return Object.entries(cart).reduce((s, [pid, q]) => s + q * price(product(pid)), 0) }

// ---------------- tarjetas ----------------
function qtyControl(p, big) {
    const q = cart[p.id] || 0
    if (p.stock <= 0) return `<button class="btn w-full bg-paper text-navy/40 !min-h-[46px]" disabled>Agotado</button>`
    if (!q) return `<button class="btn btn-ghost w-full !min-h-[46px]" data-add="${p.id}">${icon('Plus', 'w-5 h-5')} Añadir${p.min > 1 ? ` (mín. ${p.min})` : ''}</button>`
    return `<div class="flex items-center gap-2">
        <button class="qty bg-paper ${big ? '!w-14 !h-14' : ''}" data-dec="${p.id}" aria-label="Menos">${icon(q <= p.min ? 'Trash2' : 'Minus', 'w-5 h-5')}</button>
        <div class="flex-1 text-center text-2xl font-extrabold">${q}</div>
        <button class="qty bg-brand text-white ${big ? '!w-14 !h-14' : ''}" data-inc="${p.id}" aria-label="Más">${icon('Plus', 'w-5 h-5')}</button></div>`
}
const fav = p => (state.favorites[me.id] || []).includes(p.id)
function card(p) {
    const out = p.stock <= 0, low = !out && p.stock <= p.low
    return `<div class="card p-4 flex flex-col" data-card="${p.id}">
        <div class="flex gap-4 cursor-pointer" data-open="${p.id}">
            ${productArt(p)}
            <div class="min-w-0 flex-1">
                <p class="font-bold leading-snug line-clamp-2 break-words">${esc(p.name)}</p>
                <p class="text-navy/50 text-sm mt-0.5 truncate">${esc(p.sku)} · ${esc(p.unit)}</p>
                <p class="text-2xl font-extrabold mt-1">${money(price(p))}</p>
            </div>
            <button class="self-start -mr-1 -mt-1 p-1.5 ${fav(p) ? 'text-brand' : 'text-navy/25'}" data-fav="${p.id}" aria-label="Favorito">${icon('Heart', 'w-5 h-5', fav(p) ? { fill: 'currentColor' } : {})}</button>
        </div>
        <p class="text-sm mt-3 mb-2 ${out ? 'text-red-700 font-semibold' : low ? 'text-amber-700 font-semibold' : 'text-emerald-700'}">${out ? 'Agotado por ahora' : low ? `Quedan ${p.stock}` : '● Disponible'}</p>
        <div class="mt-auto" data-qty="${p.id}">${qtyControl(p)}</div>
    </div>`
}

// ---------------- INICIO ----------------
function vHome() {
    const nd = nextDelivery(state, me), area = areaOf(state, me)
    const last = myOrders()[0]
    const changed = myOrders().filter(o => o.unseenByClient)
    const favs = (state.favorites[me.id] || []).map(product).filter(Boolean)
    const freq = {}
    myOrders().forEach(o => o.items.forEach(i => freq[i.pid] = (freq[i.pid] || 0) + i.qty))
    const usual = [...new Set([...favs.map(p => p.id), ...Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([id]) => id)])].map(product).filter(p => p && p.active !== false).slice(0, 8)
    const count = id => visible().filter(p => p.cat === id).length
    return `
    <div class="rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden up" style="background:linear-gradient(135deg,#14233C,#1F3557 70%,#2A4570)">
        <div class="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-brand/30 blur-3xl"></div>
        <p class="text-white/70 relative">Hola,</p>
        <h1 class="text-3xl sm:text-4xl font-extrabold relative">${esc(me.contact.split(' ')[0])} 👋</h1>
        <p class="text-white/70 relative">${esc(me.name)}</p>
        <div class="grid sm:grid-cols-2 gap-3 mt-6 relative">
            <div class="rounded-2xl bg-white/10 p-4 flex gap-3 items-center">${icon('Truck', 'w-7 h-7 text-brand shrink-0')}<div><p class="text-sm text-white/65">Próxima entrega en ${esc(me.town)}</p><p class="font-bold text-lg">${nd ? fmtDay(nd) : '—'}</p></div></div>
            <div class="rounded-2xl bg-white/10 p-4 flex gap-3 items-center">${icon('Receipt', 'w-7 h-7 text-brand shrink-0')}<div><p class="text-sm text-white/65">Pedido mínimo · pago al recibir</p><p class="font-bold text-lg">${money(area.min)}</p></div></div>
        </div>
    </div>
    ${changed.map(o => `<button data-go="orders" class="w-full mt-4 card p-4 flex items-center gap-4 text-left border-l-4 !border-l-brand up"><span class="w-11 h-11 rounded-full flex items-center justify-center ${STATUS_STYLE[o.status].cls}">${icon(STATUS_STYLE[o.status].icon, 'w-5 h-5')}</span><span class="flex-1"><span class="block font-bold">Su pedido ${o.id} ${o.status === 'Entregada' ? 'fue entregado' : o.status === 'En ruta' ? 'va de camino' : 'se está preparando'}</span><span class="text-navy/60 text-[15px]">${ago(o.history[o.history.length - 1].at)} · Toque para ver</span></span>${icon('ChevronRight', 'w-5 h-5 text-navy/40')}</button>`).join('')}
    ${last ? `<div class="card p-5 mt-4 flex flex-col sm:flex-row sm:items-center gap-4 up">
        <div class="flex-1"><p class="font-extrabold text-lg">¿Lo mismo de la última vez?</p><p class="text-navy/60">Pedido ${last.id} · ${fmtDate(last.date, { day: 'numeric', month: 'long' })} · ${last.items.length} productos · ${money(orderTotals(last, me).total)}</p></div>
        <button class="btn btn-brand text-lg" data-repeat="${last.id}">${icon('RotateCcw', 'w-5 h-5')} Repetir pedido</button></div>` : ''}
    ${usual.length ? `<div class="mt-8"><div class="flex items-end justify-between mb-3"><h2 class="text-xl font-extrabold">Lo que usted pide siempre</h2></div>
        <div class="flex gap-4 overflow-x-auto no-scroll -mx-4 px-4 pb-2 snap-x">${usual.map(p => `<div class="min-w-[310px] max-w-[310px] snap-start">${card(p)}</div>`).join('')}</div></div>` : ''}
    <div class="mt-8"><h2 class="text-xl font-extrabold mb-3">Categorías</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">${CATEGORIES.map(c => `<button class="card p-4 text-left hover:border-navy/30 transition" data-cat="${c.id}">${productArt({ cat: c.id }, 'w-12 h-12', 'w-6 h-6')}<p class="font-bold mt-3 leading-tight">${c.name}</p><p class="text-sm text-navy/50">${count(c.id)} productos</p></button>`).join('')}</div></div>`
}

// ---------------- CATÁLOGO ----------------
function filtered() {
    const q = query.trim().toLowerCase()
    return visible().filter(p => (cat === 'todo' || (cat === 'fav' ? fav(p) : p.cat === cat)) && (!q || (p.name + ' ' + p.sku + ' ' + (p.sub || '')).toLowerCase().includes(q)))
}
function vCatalog() {
    const all = filtered(), items = all.slice(0, shown)
    const chips = [{ id: 'todo', name: 'Todo' }, { id: 'fav', name: 'Favoritos' }, ...CATEGORIES]
    return `
    <div class="md:hidden relative mb-3"><span class="absolute left-4 top-1/2 -translate-y-1/2 text-navy/40">${icon('Search', 'w-5 h-5')}</span><input id="searchMob" value="${esc(query)}" placeholder="Buscar producto o código…" class="field !pl-12"></div>
    <div class="flex gap-2 overflow-x-auto no-scroll -mx-4 px-4 pb-1">${chips.map(c => `<button class="chip ${c.id === cat ? 'on' : ''}" data-cat="${c.id}">${c.id === 'fav' ? icon('Heart', 'w-4 h-4') : ''}${c.name}</button>`).join('')}</div>
    <div class="flex items-center justify-between mt-5 mb-3"><h1 class="text-2xl font-extrabold">${query ? `Resultados para “${esc(query)}”` : cat === 'todo' ? 'Todo el catálogo' : cat === 'fav' ? 'Sus favoritos' : CATEGORIES.find(c => c.id === cat).name}</h1><p class="text-navy/55">${all.length} productos</p></div>
    <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">${items.map(card).join('') || `<div class="col-span-full text-center py-16 text-navy/55">${icon('Search', 'w-10 h-10 mx-auto mb-3 opacity-40')}<p class="text-lg">No encontramos productos.</p>${cat === 'fav' ? '<p>Toque el corazón en un producto para guardarlo aquí.</p>' : ''}</div>`}</div>
    ${all.length > shown ? `<button class="btn btn-ghost w-full mt-5" id="more">Ver más productos (${all.length - shown})</button>` : ''}`
}
after.catalog = () => {
    const m = $('more'); if (m) m.onclick = () => { shown += 24; render() }
    const s = $('searchMob'); if (s) s.oninput = () => { query = s.value; shown = 24; const pos = s.selectionStart; render(); const n = $('searchMob'); n.focus(); n.setSelectionRange(pos, pos) }
}
$('searchTop').addEventListener('input', e => { query = e.target.value; shown = 24; if (view !== 'catalog') { view = 'catalog'; cat = 'todo' } render(); window.scrollTo(0, 0) })

// ---------------- PEDIDOS ----------------
function tracker(o) {
    const cur = STATUSES.indexOf(o.status)
    return `<div class="flex items-start mt-4">${STATUSES.map((s, i) => { const h = (o.history || []).find(x => x.status === s); return `<div class="flex-1 flex flex-col items-center text-center relative">
        ${i ? `<div class="absolute top-[18px] right-1/2 w-full h-1 rounded ${i <= cur ? 'bg-emerald-500' : 'bg-paper'}"></div>` : ''}
        <div class="relative w-9 h-9 rounded-full flex items-center justify-center ${i <= cur ? 'bg-emerald-500 text-white' : 'bg-paper text-navy/30'} ${i === cur && s !== 'Entregada' ? 'ring-4 ring-emerald-100' : ''}">${icon(STATUS_STYLE[s].icon, 'w-4 h-4')}</div>
        <p class="text-[13px] font-semibold mt-1.5 ${i <= cur ? '' : 'text-navy/35'}">${s}</p>
        <p class="text-xs text-navy/45">${h ? fmtDate(h.at, { hour: 'numeric', minute: '2-digit' }) : ''}</p></div>` }).join('')}</div>`
}
function vOrders() {
    const list = myOrders()
    const html = `<h1 class="text-2xl font-extrabold mb-4">Mis pedidos</h1>
    <div class="space-y-4">${list.map((o, idx) => { const t = orderTotals(o, me); return `<div class="card p-5 ${o.unseenByClient ? 'ring-2 ring-brand/40' : ''}">
        <div class="flex items-start justify-between gap-3"><div><p class="font-extrabold text-lg">${o.id}</p><p class="text-navy/55 text-[15px]">${fmtDate(o.date, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</p></div>
            <div class="text-right"><p class="font-extrabold text-xl">${money(t.total)}</p><p class="text-navy/55 text-[15px]">${t.units} artículos</p></div></div>
        ${o.status !== 'Entregada' || idx < 2 ? tracker(o) : `<p class="mt-3 text-emerald-700 font-semibold flex items-center gap-2">${icon('CircleCheck', 'w-5 h-5')} Entregado ${fmtDate(o.history[o.history.length - 1].at, { day: 'numeric', month: 'short' })}</p>`}
        <details class="mt-4 group"><summary class="cursor-pointer list-none flex items-center gap-1 text-navy/65 font-semibold">${icon('ChevronDown', 'w-4 h-4 group-open:rotate-180 transition')} Ver productos</summary>
            <ul class="mt-3 space-y-2 text-[15px]">${o.items.map(i => { const p = product(i.pid); return `<li class="flex justify-between gap-3"><span>${i.qty} × ${p ? esc(p.name) : i.pid}</span><span class="font-semibold">${money(i.qty * i.price)}</span></li>` }).join('')}</ul></details>
        <div class="flex gap-2 mt-4 pt-4 border-t border-line"><button class="btn btn-ghost flex-1 !min-h-[46px]" data-repeat="${o.id}">${icon('RotateCcw', 'w-5 h-5')} Repetir</button></div>
    </div>` }).join('') || '<p class="text-navy/55 text-lg">Todavía no tiene pedidos.</p>'}</div>`
    // ya los vio
    let touched = false
    list.forEach(o => { if (o.unseenByClient) { delete o.unseenByClient; touched = true } })
    if (touched) save(state)
    return html
}

function vDone() {
    const o = myOrders()[0]
    const nd = nextDelivery(state, me, new Date(o.date))
    return `<div class="max-w-md mx-auto text-center py-10 up">
        <div class="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">${icon('Check', 'w-10 h-10', { 'stroke-width': 3 })}</div>
        <h1 class="text-3xl font-extrabold mt-5">¡Pedido recibido!</h1>
        <p class="text-lg mt-2">Número de pedido <b>${o.id}</b></p>
        <div class="card p-5 mt-6 text-left space-y-3">
            <div class="flex gap-3">${icon('Truck', 'w-6 h-6 text-brand shrink-0')}<div><p class="text-navy/55 text-[15px]">Entrega estimada</p><p class="font-bold">${nd ? fmtDay(nd) : 'Le avisamos'}</p></div></div>
            <div class="flex gap-3">${icon('Receipt', 'w-6 h-6 text-brand shrink-0')}<div><p class="text-navy/55 text-[15px]">Total a pagar al recibir</p><p class="font-bold">${money(orderTotals(o, me).total)}</p></div></div>
            <div class="flex gap-3">${icon('Mail', 'w-6 h-6 text-brand shrink-0')}<div><p class="text-navy/55 text-[15px]">Confirmación enviada a</p><p class="font-bold">${esc(me.email)}</p></div></div>
        </div>
        <div class="flex flex-col gap-3 mt-6"><button data-go="orders" class="btn btn-navy text-lg">Seguir mi pedido</button><button data-go="home" class="btn btn-ghost text-lg">Volver al inicio</button></div>
    </div>`
}

// ---------------- carrito ----------------
function setQty(pid, q) {
    const p = product(pid)
    if (q > 0 && q < p.min) q = p.min
    if (q > p.stock) { q = p.stock; toast(`Solo quedan ${p.stock} disponibles.`, { kind: 'warn' }) }
    if (q <= 0) delete cart[pid]; else cart[pid] = q
    persist()
    document.querySelectorAll(`[data-qty="${pid}"]`).forEach(el => el.innerHTML = qtyControl(p, el.dataset.big))
    renderCartBtn()
    $('cartBadge').classList.remove('pop'); void $('cartBadge').offsetWidth; $('cartBadge').classList.add('pop')
    if (!$('cart').hidden) drawCart()
}
function drawCart() {
    const lines = Object.entries(cart)
    const area = areaOf(state, me), sub = cartSubtotal(), ivu = me.exempt ? 0 : sub * IVU, short = sub < area.min
    const nd = nextDelivery(state, me)
    $('cartBody').innerHTML = lines.length ? `
        <div class="card p-4 mb-3">
            <div class="flex justify-between text-[15px] mb-2"><span class="${short ? '' : 'text-emerald-700 font-semibold'}">${short ? `Le faltan <b>${money(area.min - sub)}</b> para el mínimo` : '✓ Pedido mínimo alcanzado'}</span><span class="text-navy/50">${money(area.min)}</span></div>
            <div class="h-2.5 rounded-full bg-paper overflow-hidden"><div class="h-full rounded-full transition-all ${short ? 'bg-brand' : 'bg-emerald-500'}" style="width:${Math.min(100, sub / area.min * 100)}%"></div></div>
        </div>
        <div class="card divide-y divide-line">${lines.map(([pid, q]) => { const p = product(pid); return `<div class="p-4 flex gap-3">${productArt(p, 'w-14 h-14', 'w-6 h-6')}
            <div class="flex-1 min-w-0"><p class="font-bold leading-snug line-clamp-2">${esc(p.name)}</p><p class="text-navy/55 text-sm">${money(price(p))} · ${esc(p.unit)}</p>
            <div class="flex items-center justify-between mt-2"><div class="flex items-center gap-1.5"><button class="qty !w-10 !h-10 bg-paper" data-dec="${p.id}">${icon(q <= p.min ? 'Trash2' : 'Minus', 'w-4 h-4')}</button><span class="w-9 text-center text-lg font-extrabold">${q}</span><button class="qty !w-10 !h-10 bg-brand text-white" data-inc="${p.id}">${icon('Plus', 'w-4 h-4')}</button></div><p class="font-extrabold">${money(q * price(p))}</p></div></div></div>` }).join('')}</div>
        <label class="block mt-4"><span class="font-semibold">Nota para Siovera <span class="text-navy/45 font-normal">(opcional)</span></span><textarea id="cartNotes" rows="2" class="field !text-base mt-2" placeholder="Ej.: entregar en la mañana">${esc(draftNote)}</textarea></label>
        <div class="card p-4 mt-4 space-y-3 text-[15px]">
            <div class="flex gap-3">${icon('Truck', 'w-5 h-5 text-brand shrink-0 mt-0.5')}<div><p class="font-semibold">Entrega ${nd ? fmtDay(nd) : ''}</p><p class="text-navy/55">${esc(me.town)} · Área ${esc(me.area)}</p></div></div>
            <div class="flex gap-3">${icon('Receipt', 'w-5 h-5 text-brand shrink-0 mt-0.5')}<div><p class="font-semibold">Pago contra entrega</p><p class="text-navy/55">Efectivo o cheque al recibir</p></div></div>
        </div>` : `<div class="text-center py-20 text-navy/50">${icon('ShoppingCart', 'w-12 h-12 mx-auto mb-3 opacity-40')}<p class="text-lg font-semibold">Su pedido está vacío</p><button class="btn btn-ghost mt-5" data-go="catalog" data-close>Ver catálogo</button></div>`
    $('cartFoot').innerHTML = lines.length ? `
        <div class="space-y-1 text-[15px] mb-3"><div class="flex justify-between"><span class="text-navy/60">Subtotal</span><span>${money(sub)}</span></div><div class="flex justify-between"><span class="text-navy/60">IVU</span><span>${me.exempt ? 'Exento' : money(ivu)}</span></div><div class="flex justify-between text-xl font-extrabold pt-1"><span>Total</span><span>${money(sub + ivu)}</span></div></div>
        <button id="sendOrder" class="btn btn-brand w-full text-lg ${short ? 'opacity-40' : ''}" ${short ? 'disabled' : ''}>${short ? `Mínimo ${money(area.min)}` : 'Enviar pedido'}</button>` : ''
    const n = $('cartNotes'); if (n) n.oninput = () => { draftNote = n.value }
    const s = $('sendOrder'); if (s && !short) s.onclick = () => {
        s.disabled = true; s.innerHTML = `<svg class="w-6 h-6 spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity=".3" stroke-width="3"/><path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg> Enviando…`
        setTimeout(() => {
            state = load()
            placeOrder(state, me.id, cart, draftNote)
            draftNote = ''; cart = {}; persist()
            $('cart').hidden = true; view = 'done'; render(); window.scrollTo(0, 0)
        }, 900)
    }
}
$('cartBtn').onclick = () => { drawCart(); $('cart').hidden = false }

function repeat(id) {
    const o = state.orders.find(x => x.id === id)
    cart = {}; let skipped = 0
    o.items.forEach(i => { const p = product(i.pid); if (!p || p.stock <= 0 || p.active === false) { skipped++; return } cart[p.id] = Math.max(p.min, Math.min(i.qty, p.stock)) })
    persist(); renderCartBtn(); drawCart(); $('cart').hidden = false
    toast(skipped ? `Copiamos su pedido. ${skipped} producto(s) agotado(s) no se añadieron.` : 'Copiamos su pedido. Revise y envíe.', { kind: skipped ? 'warn' : 'ok' })
}

// ---------------- producto ----------------
function openProduct(id) {
    const p = product(id), catName = (CATEGORIES.find(c => c.id === p.cat) || {}).name
    const bought = myOrders().reduce((s, o) => s + o.items.filter(i => i.pid === id).reduce((a, i) => a + i.qty, 0), 0)
    $('pBody').innerHTML = `
        <div class="relative">${productArt(p, 'w-full h-56 !rounded-none sm:!rounded-t-3xl', 'w-24 h-24')}
            <button data-close class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center">${icon('X', 'w-5 h-5')}</button>
            <button data-fav="${p.id}" class="absolute top-4 left-4 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center ${fav(p) ? 'text-brand' : 'text-navy/40'}">${icon('Heart', 'w-5 h-5', fav(p) ? { fill: 'currentColor' } : {})}</button></div>
        <div class="p-6">
            <p class="text-sm text-navy/50 font-semibold uppercase tracking-wide">${esc(catName)}</p>
            <h2 class="text-2xl font-extrabold leading-tight mt-1 break-words">${esc(p.name)}</h2>
            <p class="text-3xl font-extrabold mt-3">${money(price(p))} <span class="text-base font-medium text-navy/50">/ ${esc(p.unit.toLowerCase())}</span></p>
            <div class="grid grid-cols-2 gap-3 mt-5 text-[15px]">
                <div class="p-3 rounded-xl bg-paper"><p class="text-navy/50 text-sm">Código</p><p class="font-semibold">${esc(p.sku)}</p></div>
                <div class="p-3 rounded-xl bg-paper"><p class="text-navy/50 text-sm">Empaque</p><p class="font-semibold">${esc(p.unit)}</p></div>
                ${p.sub ? `<div class="p-3 rounded-xl bg-paper col-span-2"><p class="text-navy/50 text-sm">Marca / compatible con</p><p class="font-semibold">${esc(p.sub)}</p></div>` : ''}
                <div class="p-3 rounded-xl bg-paper"><p class="text-navy/50 text-sm">Disponibles</p><p class="font-semibold ${p.stock <= p.low ? 'text-amber-700' : 'text-emerald-700'}">${p.stock}</p></div>
                <div class="p-3 rounded-xl bg-paper"><p class="text-navy/50 text-sm">Usted ha pedido</p><p class="font-semibold">${bought || 'Nunca'}</p></div>
            </div>
            <div class="mt-6" data-qty="${p.id}" data-big="1">${qtyControl(p, true)}</div>
        </div>`
    $('pmodal').hidden = false
}

// ---------------- eventos ----------------
document.addEventListener('click', e => {
    const el = s => e.target.closest(s)
    let t
    if ((t = el('[data-add]'))) { const p = product(t.dataset.add); setQty(p.id, p.min); return }
    if ((t = el('[data-inc]'))) { setQty(t.dataset.inc, (cart[t.dataset.inc] || 0) + 1); return }
    if ((t = el('[data-dec]'))) { const p = product(t.dataset.dec); const n = (cart[p.id] || 0) - 1; setQty(p.id, n < p.min ? 0 : n); return }
    if ((t = el('[data-fav]'))) {
        const f = state.favorites[me.id] = state.favorites[me.id] || []
        const i = f.indexOf(t.dataset.fav); if (i >= 0) f.splice(i, 1); else { f.push(t.dataset.fav); toast('Guardado en Favoritos', { kind: 'ok', ms: 1800 }) }
        save(state)
        const on = f.includes(t.dataset.fav)
        document.querySelectorAll(`[data-fav="${t.dataset.fav}"]`).forEach(b => { b.classList.toggle('text-brand', on); b.classList.toggle('text-navy/25', !on); b.innerHTML = icon('Heart', 'w-5 h-5', on ? { fill: 'currentColor' } : {}) })
        return
    }
    if ((t = el('[data-repeat]'))) { repeat(t.dataset.repeat); return }
    if ((t = el('[data-open]'))) { openProduct(t.dataset.open); return }
    if ((t = el('[data-cat]'))) { cat = t.dataset.cat; query = ''; $('searchTop').value = ''; shown = 24; view = 'catalog'; render(); window.scrollTo(0, 0); return }
    if ((t = el('[data-go]'))) { view = t.dataset.go; $('cart').hidden = true; $('acctMenu').hidden = true; render(); window.scrollTo(0, 0) }
    if ((t = el('[data-close]'))) { $('cart').hidden = true; $('pmodal').hidden = true }
    if (!el('#acctMenu') && !el('#acctBtn')) $('acctMenu').hidden = true
})
document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('cart').hidden = true; $('pmodal').hidden = true } })
$('acctBtn').onclick = () => {
    $('acctMenu').innerHTML = `<div class="p-3"><p class="font-bold">${esc(me.name)}</p><p class="text-sm text-navy/55">Cliente #${me.id} · ${esc(me.town)}</p><p class="text-sm text-navy/55">Lista de precio: ${PRICE_LISTS[me.list]}${me.exempt ? ' · Exento de IVU' : ''}</p></div>
        <div class="border-t border-line my-1"></div>
        <a href="tel:787-555-0123" class="flex items-center gap-3 p-3 rounded-xl hover:bg-paper">${icon('Phone', 'w-5 h-5 text-navy/60')}<span><span class="block font-semibold">Llamar a su vendedor</span><span class="text-sm text-navy/55">${esc(me.rep)}</span></span></a>
        <button data-go="orders" class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-paper font-semibold">${icon('History', 'w-5 h-5 text-navy/60')} Mis pedidos</button>
        <button id="logoutBtn" class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-paper font-semibold text-red-700">${icon('LogOut', 'w-5 h-5')} Salir</button>`
    $('acctMenu').hidden = !$('acctMenu').hidden
    $('logoutBtn').onclick = logout
}

// cambios desde el panel (otra pestaña)
function refresh(msg) {
    state = load()
    if (!me) return
    me = state.clients.find(c => c.id === me.id) || me
    if (msg && msg.type === 'status') {
        const o = state.orders.find(x => x.id === msg.id)
        if (o && o.clientId === me.id) {
            chime()
            const txt = { 'Preparando': 'Estamos preparando su pedido', 'En ruta': 'Su pedido va de camino', 'Entregada': 'Su pedido fue entregado' }[o.status]
            toast(txt || o.status, { kind: 'order', title: `Pedido ${o.id}`, ms: 6000 })
        }
    }
    if ($('cart').hidden && $('pmodal').hidden) render(); else renderCartBtn()
}
subscribe(refresh)
window.addEventListener('storage', e => { if (e.key && e.key.startsWith('siovera-demo')) refresh() })

restore()
render()
