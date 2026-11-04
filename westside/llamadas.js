import { TelnyxRTC } from '@telnyx/webrtc';

// Demo de llamadas WebRTC para vendedores de WestSide (Telnyx).
// El servidor (/api/westside-llamadas-token) entrega un JWT por vendedor; aquí
// solo se usa ese token. La API key y las contraseñas SIP nunca llegan al navegador.

const $ = (id) => document.getElementById(id);
const els = {
  login: $('login'), loginForm: $('loginForm'), loginBtn: $('loginBtn'), loginError: $('loginError'),
  vendedor: $('vendedor'), pin: $('pin'),
  dialer: $('dialer'), dot: $('dot'), statusText: $('statusText'), callerId: $('callerId'), who: $('who'),
  number: $('number'), callInfo: $('callInfo'), keypad: $('keypad'),
  callBtn: $('callBtn'), muteBtn: $('muteBtn'), clearBtn: $('clearBtn'), logoutBtn: $('logoutBtn'),
};

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

let client = null;
let call = null;
let callerNumber = '';
let muted = false;
let timer = null;
let startedAt = 0;

// ── Formato de números ─────────────────────────────────────────────────────
function toE164(raw) {
  const t = String(raw).trim();
  const digits = t.replace(/\D/g, '');
  if (t.startsWith('+') && digits.length >= 8) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}
function pretty(e164) {
  const d = String(e164).replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return ten.length === 10 ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : e164;
}

// ── Estado visual ──────────────────────────────────────────────────────────
function setStatus(text, kind) {
  els.statusText.textContent = text;
  els.dot.className = `dot ${kind || ''}`;
}
function inCall() { return Boolean(call); }
function refreshButtons() {
  const ready = Boolean(client) && els.dot.classList.contains('ok');
  els.callBtn.disabled = inCall() ? false : !(ready && toE164(els.number.value));
  els.callBtn.className = `round ${inCall() ? 'hang' : 'call'}`;
  els.callBtn.setAttribute('aria-label', inCall() ? 'Colgar' : 'Llamar');
  els.callBtn.style.transform = inCall() ? 'rotate(135deg)' : '';
  els.muteBtn.disabled = !inCall();
  els.muteBtn.classList.toggle('on', muted);
  els.muteBtn.textContent = muted ? 'Activar mic' : 'Silenciar';
  els.number.readOnly = inCall();
}
function startTimer() {
  startedAt = Date.now();
  clearInterval(timer);
  timer = setInterval(() => {
    const s = Math.floor((Date.now() - startedAt) / 1000);
    els.callInfo.textContent = `En llamada · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 500);
}
function stopTimer() { clearInterval(timer); timer = null; }

// ── Teclado ────────────────────────────────────────────────────────────────
const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
for (const [k, sub] of KEYS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'key';
  b.innerHTML = `${k}<small>${sub || '&nbsp;'}</small>`;
  b.addEventListener('click', () => {
    if (inCall()) { call.dtmf(k); els.callInfo.textContent = `Tono ${k}`; return; }
    els.number.value += k;
    refreshButtons();
  });
  if (k === '0') {
    let hold;
    b.addEventListener('pointerdown', () => { hold = setTimeout(() => { if (!inCall()) { els.number.value += '+'; hold = 'done'; refreshButtons(); } }, 600); });
    b.addEventListener('pointerup', () => { if (hold !== 'done') clearTimeout(hold); });
  }
  els.keypad.appendChild(b);
}
els.number.addEventListener('input', refreshButtons);
els.number.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !els.callBtn.disabled) els.callBtn.click(); });
els.clearBtn.addEventListener('click', () => { if (!inCall()) { els.number.value = els.number.value.slice(0, -1); refreshButtons(); } });

// ── Conexión con Telnyx ────────────────────────────────────────────────────
async function getToken(vendedor, pin) {
  const res = await fetch('/api/westside-llamadas-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vendedor, pin }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo entrar.');
  return data;
}

function connect(token) {
  client = new TelnyxRTC({ login_token: token });
  client.remoteElement = 'remoteMedia';
  client
    .on('telnyx.ready', () => { setStatus('Listo para llamar', 'ok'); refreshButtons(); })
    .on('telnyx.error', (err) => {
      console.error('telnyx.error', err);
      setStatus('Error de conexión con Telnyx. Sal y vuelve a entrar.', 'off');
      refreshButtons();
    })
    .on('telnyx.socket.close', () => { if (!inCall()) setStatus('Desconectado', 'off'); refreshButtons(); })
    .on('telnyx.notification', (n) => { if (n.type === 'callUpdate') onCallUpdate(n.call); });
  setStatus('Conectando…', '');
  client.connect();
}

function onCallUpdate(c) {
  // Esta demo solo hace llamadas salientes; las entrantes se rechazan.
  if (c.direction === 'inbound' && c !== call) { if (c.state === 'ringing') c.hangup(); return; }
  call = c;
  switch (c.state) {
    case 'new': case 'requesting': case 'trying':
      els.callInfo.textContent = 'Marcando…'; setStatus(`Llamando a ${pretty(els.number.value)}`, 'live'); break;
    case 'early': case 'ringing':
      els.callInfo.textContent = 'Timbrando…'; break;
    case 'active':
      if (!timer) startTimer(); setStatus('En llamada', 'live'); break;
    case 'held':
      els.callInfo.textContent = 'En espera'; break;
    case 'hangup': case 'destroy': {
      const s = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
      const cause = c.cause && c.cause !== 'NORMAL_CLEARING' ? ` (${c.cause.replace(/_/g, ' ').toLowerCase()})` : '';
      els.callInfo.textContent = s ? `Llamada terminada · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `Llamada terminada${cause}`;
      stopTimer(); startedAt = 0; call = null; muted = false;
      setStatus('Listo para llamar', 'ok');
      break;
    }
  }
  refreshButtons();
}

