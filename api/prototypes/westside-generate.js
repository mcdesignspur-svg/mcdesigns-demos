// Prototype · WestSide Content Studio · SSE orchestrator
// GET /api/prototypes/westside-generate?location=...&post_type=...&format=...&topic=...
// Streams server-sent events as each agent runs.

import {
    contextAgent,
    strategistAgent,
    copyAgent,
    visualAgent,
    qaAgent,
} from './ws-agents.js';
import { saveWsDraft } from '../lib/supabase.js';

export const config = { runtime: 'nodejs', maxDuration: 60 };

function sse(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed. Use GET for SSE.' });
    }

    const { location, post_type, format, topic } = req.query || {};
    if (!location || !post_type || !format || !topic || String(topic).trim().length < 3) {
        return res.status(400).json({ error: 'Faltan campos: location, post_type, format, topic.' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured.' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    // Start the stream
    res.flushHeaders?.();

    const input = { location, post_type, format, topic };
    const started = Date.now();
    const trace = {};

    const run = async (name, fn) => {
        const t0 = Date.now();
        sse(res, 'agent.start', { agent: name });
        try {
            const result = await fn();
            const ms = Date.now() - t0;
            trace[name] = { ms, output: result };
            sse(res, 'agent.done', { agent: name, ms, preview: summarize(name, result) });
            return result;
        } catch (err) {
            sse(res, 'agent.failed', { agent: name, error: err.message });
            throw err;
        }
    };

    try {
        sse(res, 'orchestrator.start', { input });

        const context = await run('context', () => contextAgent({ location }));
        const strategy = await run('strategist', () => strategistAgent({ context, input }));

        // CopyAgent and VisualAgent in parallel
        sse(res, 'orchestrator.parallel', { agents: ['copy', 'visual'] });
        const [copy, visual] = await Promise.all([
            run('copy', () => copyAgent({ context, strategy, input })),
            run('visual', () => visualAgent({ context, strategy, copy: null, input })),
        ]);

        const qa = await run('qa', () => qaAgent({ copy, visual, strategy }));

        const output = {
            ...copy,
            image_prompt: visual.image_prompt,
            shoot_references: visual.shoot_references,
            suggested_visual_beat: visual.suggested_visual_beat,
            best_time: context.best_time || null,
            strategy,
            qa,
        };

        const run_ms = Date.now() - started;

        // Persist to Supabase (fire-and-forget, but we await to capture id)
        const draftId = await saveWsDraft({
            location,
            post_type,
            format,
            topic,
            status: qa.status === 'pass' ? 'review' : 'draft',
            run_ms,
            agent_trace: trace,
            output,
            client_ip: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || null,
            user_agent: req.headers['user-agent'] || null,
        });

        sse(res, 'orchestrator.done', { draft_id: draftId, run_ms, output });
        res.end();
    } catch (err) {
        console.error('[ws-generate] error:', err);
        sse(res, 'orchestrator.failed', { error: err.message || 'unknown error' });
        res.end();
    }
}

function summarize(name, r) {
    switch (name) {
        case 'context':
            return {
                classes: (r.classes_this_week || []).length,
                promos: (r.active_promos || []).length,
                best_time: r.best_time || null,
            };
        case 'strategist':
            return { arc: r.narrative_arc, format: r.recommended_format, hook: r.hook_archetype };
        case 'copy':
            return {
                hook_preview: r.hooks?.[0],
                caption_len: r.caption_medium?.length,
                hashtags: r.hashtags?.length,
            };
        case 'visual':
            return { prompt_preview: (r.image_prompt || '').slice(0, 80) + '…' };
        case 'qa':
            return { status: r.status, fails: (r.checks || []).filter(c => !c.pass).length };
        default: return {};
    }
}
