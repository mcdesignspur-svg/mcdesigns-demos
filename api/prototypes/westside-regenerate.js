// Prototype · WestSide Content Studio · Regenerate element
//
//  POST /api/prototypes/westside-regenerate
//    body: { draft_id, element: 'hooks'|'caption'|'hashtags', nudge? }
//    → re-runs only the target element using saved strategy/context + persistent tone feedback
//    → logs an ephemeral feedback row for tracking
//    → returns { element, patch: { ... } }

import { regenerateElement } from './ws-agents.js';
import { getWsDraft, saveWsFeedback, listWsFeedback } from '../lib/supabase.js';

export const config = { runtime: 'nodejs', maxDuration: 30 };

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
    cors(res);
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });
    }

    const { draft_id, element, nudge = '' } = req.body || {};
    if (!draft_id) return res.status(400).json({ error: 'draft_id is required' });
    if (!['hooks', 'caption', 'hashtags'].includes(element)) {
        return res.status(400).json({ error: 'element must be hooks | caption | hashtags' });
    }

    const draft = await getWsDraft(draft_id);
    if (!draft) return res.status(404).json({ error: 'draft not found' });

    // Reconstruct the pieces from the stored trace
    const trace = draft.agent_trace || {};
    const strategistTrace = trace.strategist?.output || {};
    const context = strategistTrace.context || {};
    const strategy = strategistTrace.strategy || strategistTrace;

    const input = {
        location: draft.location,
        post_type: draft.post_type,
        format: draft.format,
        topic: draft.topic,
    };

    const feedback = await listWsFeedback({ limit: 20, includeEphemeral: false });

    try {
        const patch = await regenerateElement({
            element,
            currentDraft: draft.output || {},
            strategy,
            context,
            input,
            feedback,
            nudge,
        });

        // Log the regenerate action as ephemeral feedback
        await saveWsFeedback({
            kind: 'regenerate',
            rule: `regenerate:${element}${nudge ? ' — ' + nudge.slice(0, 120) : ''}`,
            target: element,
            notes: nudge || null,
            draft_id,
            ephemeral: true,
            client_ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
            user_agent: req.headers['user-agent'] || null,
        });

        return res.status(200).json({ element, patch });
    } catch (err) {
        console.error('[ws-regenerate] error:', err);
        return res.status(500).json({ error: err.message || 'regenerate failed' });
    }
}