els.callBtn.addEventListener('click', () => {
  if (inCall()) { call.hangup(); return; }
  const to = toE164(els.number.value);
  if (!to) { els.callInfo.textContent = 'Escribe un número de 10 dígitos.'; return; }
  els.number.value = pretty(to);
  call = client.newCall({ destinationNumber: to, callerNumber, audio: true, video: false });
  refreshButtons();
});

els.muteBtn.addEventListener('click', () => {
  if (!inCall()) return;
  if (muted) call.unmuteAudio(); else call.muteAudio();
  muted = !muted;
  refreshButtons();
});

// ── Entrar / salir ─────────────────────────────────────────────────────────
els.vendedor.value = store.get('ws-llamadas-vendedor') || '';

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.loginError.textContent = '';
  els.loginBtn.disabled = true;
  els.loginBtn.textContent = 'Entrando…';
  const vendedor = els.vendedor.value.trim();
  try {
    // Pedir el micrófono aquí, con un toque del usuario, para que el permiso salga ahora y no a mitad de llamada.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      throw new Error('Sin permiso de micrófono no se puede llamar. Actívalo en los ajustes del navegador para este sitio.');
    }
    const { token, callerNumber: from } = await getToken(vendedor, els.pin.value);
    callerNumber = from;
    store.set('ws-llamadas-vendedor', vendedor);
    els.pin.value = '';
    els.callerId.textContent = pretty(from);
    els.who.textContent = vendedor;
    els.login.classList.add('hidden');
    els.dialer.classList.remove('hidden');
    els.logoutBtn.classList.remove('hidden');
    connect(token);
  } catch (err) {
    els.loginError.textContent = err.message;
  } finally {
    els.loginBtn.disabled = false;
    els.loginBtn.textContent = 'Entrar';
  }
});

els.logoutBtn.addEventListener('click', () => {
  if (call) call.hangup();
  if (client) client.disconnect();
  client = null; call = null;
  els.dialer.classList.add('hidden');
  els.login.classList.remove('hidden');
  els.logoutBtn.classList.add('hidden');
});

window.addEventListener('beforeunload', () => { if (client) client.disconnect(); });
refreshButtons();
