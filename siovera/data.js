// Siovera Distributor — datos del demo y "base de datos" local.
// Todo vive en el navegador (localStorage) y se sincroniza entre pestañas
// abiertas con BroadcastChannel, para que un pedido hecho en el portal
// aparezca al instante en el panel.

import { CATEGORIES, PRODUCTS } from './catalogo.js'
export { CATEGORIES }

const KEY = 'siovera-demo-v4'
export const IVU = 0.115
export const STATUSES = ['Recibida', 'Preparando', 'En ruta', 'Entregada']
export const PRICE_LISTS = { A: 'Colmados', B: 'Supermercados', C: 'Ferreterías' }

export const STAFF = [
    { email: 'jennifer@sioveradistributor.com', pass: 'siovera2026', name: 'Jennifer Rivera', role: 'Administradora' },
    { email: 'ventas@sioveradistributor.com', pass: 'siovera2026', name: 'Carlos Méndez', role: 'Vendedor' },
]

const AREAS = {
    'Metro': { min: 150, days: [1, 4] },
    'Bayamón': { min: 150, days: [2, 5] },
    'Caguas': { min: 200, days: [3] },
    'Arecibo': { min: 250, days: [4] },
    'Ponce': { min: 300, days: [5] },
}
const DAY = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const dayNames = days => days.map(d => DAY[d]).join(' y ')

const CLIENTS = [
    ['1001', 'Colmado Doña Carmen', 'Carmen Ortiz', 'Bayamón', 'Bayamón', 'A', true],
    ['1002', 'Supermercado La Placita', 'Luis Rivera', 'San Juan', 'Metro', 'B', true],
    ['1003', 'Ferretería El Tornillo', 'José Santiago', 'Caguas', 'Caguas', 'C', false],
    ['1004', 'Colmado Los Hermanos', 'Ana Cruz', 'Arecibo', 'Arecibo', 'A', true],
    ['1005', 'Mini Market Santa Rosa', 'Pedro Vélez', 'Bayamón', 'Bayamón', 'B', true],
    ['1006', 'Ferretería Hnos. Colón', 'Rafael Colón', 'Guaynabo', 'Metro', 'C', false],
    ['1007', 'Colmado El Coquí', 'Marisol Díaz', 'Toa Baja', 'Bayamón', 'A', true],
    ['1008', 'Agro Centro Cayey', 'Héctor Morales', 'Cayey', 'Caguas', 'C', false],
    ['1009', 'Supermercado Familiar', 'Gloria Pagán', 'Carolina', 'Metro', 'B', true],
    ['1010', 'Ferre-Express Hatillo', 'Wilfredo Rosa', 'Hatillo', 'Arecibo', 'C', false],
    ['1011', 'Colmado Mi Barrio', 'Norma Torres', 'Ponce', 'Ponce', 'A', true],
    ['1012', 'Ferretería La Económica', 'Iván Rodríguez', 'Juana Díaz', 'Ponce', 'C', false],
    ['1013', 'Auto Parts Boricua', 'Javier Feliciano', 'Caguas', 'Caguas', 'C', false],
    ['1014', 'Colmado La Esquina', 'Lydia Maldonado', 'Cataño', 'Bayamón', 'A', true],
    ['1015', 'Garden & Más', 'Brenda Ayala', 'Dorado', 'Bayamón', 'C', false],
].map(([id, name, contact, town, area, list, exempt], i) => ({
    id, pin: '1234', name, contact, town, area, list, exempt,
    phone: `787-${String(300 + i * 37).slice(-3)}-${String(1000 + i * 613).slice(-4)}`,
    email: contact.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@' + name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '').slice(0, 22) + '.com',
    rep: i % 3 === 2 ? 'Carlos Méndez' : 'Jennifer Rivera',
    since: 2016 + (i % 8),
    active: true,
}))

