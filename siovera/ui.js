// Helpers de interfaz compartidos (iconos, formato, avisos)
import {
    Wrench, Sprout, Car, Disc3, Droplets, ShowerHead, Zap, PaintRoller, Bolt, Scissors, Tent, Flame, Sun, KeyRound, Package,
    LayoutDashboard, ShoppingCart, Boxes, Users, Upload, Settings, Bell, Search, LogOut, ChevronRight, ChevronLeft, ChevronDown,
    Plus, Minus, X, Check, Printer, Truck, ClipboardList, PackageCheck, Clock, TrendingUp, TrendingDown, AlertTriangle,
    Heart, RotateCcw, Phone, Mail, MapPin, Eye, EyeOff, Lock, User, Store, FileSpreadsheet, Pencil, Trash2, Filter,
    Radio, Sparkles, CircleCheck, Receipt, CalendarDays, ArrowRight, Menu, Home, History, Info, Download, ShieldCheck,
} from 'lucide'

const ICONS = {
    Wrench, Sprout, Car, Disc3, Droplets, ShowerHead, Zap, PaintRoller, Bolt, Scissors, Tent, Flame, Sun, KeyRound, Package,
    LayoutDashboard, ShoppingCart, Boxes, Users, Upload, Settings, Bell, Search, LogOut, ChevronRight, ChevronLeft, ChevronDown,
    Plus, Minus, X, Check, Printer, Truck, ClipboardList, PackageCheck, Clock, TrendingUp, TrendingDown, AlertTriangle,
    Heart, RotateCcw, Phone, Mail, MapPin, Eye, EyeOff, Lock, User, Store, FileSpreadsheet, Pencil, Trash2, Filter,
    Radio, Sparkles, CircleCheck, Receipt, CalendarDays, ArrowRight, Menu, Home, History, Info, Download, ShieldCheck,
}

