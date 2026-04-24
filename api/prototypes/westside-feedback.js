// Prototype · WestSide Content Studio · Feedback Loop (Phase 2)
//
//  POST /api/prototypes/westside-feedback
//    body: { kind: 'tone'|'regenerate', rule, target?, notes?, draft_id?, ephemeral? }
//    → persists a calibration rule (kind=tone) or logs a regen action (kind=regenerate, ephemeral=true)
//    → returns { id, calibration: [...last 20 persistent rules...] }
//
//  GET /api/prototypes/westside-feedback
//    → returns { calibration: [...last 20 persistent rules...] }
//
// Tone feedback feeds into Strategist/Copy prompts on next generate run.
// Regenerate feedback is logged-only (ephemeral=true) and never fed into prompts.

import { saveWsFeedback, listWsFeedback } from '../lib/supabase.js';

export const config = { runtime: 'nodejs', maxDuration: 10 };

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        const calibration = await listWsFeedback({ limit: 20, includeEphemeral: false });
        return res.status(200).json({ calibration });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body || {};
    const {
        kind,
        rule,
        target = null,
        notes = null,
        draft_id = null,
        ephemeral,
    } = body;

    if (!['tone', 'regenerate'].includes(kind)) {
        return res.status(400).json({ error: 'kind must be "tone" or "regenerate"' });
    }
    if (!rule || String(rule).trim().length < 2) {
        return res.status(400).json({ error: 'rule is required (min 2 chars)' });
    }

    // Tone always persists. Regenerate is always ephemeral (unless explicitly overridden — not exposed in UI).
    const isEphemeral = kind === 'regenerate' ? (ephemeral ?? true) : false;

    const id = await saveWsFeedback({
        kind,
        rule: String(rule).slice(0, 280),
        target,
        notes: notes ? String(notes).slice(0, 1000) : null,
        draft_id,
        ephemeral: isEphemeral,
        client_ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
        user_agent: req.headers['user-agent'] || null,
    });

    const calibration = await listWsFeedback({ limit: 20, includeEphemeral: false });
    return res.status(200).json({ id, ephemeral: isEphemeral, calibration });
}