// PRNG con semilla fija: el historial sale igual en cada navegador
function rng(seed) {
    let s = seed >>> 0
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

// Productos "de la casa" por tipo de cliente, para que el historial tenga sentido
const AFFINITY = {
    A: ['tornilleria', 'electrico', 'plomeria', 'auto', 'pintura', 'misc', 'herramientas'],
    B: ['pintura', 'electrico', 'auto', 'lonas', 'misc', 'herramientas', 'plomeria'],
    C: ['herramientas', 'presion', 'jardineria', 'trimmer', 'tornilleria', 'plomeria', 'soldadura', 'pintura', 'electrico'],
}

function seedOrders(products, clients) {
    const r = rng(20261107)
    const pick = a => a[Math.floor(r() * a.length)]
    const inStock = products.filter(p => p.stock > 0 && p.name.length >= 14)
    const favs = {}
    clients.forEach(c => {
        const pool = inStock.filter(p => AFFINITY[c.list].includes(p.cat))
        favs[c.id] = Array.from({ length: 12 }, () => pick(pool))
    })
    const orders = []
    let n = 1001
    const now = new Date()
    for (let d = 34; d >= 0; d--) {
        const day = new Date(now); day.setDate(now.getDate() - d)
        const dow = day.getDay()
        if (dow === 0) continue
        let count = dow === 6 ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 4)
        if (d === 0) count = Math.min(count, now.getHours() < 9 ? 2 : 4)
        for (let k = 0; k < count; k++) {
            const c = pick(clients)
            const hour = 7 + Math.floor(r() * 9), min = Math.floor(r() * 60)
            const at = new Date(day); at.setHours(hour, min, 0, 0)
            if (at > now) at.setTime(now.getTime() - (k + 1) * 23 * 60000)
            const lines = 3 + Math.floor(r() * 6)
            const seen = new Set(), items = []
            for (let j = 0; j < lines; j++) {
                const p = r() < 0.75 ? pick(favs[c.id]) : pick(inStock)
                if (seen.has(p.id)) continue
                seen.add(p.id)
                items.push({ pid: p.id, qty: 1 + Math.floor(r() * (p.prices.A < 15 ? 10 : 4)), price: p.prices[c.list] })
            }
            const age = (now - at) / 3600000
            let status = 'Entregada'
            if (age < 3) status = 'Recibida'
            else if (age < 8) status = 'Preparando'
            else if (age < 30) status = 'En ruta'
            const history = [{ status: 'Recibida', at: at.toISOString(), by: 'Portal' }]
            const step = (s, h) => { const t = new Date(at.getTime() + h * 3600000); if (t < now) history.push({ status: s, at: t.toISOString(), by: s === 'Entregada' ? 'Chofer' : pick(['Jennifer Rivera', 'Carlos Méndez']) }) }
            const idx = STATUSES.indexOf(status)
            if (idx >= 1) step('Preparando', 1.5 + r())
            if (idx >= 2) step('En ruta', 6 + r() * 2)
            if (idx >= 3) step('Entregada', 20 + r() * 6)
            orders.push({ id: '', clientId: c.id, date: at.toISOString(), status, history, items, notes: r() < 0.15 ? pick(['Entregar antes de las 2 pm', 'Llamar al llegar', 'Dejar en el almacén de atrás', 'Factura a nombre del negocio']) : '' })
        }
    }
    orders.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(o => o.id = 'SD-' + n++)
    return orders.reverse()
}

function seed() {
    const products = PRODUCTS.map(p => ({ ...p, prices: { ...p.prices }, low: 5, active: true }))
    const clients = CLIENTS.map(c => ({ ...c }))
    const orders = seedOrders(products, clients)
    const last = orders.reduce((m, o) => Math.max(m, +o.id.slice(3)), 1000)
    const favorites = {}
    clients.forEach(c => {
        const counts = {}
        orders.filter(o => o.clientId === c.id).forEach(o => o.items.forEach(i => counts[i.pid] = (counts[i.pid] || 0) + i.qty))
        favorites[c.id] = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([pid]) => pid)
    })
    return {
        v: 3,
        products, clients, orders, favorites,
        areas: JSON.parse(JSON.stringify(AREAS)),
        nextOrder: last + 1,
        lastImport: null,
        seededAt: new Date().toISOString(),
    }
}

// ---------- almacenamiento ----------
let memory = null
export function load() {
    try {
        const raw = localStorage.getItem(KEY)
        if (raw) return JSON.parse(raw)
    } catch (e) { if (memory) return memory }
    const s = seed()
    save(s, true)
    return s
}
const chan = (() => { try { return new BroadcastChannel('siovera-demo') } catch (e) { return null } })()
export function save(state, quiet) {
    memory = state
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) { /* ignore */ }
}
export function emit(type, payload = {}) {
    try { chan && chan.postMessage({ type, ...payload }) } catch (e) { /* ignore */ }
}
export function subscribe(fn) {
    if (chan) chan.onmessage = e => fn(e.data)
}
export function reset() {
    try { localStorage.removeItem(KEY) } catch (e) { /* ignore */ }
    memory = null
    const s = load()
    emit('reset')
    return s
}

// ---------- reglas de negocio ----------
export const areaOf = (state, client) => state.areas[client.area] || { min: 0, days: [1, 2, 3, 4, 5] }
export function nextDelivery(state, client, from = new Date()) {
    const days = areaOf(state, client).days
    for (let i = 1; i <= 14; i++) {
        const d = new Date(from); d.setDate(from.getDate() + i)
        if (days.includes(d.getDay())) return d
    }
    return null
}
export function orderTotals(order, client) {
    const subtotal = order.items.reduce((s, i) => s + i.qty * i.price, 0)
    const ivu = client && client.exempt ? 0 : subtotal * IVU
    return { subtotal, ivu, total: subtotal + ivu, units: order.items.reduce((s, i) => s + i.qty, 0) }
}

