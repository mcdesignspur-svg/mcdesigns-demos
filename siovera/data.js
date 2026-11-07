// Siovera Distributor — demo data + store (localStorage, sin backend)
// Los datos viven en el navegador de quien prueba el demo.

const KEY = 'siovera-demo-v2'

import { CATEGORIES, PRODUCTS } from './catalogo.js'
export { CATEGORIES }

export const AREAS = {
    'Metro': 150,
    'Bayamón': 150,
    'Caguas': 200,
    'Arecibo': 250,
}

export const PRICE_LISTS = { A: 'Colmados', B: 'Supermercados', C: 'Ferreterías' }

export const STATUSES = ['Recibida', 'Preparando', 'En ruta', 'Entregada']

const CLIENTS = [
    { id: '1001', pin: '1234', name: 'Colmado Doña Carmen', contact: 'Carmen Ortiz', area: 'Bayamón', list: 'A', exempt: true },
    { id: '1002', pin: '1234', name: 'Supermercado La Placita', contact: 'Luis Rivera', area: 'Metro', list: 'B', exempt: true },
    { id: '1003', pin: '1234', name: 'Ferretería El Tornillo', contact: 'José Santiago', area: 'Caguas', list: 'C', exempt: false },
    { id: '1004', pin: '1234', name: 'Colmado Los Hermanos', contact: 'Ana Cruz', area: 'Arecibo', list: 'A', exempt: true },
    { id: '1005', pin: '1234', name: 'Mini Market Santa Rosa', contact: 'Pedro Vélez', area: 'Bayamón', list: 'B', exempt: true },
]

export const IVU = 0.115

function daysAgo(d, h = 10) {
    const t = new Date()
    t.setDate(t.getDate() - d)
    t.setHours(h, 15, 0, 0)
    return t.toISOString()
}

function seedOrders() {
    const mk = (n, clientId, d, h, status, items, notes = '') => ({
        id: 'SD-' + n, clientId, date: daysAgo(d, h), status, notes,
        items: items.map(([pid, qty]) => {
            const p = PRODUCTS.find(x => x.id === pid)
            const c = CLIENTS.find(x => x.id === clientId)
            return { pid, qty, price: p.prices[c.list] }
        }),
    })
    return [
        mk(1048, '1002', 0, 9, 'Recibida', [['TH14114', 6], ['GT0402', 2], ['EP1430', 4], ['TM1012', 5]], 'Entregar antes de las 2 pm'),
        mk(1047, '1001', 0, 8, 'Preparando', [['PL0712', 3], ['TH14214', 4], ['TM0080', 2], ['AT2014', 6]]),
        mk(1046, '1003', 1, 15, 'En ruta', [['TJ2512', 2], ['STH2501', 6], ['41140', 3], ['57392', 2]]),
        mk(1045, '1005', 2, 11, 'Entregada', [['GT0419', 2], ['TF0050', 3], ['PL1001', 2], ['MP5202', 4]]),
        mk(1044, '1004', 3, 10, 'Entregada', [['TH14314', 5], ['GT0440', 2], ['AT2010', 3]]),
        mk(1043, '1001', 7, 9, 'Entregada', [['PL0712', 3], ['TH14214', 4], ['TM0080', 2], ['AT2014', 6]]),
    ]
}

function seed() {
    return {
        products: PRODUCTS.map(p => ({ ...p, prices: { ...p.prices } })),
        clients: CLIENTS.map(c => ({ ...c })),
        orders: seedOrders(),
        nextOrder: 1049,
        lastImport: null,
    }
}

export function load() {
    try {
        const raw = localStorage.getItem(KEY)
        if (raw) return JSON.parse(raw)
    } catch (e) { /* sin storage: datos en memoria */ }
    const s = seed()
    save(s)
    return s
}

export function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) { /* ignore */ }
}

export function reset() {
    try { localStorage.removeItem(KEY) } catch (e) { /* ignore */ }
    return load()
}

export function money(n) {
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function orderTotals(order, client) {
    const subtotal = order.items.reduce((s, i) => s + i.qty * i.price, 0)
    const ivu = client && client.exempt ? 0 : subtotal * IVU
    return { subtotal, ivu, total: subtotal + ivu }
}

export function fmtDate(iso) {
    return new Date(iso).toLocaleString('es-PR', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

// Pedido nuevo: descuenta inventario y devuelve la orden
export function placeOrder(state, clientId, cart, notes) {
    const client = state.clients.find(c => c.id === clientId)
    const items = Object.entries(cart).filter(([, q]) => q > 0).map(([pid, qty]) => {
        const p = state.products.find(x => x.id === pid)
        p.stock = Math.max(0, p.stock - qty)
        return { pid, qty, price: p.prices[client.list] }
    })
    const order = { id: 'SD-' + state.nextOrder++, clientId, date: new Date().toISOString(), status: 'Recibida', notes: notes || '', items, isNew: true }
    state.orders.unshift(order)
    save(state)
    return order
}

// Archivo de ejemplo "exportado de Retail Manager"
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

export function applyImport(state, rows) {
    const changes = []
    rows.forEach(r => {
        let p = state.products.find(x => x.sku === r.sku)
        if (!p) {
            p = { id: r.sku, sku: r.sku, name: r.name, sub: '', cat: 'misc', unit: 'Unidad', emoji: '📦', prices: { A: r.A || 0, B: r.B || 0, C: r.C || 0 }, min: 1, stock: r.stock || 0, low: 10 }
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
    return changes
}
