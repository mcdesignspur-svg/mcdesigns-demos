// Eco — Humanize: rewrite AI text in the user's voice using their voice profile.
// Uses Claude Sonnet 4.6 with prompt caching on the system prompt + voice profile.

import Anthropic from '@anthropic-ai/sdk';
import { logEcoEvent } from './lib/supabase.js';

const MODEL = 'claude-sonnet-4-6';

const BASE_SYSTEM = `You are Eco, a voice cloning rewriter. You rewrite generic AI-generated text so it sounds like the specific person described in the voice profile below — their words, rhythm, signature phrases, and quirks.

Hard rules:
1. Output ONLY the rewritten text. No preamble. No explanation. No quotes around it. No markdown unless the input had it.
2. Match the voice profile's language. If primary is "es" or "spanglish", output in Spanish or Spanglish — even if the input is in English. The user is reclaiming their voice.
3. Preserve the input's core meaning, claims, and structure. You are *rewriting*, not summarizing or extending.
4. Apply do_rules and lexicon.signature_phrases naturally — don't stuff them in. Better to use one signature phrase well than three awkwardly.
5. ENFORCE anti_patterns and do_not_rules absolutely. If the input contains banned phrases, replace them with the user's natural alternative.
6. Match the input's length unless the user explicitly asks for shorter/longer. Don't pad. Don't trim meaning.
7. Do not add disclaimers, hedges, or "as a [role]" framing. Write like a person, not like an assistant.
8. Stylistic moves you should default to:
   - Open in the voice profile's opener_pattern style.
   - Match rhythm.sentence_length faithfully.
   - Use the profile's preferred_connectors instead of "Furthermore", "Moreover", "Additionally".
   - Drop the AI tells: "let's dive in", "in today's world", "it's important to note", "navigate", "leverage", "potenciar", "empoderar", "delicioso" — unless the profile explicitly uses them.

If the user provides a directive (e.g. "more_casual", "shorter"), apply it on top of the profile.`;

function directiveInstruction(d) {
    switch (d) {
        case 'more_casual': return '\n\nADDITIONAL DIRECTIVE: Make this version meaningfully more casual/loose than the profile default. Drop a notch in formality.';
        case 'more_formal': return '\n\nADDITIONAL DIRECTIVE: Make this version meaningfully more formal/polished than the profile default. Up a notch.';
        case 'shorter': return '\n\nADDITIONAL DIRECTIVE: Cut to ~60% of the input length. Keep all key claims, drop filler.';
        case 'regenerate': return '\n\nADDITIONAL DIRECTIVE: Take a different angle this time. Pick a different opener pattern from the profile if available.';
        default: return '';
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text, profile, answers, directive, profileId } = req.body || {};

    if (!text || text.trim().length < 10) {
        return res.status(400).json({ error: 'Texto muy corto' });
    }
    if (!profile || typeof profile !== 'object') {
        return res.status(400).json({ error: 'profile required' });
    }
    if (text.length > 12000) {
        return res.status(400).json({ error: 'Texto muy largo (máx 12k chars)' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const profileBlock = `VOICE PROFILE\n${JSON.stringify(profile, null, 2)}`;
    const contextBlock = answers?.brand
        ? `\n\nWRITER CONTEXT\n- Builds: ${answers.brand}\n- Audience: ${answers.audience || '(not specified)'}\n`
        : '';
    const userInstr = directiveInstruction(directive);

    const cachedSystem = [
        { type: 'text', text: BASE_SYSTEM },
        {
            type: 'text',
            text: `${profileBlock}${contextBlock}${userInstr}`,
            cache_control: { type: 'ephemeral' },
        },
    ];

    let outputText = null;
    let tokensUsed = null;
    let lastError = null;

    try {
        const client = new Anthropic();
        const response = await client.messages.create({
            model: MODEL,
            max_tokens: 2400,
            system: cachedSystem,
            messages: [
                {
                    role: 'user',
                    content: `Rewrite this in the voice profile's voice. Output the rewrite ONLY:\n\n---\n${text}\n---`,
                },
            ],
        });

        outputText = response.content
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('')
            .trim();

        // Strip wrapping --- if model echoed them
        outputText = outputText.replace(/^---+\s*/, '').replace(/\s*---+$/, '').trim();

        tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
    } catch (err) {
        lastError = err;
    }

    if (!outputText) {
        return res.status(502).json({ error: `Falló la generación: ${lastError?.message || 'unknown'}` });
    }

    // Fire-and-forget event log
    logEcoEvent({
        profile_id: profileId || null,
        kind: 'humanize',
        directive: directive || null,
        input_chars: text.length,
        output_chars: outputText.length,
        metadata: { tokens: tokensUsed },
    }).catch(() => {});

    return res.status(200).json({
        text: outputText,
        tokensUsed,
    });
}