export function placeOrder(state, clientId, cart, notes, by = 'Portal') {
    const client = state.clients.find(c => c.id === clientId)
    const items = Object.entries(cart).filter(([, q]) => q > 0).map(([pid, qty]) => {
        const p = state.products.find(x => x.id === pid)
        p.stock = Math.max(0, p.stock - qty)
        return { pid, qty, price: p.prices[client.list] }
    })
    const now = new Date().toISOString()
    const order = { id: 'SD-' + state.nextOrder++, clientId, date: now, status: 'Recibida', notes: notes || '', items, isNew: true, history: [{ status: 'Recibida', at: now, by }] }
    state.orders.unshift(order)
    save(state)
    emit('order', { id: order.id })
    return order
}

export function setStatus(state, orderId, status, by) {
    const o = state.orders.find(x => x.id === orderId)
    if (!o || o.status === status) return o
    o.status = status
    delete o.isNew
    o.history = o.history || []
    o.history.push({ status, at: new Date().toISOString(), by })
    o.unseenByClient = true
    save(state)
    emit('status', { id: o.id, status })
    return o
}

// Pedido "entrante" para enseñar el panel en vivo con un solo aparato
export function simulateOrder(state) {
    const r = Math.random
    const pick = a => a[Math.floor(r() * a.length)]
    const c = pick(state.clients.filter(x => x.active))
    const pool = state.products.filter(p => p.stock > 5 && p.name.length >= 14 && AFFINITY[c.list].includes(p.cat))
    const cart = {}
    const min = areaOf(state, c).min
    let total = 0, guard = 0
    while ((total < min * 1.15 || Object.keys(cart).length < 3) && guard++ < 40) {
        const p = pick(pool)
        const q = 1 + Math.floor(r() * 4)
        cart[p.id] = (cart[p.id] || 0) + q
        total += q * p.prices[c.list]
    }
    return placeOrder(state, c.id, cart, r() < 0.3 ? pick(['Llamar al llegar', 'Entregar en la mañana', 'Pago en cheque']) : '')
}

// ---------- importación desde Retail Manager ----------
export const SAMPLE_IMPORT = `sku,descripcion,existencia,precio_a,precio_b,precio_c
TJ2512,1/4 X 50 PRESSURE WASHER HOSE 3600PSI,40,39.99,37.99,35.99
PL0712,CODO COBRE 1/2 SOLDAR QTY 50,75,15.99,15.19,14.39
TH14114,TORNILLOS TAPCON HEX BLANCO 1/4 X 1 1/4,120,10.99,10.44,9.89
GT0402,CHIP BRUSH 1 CAJA 36,60,11.49,10.92,10.34
EP1430,PLUG TWIST 1430P,8,21.99,20.89,19.79
TM1012,TIRE REPAIR KIT,90,8.49,8.07,7.64
SV-NUEVO1,MANGUERA DE JARDIN 5/8 X 50',35,24.99,23.74,22.49`

export function parseImport(text) {
    const lines = text.trim().split(/\r?\n/).filter(Boolean)
    const head = lines.shift().split(',').map(h => h.trim().toLowerCase())
    const idx = k => head.indexOf(k)
    return lines.map(l => {
        const c = l.split(',').map(x => x.trim())
        return {
            sku: c[idx('sku')],
            name: c[idx('descripcion')] || c[idx('nombre')] || '',
            stock: Number(c[idx('existencia')] ?? c[idx('stock')]),
            A: Number(c[idx('precio_a')]), B: Number(c[idx('precio_b')]), C: Number(c[idx('precio_c')]),
        }
    }).filter(r => r.sku)
}

export function applyImport(state, rows, money) {
    const changes = []
    rows.forEach(r => {
        let p = state.products.find(x => x.sku === r.sku)
        if (!p) {
            p = { id: r.sku, sku: r.sku, name: r.name, sub: '', cat: 'misc', unit: 'Unidad', prices: { A: r.A || 0, B: r.B || 0, C: r.C || 0 }, min: 1, stock: r.stock || 0, low: 10, active: true }
            state.products.push(p)
            changes.push({ sku: r.sku, name: r.name, kind: 'Nuevo', detail: `${r.stock} en existencia` })
            return
        }
        const parts = []
        if (!isNaN(r.stock) && r.stock !== p.stock) { parts.push(`existencia ${p.stock} → ${r.stock}`); p.stock = r.stock }
        ;['A', 'B', 'C'].forEach(l => {
            if (r[l] && r[l] !== p.prices[l]) { parts.push(`precio ${l} ${money(p.prices[l])} → ${money(r[l])}`); p.prices[l] = r[l] }
        })
        if (parts.length) changes.push({ sku: r.sku, name: p.name, kind: 'Actualizado', detail: parts.join(' · ') })
    })
    state.lastImport = new Date().toISOString()
    save(state)
    emit('import')
    return changes
}
