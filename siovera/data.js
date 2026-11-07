// Siovera Distributor — demo data + store (localStorage, sin backend)
// Los datos viven en el navegador de quien prueba el demo.

const KEY = 'siovera-demo-v1'

export const CATEGORIES = [
    { id: 'ferreteria', name: 'Ferretería', icon: '🔩' },
    { id: 'electrico', name: 'Eléctrico', icon: '💡' },
    { id: 'plomeria', name: 'Plomería', icon: '🚰' },
    { id: 'limpieza', name: 'Limpieza', icon: '🧽' },
    { id: 'desechables', name: 'Desechables', icon: '🥤' },
    { id: 'construccion', name: 'Construcción', icon: '🧱' },
]

// prices: lista A (colmados), B (supermercados), C (ferreterías)
const P = (id, sku, name, cat, unit, emoji, a, b, c, min, stock, low) =>
    ({ id, sku, name, cat, unit, emoji, prices: { A: a, B: b, C: c }, min, stock, low })

const PRODUCTS = [
    P('p01', 'FER-1001', 'Clavos galvanizados 2"', 'ferreteria', 'Caja 5 lb', '🔨', 9.75, 9.25, 8.9, 2, 64, 15),
    P('p02', 'FER-1002', 'Tornillos para madera #8 x 1¼"', 'ferreteria', 'Caja 100 u', '🔩', 6.5, 6.1, 5.8, 2, 120, 20),
    P('p03', 'FER-1003', 'Candado de bronce 40 mm', 'ferreteria', 'Display 6 u', '🔒', 38.0, 36.0, 34.5, 1, 18, 6),
    P('p04', 'FER-1004', 'Cinta adhesiva gris (duct tape)', 'ferreteria', 'Caja 12 rollos', '🩶', 31.2, 29.4, 28.0, 1, 9, 10),
    P('p05', 'FER-1005', 'Silicón transparente 10 oz', 'ferreteria', 'Caja 12 u', '🧴', 42.0, 39.6, 37.8, 1, 26, 8),
    P('p06', 'FER-1006', 'Pintura en spray negro mate', 'ferreteria', 'Caja 6 u', '🎨', 27.0, 25.5, 24.0, 1, 40, 10),
    P('p07', 'ELE-2001', 'Bombilla LED 9W luz blanca', 'electrico', 'Paquete 12 u', '💡', 24.0, 22.2, 21.0, 2, 150, 30),
    P('p08', 'ELE-2002', 'Extensión eléctrica 6 pies', 'electrico', 'Caja 10 u', '🔌', 35.0, 33.0, 31.5, 1, 22, 8),
    P('p09', 'ELE-2003', 'Baterías AA alcalinas', 'electrico', 'Display 24 pqts', '🔋', 46.0, 43.5, 41.0, 1, 7, 8),
    P('p10', 'ELE-2004', 'Linterna LED de mano', 'electrico', 'Caja 12 u', '🔦', 54.0, 51.0, 48.0, 1, 30, 6),
    P('p11', 'PLO-3001', 'Pega PVC 4 oz', 'plomeria', 'Caja 24 u', '🧪', 58.0, 55.0, 52.0, 1, 19, 6),
    P('p12', 'PLO-3002', 'Cinta teflón ½"', 'plomeria', 'Caja 50 rollos', '🧻', 22.5, 21.0, 19.9, 1, 45, 10),
    P('p13', 'PLO-3003', 'Tubo PVC ½" x 10 pies', 'plomeria', 'Bulto 10 u', '🟦', 39.0, 37.0, 35.0, 1, 33, 8),
    P('p14', 'PLO-3004', 'Llave de paso ½"', 'plomeria', 'Caja 10 u', '🚰', 62.0, 59.0, 56.0, 1, 4, 5),
    P('p15', 'LIM-4001', 'Cloro regular 1 galón', 'limpieza', 'Caja 6 galones', '🧴', 15.9, 14.8, 15.5, 3, 210, 40),
    P('p16', 'LIM-4002', 'Mapo de algodón #24', 'limpieza', 'Docena', '🧹', 42.0, 39.0, 40.5, 1, 28, 8),
    P('p17', 'LIM-4003', 'Escoba de cerdas suaves', 'limpieza', 'Docena', '🧹', 48.0, 45.0, 46.5, 1, 24, 8),
    P('p18', 'LIM-4004', 'Bolsas de basura 30 gal', 'limpieza', 'Caja 100 u', '🗑️', 21.0, 19.5, 20.5, 2, 85, 20),
    P('p19', 'LIM-4005', 'Guantes de goma medianos', 'limpieza', 'Caja 12 pares', '🧤', 18.0, 16.8, 17.4, 1, 12, 10),
    P('p20', 'LIM-4006', 'Detergente de fregar 28 oz', 'limpieza', 'Caja 12 u', '🫧', 26.4, 24.6, 25.8, 2, 96, 20),
    P('p21', 'DES-5001', 'Vasos foam 8 oz', 'desechables', 'Caja 1,000 u', '🥤', 29.0, 27.0, 28.0, 1, 58, 12),
    P('p22', 'DES-5002', 'Platos foam 9" de 3 divisiones', 'desechables', 'Caja 500 u', '🍽️', 34.0, 31.5, 33.0, 1, 41, 10),
    P('p23', 'DES-5003', 'Servilletas blancas', 'desechables', 'Caja 6,000 u', '🧻', 31.0, 29.0, 30.0, 1, 3, 8),
    P('p24', 'DES-5004', 'Papel de aluminio 12" x 500\'', 'desechables', 'Rollo', '🌯', 36.5, 34.0, 35.5, 1, 27, 6),
    P('p25', 'DES-5005', 'Envases foam con tapa 9x9', 'desechables', 'Caja 200 u', '📦', 33.0, 30.8, 32.0, 1, 62, 12),
    P('p26', 'CON-6001', 'Cemento gris 94 lb', 'construccion', 'Saco', '🧱', 16.75, 16.25, 15.9, 5, 300, 50),
    P('p27', 'CON-6002', 'Varilla #4 x 20 pies', 'construccion', 'Unidad', '➖', 9.1, 8.8, 8.5, 10, 420, 80),
    P('p28', 'CON-6003', 'Bloques de hormigón 8"', 'construccion', 'Paleta 90 u', '🧱', 178.0, 170.0, 165.0, 1, 14, 4),
    P('p29', 'CON-6004', 'Sellador de techo 5 galones', 'construccion', 'Cubeta', '🪣', 89.0, 85.0, 82.0, 1, 21, 6),
    P('p30', 'CON-6005', 'Brocha de 3"', 'construccion', 'Docena', '🖌️', 30.0, 28.2, 27.0, 1, 37, 8),
]

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
        mk(1048, '1002', 0, 9, 'Recibida', [['p15', 10], ['p18', 6], ['p21', 4], ['p23', 3]], 'Entregar antes de las 2 pm'),
        mk(1047, '1001', 0, 8, 'Preparando', [['p15', 6], ['p20', 4], ['p07', 2], ['p25', 2]]),
        mk(1046, '1003', 1, 15, 'En ruta', [['p26', 20], ['p27', 30], ['p11', 2], ['p01', 4]]),
        mk(1045, '1005', 2, 11, 'Entregada', [['p15', 4], ['p16', 2], ['p17', 2], ['p19', 3]]),
        mk(1044, '1004', 3, 10, 'Entregada', [['p21', 3], ['p22', 3], ['p24', 2], ['p15', 6]]),
        mk(1043, '1001', 7, 9, 'Entregada', [['p15', 6], ['p20', 4], ['p07', 2], ['p25', 2]]),
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
ELE-2003,Baterias AA alcalinas,48,46.00,43.50,41.00
PLO-3004,Llave de paso 1/2,30,62.00,59.00,56.00
DES-5003,Servilletas blancas,40,31.00,29.00,30.00
FER-1004,Cinta adhesiva gris,36,31.20,29.40,28.00
LIM-4001,Cloro regular 1 galon,260,16.25,15.10,15.80
LIM-4005,Guantes de goma medianos,50,18.00,16.80,17.40
CON-6006,Mezcla para empañetar 80 lb,120,12.50,12.00,11.75`

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
            p = { id: 'p' + (state.products.length + 1) + '-' + r.sku, sku: r.sku, name: r.name, cat: 'construccion', unit: 'Unidad', emoji: '📦', prices: { A: r.A || 0, B: r.B || 0, C: r.C || 0 }, min: 1, stock: r.stock || 0, low: 10 }
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