export function icon(name, cls = 'w-5 h-5', extra = {}) {
    const node = ICONS[name]
    if (!node) return ''
    const [, attrs, children] = node
    const a = { ...attrs, ...extra }
    delete a.width; delete a.height
    const at = Object.entries(a).map(([k, v]) => `${k}="${v}"`).join(' ')
    const kids = children.map(([t, ca]) => `<${t} ${Object.entries(ca).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')
    return `<svg ${at} class="${cls}" aria-hidden="true">${kids}</svg>`
}

// Estilo visual por categoría: icono + colores del recuadro
export const CAT_STYLE = {
    herramientas: { icon: 'Wrench', bg: '#E8EEF7', fg: '#1F3557' },
    jardineria: { icon: 'Sprout', bg: '#E5F3E8', fg: '#1E6B3A' },
    auto: { icon: 'Car', bg: '#F1EAF7', fg: '#5B3A85' },
    forros: { icon: 'Disc3', bg: '#EFEFEF', fg: '#333' },
    presion: { icon: 'Droplets', bg: '#E2F1FA', fg: '#0F5C8C' },
    plomeria: { icon: 'ShowerHead', bg: '#E4F0F6', fg: '#225E7A' },
    electrico: { icon: 'Zap', bg: '#FFF4D6', fg: '#8A5A00' },
    pintura: { icon: 'PaintRoller', bg: '#FCE8E4', fg: '#A33A22' },
    tornilleria: { icon: 'Bolt', bg: '#ECEAE4', fg: '#4A4636' },
    trimmer: { icon: 'Scissors', bg: '#E9F5E1', fg: '#3F6B1F' },
    lonas: { icon: 'Tent', bg: '#E3EBFB', fg: '#2447A3' },
    soldadura: { icon: 'Flame', bg: '#FDEBDD', fg: '#B3500F' },
    parasoles: { icon: 'Sun', bg: '#FFF1DC', fg: '#9A5B00' },
    llaves: { icon: 'KeyRound', bg: '#F6EEDC', fg: '#7A5A12' },
    misc: { icon: 'Package', bg: '#EEEBE5', fg: '#5A5246' },
}

export function productArt(p, size = 'w-20 h-20', iconSize = 'w-9 h-9') {
    const s = CAT_STYLE[p.cat] || CAT_STYLE.misc
    return `<div class="${size} rounded-2xl flex items-center justify-center shrink-0 relative overflow-hidden" style="background:${s.bg};color:${s.fg}">
        <div class="absolute inset-0 opacity-[.07]" style="background-image:radial-gradient(currentColor 1px,transparent 1px);background-size:8px 8px"></div>
        ${icon(s.icon, iconSize + ' relative', { 'stroke-width': 1.6 })}
    </div>`
}

export function money(n) {
    return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
export function money0(n) {
    return '$' + Math.round(n || 0).toLocaleString('en-US')
}
export function fmtDate(iso, opts) {
    return new Date(iso).toLocaleString('es-PR', opts || { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}
export function fmtDay(iso) {
    const s = new Date(iso).toLocaleDateString('es-PR', { weekday: 'long', day: 'numeric', month: 'long' })
    return s.charAt(0).toUpperCase() + s.slice(1)
}
export function ago(iso) {
    const s = (Date.now() - new Date(iso)) / 1000
    if (s < 60) return 'hace un momento'
    if (s < 3600) return `hace ${Math.floor(s / 60)} min`
    if (s < 86400) return `hace ${Math.floor(s / 3600)} h`
    const d = Math.floor(s / 86400)
    return d === 1 ? 'ayer' : `hace ${d} días`
}
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export const initials = n => n.split(/\s+/).filter(w => /^[A-ZÁÉÍÓÚÑ]/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase()

let toastWrap
export function toast(msg, { kind = 'info', title = '', ms = 3500 } = {}) {
    if (!toastWrap) {
        toastWrap = document.createElement('div')
        toastWrap.className = 'fixed z-[80] top-4 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none'
        document.body.appendChild(toastWrap)
    }
    const colors = { info: 'bg-[#14233C] text-white', ok: 'bg-emerald-700 text-white', warn: 'bg-amber-500 text-[#14233C]', order: 'bg-white text-[#14233C] border-l-4 border-[#E8731C]' }
    const ic = { info: 'Info', ok: 'CircleCheck', warn: 'AlertTriangle', order: 'Bell' }[kind]
    const el = document.createElement('div')
    el.className = `pointer-events-auto shadow-xl rounded-xl px-4 py-3 flex gap-3 items-start ${colors[kind]} translate-x-4 opacity-0 transition-all duration-300`
    el.innerHTML = `${icon(ic, 'w-5 h-5 mt-0.5 shrink-0' + (kind === 'order' ? ' text-[#E8731C]' : ''))}<div class="min-w-0">${title ? `<p class="font-bold">${title}</p>` : ''}<p class="${title ? 'text-sm opacity-80' : 'font-semibold'}">${msg}</p></div>`
    toastWrap.appendChild(el)
    requestAnimationFrame(() => { el.classList.remove('translate-x-4', 'opacity-0') })
    setTimeout(() => { el.classList.add('opacity-0'); setTimeout(() => el.remove(), 300) }, ms)
}

// Sonido corto de aviso (sin archivos)
export function chime() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        ;[880, 1320].forEach((f, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain()
            o.type = 'sine'; o.frequency.value = f
            g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12)
            g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i * 0.12 + 0.02)
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.35)
            o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.12); o.stop(ctx.currentTime + i * 0.12 + 0.4)
        })
    } catch (e) { /* sin audio */ }
}

export const STATUS_STYLE = {
    'Recibida': { cls: 'bg-sky-100 text-sky-900', dot: '#0284C7', icon: 'ClipboardList' },
    'Preparando': { cls: 'bg-amber-100 text-amber-900', dot: '#D97706', icon: 'Package' },
    'En ruta': { cls: 'bg-violet-100 text-violet-900', dot: '#7C3AED', icon: 'Truck' },
    'Entregada': { cls: 'bg-emerald-100 text-emerald-900', dot: '#059669', icon: 'PackageCheck' },
}
