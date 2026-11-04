import { timingSafeEqual, createHash } from 'node:crypto';

/**
 * POST /api/westside-llamadas-token
 * Demo de llamadas WebRTC con Telnyx (página /westside/llamadas).
 *
 * Recibe { pin, vendedor } y devuelve { token, callerNumber }:
 *  - pin: debe coincidir con DEMO_LLAMADAS_PIN (la página no es pública).
 *  - vendedor: nombre corto; cada vendedor tiene su propia telephony
 *    credential dentro de la Credential Connection, como se haría en producción.
 *
 * El token es un JWT de Telnyx que dura 24 h. La API key y las contraseñas
 * SIP nunca llegan al navegador.
 *
 * Variables (Vercel → Settings → Environment Variables):
 *   TELNYX_API_KEY               API key de la cuenta de Telnyx
 *   TELNYX_WEBRTC_CONNECTION_ID  id de la Credential Connection (SIP Connection tipo Credentials)
 *   TELNYX_CALLER_NUMBER         número de la cuenta que verá el cliente, ej. +17875551234
 *   DEMO_LLAMADAS_PIN            PIN para entrar a la demo
 */
const API = 'https://api.telnyx.com/v2';
const PREFIX = 'demo-llamadas-';

function sameSecret(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

// Freno simple contra adivinar el PIN (por instancia de la función).
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;
function tooManyFailures(ip) {
  const f = failures.get(ip);
  return Boolean(f && Date.now() - f.since < WINDOW_MS && f.count >= 5);
}
function recordFailure(ip) {
  const f = failures.get(ip);
  if (!f || Date.now() - f.since >= WINDOW_MS) failures.set(ip, { since: Date.now(), count: 1 });
  else f.count += 1;
}

function slug(raw) {
  const s = String(raw || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  return s || 'vendedor';
}

async function telnyx(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Telnyx ${res.status} en ${path.split('?')[0]}: ${body.slice(0, 300)}`);
  }
  return res;
}

/** Busca la credencial del vendedor en esta conexión; si no existe, la crea. */
async function credentialFor(name, connectionId) {
  const params = new URLSearchParams({ 'filter[name]': name, 'page[size]': '250' });
  const list = await (await telnyx(`/telephony_credentials?${params}`)).json();
  const found = (list.data || []).find((c) => c.name === name && c.resource_id === `connection:${connectionId}`)
    || (list.data || []).find((c) => c.name === name);
  if (found) return { id: found.id, fresh: false };

  const created = await (
    await telnyx('/telephony_credentials', {
      method: 'POST',
      body: JSON.stringify({ connection_id: connectionId, name }),
    })
  ).json();
  return { id: created.data.id, fresh: true };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido.' });

  const { TELNYX_API_KEY, TELNYX_WEBRTC_CONNECTION_ID, TELNYX_CALLER_NUMBER, DEMO_LLAMADAS_PIN } = process.env;
  const missing = Object.entries({ TELNYX_API_KEY, TELNYX_WEBRTC_CONNECTION_ID, TELNYX_CALLER_NUMBER, DEMO_LLAMADAS_PIN })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    return res.status(503).json({ error: `Falta configurar en Vercel: ${missing.join(', ')}.` });
  }

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'local';
  if (tooManyFailures(ip)) return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });

  const { pin, vendedor } = req.body || {};
  if (!pin || !sameSecret(pin, DEMO_LLAMADAS_PIN)) {
    recordFailure(ip);
    return res.status(401).json({ error: 'PIN incorrecto.' });
  }

  try {
    const cred = await credentialFor(`${PREFIX}${slug(vendedor)}`, TELNYX_WEBRTC_CONNECTION_ID);
    // Telnyx pide esperar ~5 s antes del primer login con una credencial nueva.
    if (cred.fresh) await new Promise((r) => setTimeout(r, 5000));
    const token = (await (await telnyx(`/telephony_credentials/${cred.id}/token`, { method: 'POST' })).text()).trim();
    return res.status(200).json({ token, callerNumber: TELNYX_CALLER_NUMBER });
  } catch (err) {
    console.error('[telnyx-webrtc-token]', err);
    return res.status(502).json({ error: 'Telnyx no respondió. Revisa la API key y el id de la conexión.' });
  }
}
