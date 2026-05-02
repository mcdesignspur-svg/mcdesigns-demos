// Eco — Generate voice profile from a conversational interview + optional samples.
// Uses Claude Sonnet 4.6 to extract a rich JSON voice profile.
//
// Input shape:
// {
//   mode: "conversation",
//   lang: "es" | "en" | "spanglish" | "pt" | "other",
//   transcript: [{ questionId, question, answer }, ...],
//   confirmedTraits: [string],
//   rejectedTraits: [string],
//   samples: [{ source, text }, ...]    // optional extra paste/upload
// }
// Returns { id, profile, summary }.

import Anthropic from '@anthropic-ai/sdk';
import { logEcoEvent, saveEcoProfile } from './lib/supabase.js';

const MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a senior brand voice strategist + linguistic profiler. You analyze how a person writes and produce a *machine-readable* voice profile that another model can use to rewrite generic AI text in that person's voice.

Your output is a single JSON object — no markdown, no commentary, no preamble. The schema:

{
  "tagline": "string · 5-9 words capturing the essence of this voice",
  "summary": "string · 2-3 sentences describing this person's voice in plain language",
  "traits": ["string", ...] // 5-8 short trait tags (e.g. "punchy", "warm humor", "metaphor-heavy", "Spanglish")
  "language": {
    "primary": "es" | "en" | "spanglish" | "pt" | "other",
    "code_switching": "string · how/when they mix languages, if applicable",
    "register": "string · formality summary"
  },
  "rhythm": {
    "sentence_length": "punchy | medium | flowing | varied",
    "rules": ["string", ...] // 2-4 specific rhythm rules to apply
  },
  "lexicon": {
    "signature_phrases": ["string", ...] // explicit recurring words/phrases the person uses
    "anti_patterns": ["string", ...] // words/phrases to NEVER use
    "preferred_connectors": ["string", ...] // how they transition between ideas
  },
  "structure": {
    "opener_pattern": "string · how they typically open",
    "closer_pattern": "string · how they typically close",
    "person": "yo | nosotros | tu | mix"
  },
  "tone": {
    "dominant": "string · single dominant tone (warm, direct, etc.)",
    "humor_style": "none | dry | warm | sarcastic | self_deprecating | absurd",
    "emotion_default": "string · default emotional register"
  },
  "do_rules": ["string", ...] // 4-6 explicit DO rules — actionable, specific
  "do_not_rules": ["string", ...] // 4-6 explicit DO NOT rules — actionable, specific
  "examples": [
    {
      "scenario": "string · short scenario name",
      "output": "string · 1-3 sentences of how this voice would write it"
    }
  ] // 2 examples
}

Hard rules:
- Be SPECIFIC. "Uses warm tone" is useless. "Opens with a contrarian observation, then softens with a personal anecdote" is useful.
- The user's CONVERSATION ANSWERS are themselves writing samples — mine them aggressively for cadence, vocabulary, signature phrases, openers, connectors. They wrote those answers in their natural voice.
- If extra samples are provided, weight them equally with conversation answers.
- Anti-patterns must be CONCRETE. "Avoid corporate jargon" is weak. List specific words: "potenciar", "empoderar", "leverage", "synergy", "in today's world", "it's important to note".
- Confirmed trait chips are user-validated truths; reflect them in the profile. Rejected chips are wrong; do NOT include those in traits/tone.
- Keep all string values in the same primary language as the user's writing.
- Return ONLY the JSON object. Nothing else.

TURN-SPECIFIC MINING RULES (each conversation turn is engineered to surface specific dimensions — mine accordingly):
- T1 (what they do): vocabulary baseline, default formality, brevity tendency. A short answer here is a signal — they're concise by default.
- T2 (reply to a prospect DM): this is a PITCH-VOICE SAMPLE. Extract opener_pattern when writing to strangers, helper persona, persona (yo/tu/usted), how they describe their work in pitch context. Weight this turn heavily for opener_pattern when register is professional-stranger.
- T3 (emotional moment, "brutal" or "disaster"): EMOTIONAL STORYTELLING SAMPLE. Mine for narrative rhythm, conviction calibration, humor style, emotional default, how they characterize people and tense situations. This is where humor and conviction surface most clearly.
- T4 (one-line claim, no selling): claim-making style. Are they hedged or absolute? Do they make sweeping or narrow claims? Use this for the conviction posture in tone.dominant.
- T5 (cringe + rewrite): TWO-PART GOLD. (a) The listed cringe phrases go DIRECTLY into lexicon.anti_patterns and do_not_rules — quote them verbatim. (b) The user's rewrite of one cringe phrase IS a direct voice sample showing their voice in action — mine its phrasing and shape for signature_phrases and rhythm rules.
- T6 (post opener + closer): HIGHEST-LEVERAGE SAMPLES for the rewriter. The opener line goes into structure.opener_pattern as a near-verbatim template. The closer line goes into structure.closer_pattern. These two patterns are what the rewriter needs most.`;

const QUESTION_PURPOSE = {
    T1: 'What they do — vocabulary base, default formality, brevity',
    T2: 'PITCH SAMPLE — reply to a prospect DM. Extract opener with strangers, helper voice, pitch register',
    T3: 'EMOTIONAL STORY — recent moment with explicit positive/negative valence. Extract narrative rhythm, conviction, humor, emotional default',
    T4: 'ONE-LINE CLAIM — why work matters without selling. Extract claim-making style, conviction calibration',
    T5: 'CRINGE + REWRITE — listed anti-patterns AND a direct voice sample showing how they would write it',
    T6: 'OPENER + CLOSER SAMPLES — actual content opener and closer the user wrote. Highest-priority signal for the rewriter',
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const body = req.body || {};
    const isConversation = body.mode === 'conversation';

    // Validate
    if (isConversation) {
        if (!body.lang) return res.status(400).json({ error: 'lang required' });
        if (!Array.isArray(body.transcript) || body.transcript.length < 3) {
            return res.status(400).json({ error: 'transcript with at least 3 turns required' });
        }
    } else {
        if (!body.answers || typeof body.answers !== 'object') {
            return res.status(400).json({ error: 'answers required' });
        }
    }

    let userMessage;
    let answersForStorage;

    if (isConversation) {
        const { lang, transcript, confirmedTraits = [], rejectedTraits = [], samples = [] } = body;

        const transcriptBlock = transcript
            .map((t, i) => {
                const purpose = QUESTION_PURPOSE[t.questionId] || '';
                return `--- Turn ${i + 1}${purpose ? ` (purpose: ${purpose})` : ''} ---
Question: ${t.question}
User's answer: ${t.answer}`;
            })
            .join('\n\n');

        const samplesBlock = (samples || [])
            .filter(s => s && s.text && s.text.trim().length > 50)
            .slice(0, 5)
            .map((s, i) => `--- Sample ${i + 1} (${s.source || 'unknown'}) ---\n${s.text.trim().slice(0, 6000)}`)
            .join('\n\n');

        userMessage = `Build a voice profile from this conversational interview.

PRIMARY LANGUAGE: ${lang}

CONVERSATION TRANSCRIPT (the user's answers ARE their writing samples — mine them for voice patterns)

${transcriptBlock}

USER-CONFIRMED TRAIT CHIPS (these are validated by the user — must be reflected in the profile):
${confirmedTraits.length ? confirmedTraits.map(t => `- ${t}`).join('\n') : '(none)'}

USER-REJECTED TRAIT CHIPS (do NOT include these in the profile):
${rejectedTraits.length ? rejectedTraits.map(t => `- ${t}`).join('\n') : '(none)'}

EXTRA WRITING SAMPLES (paste/upload, optional)
${samplesBlock || '(none provided)'}

Output the JSON profile now.`;

        // Build a structured "answers" object for storage so it stays queryable
        answersForStorage = {
            mode: 'conversation',
            lang,
            brand: extractFirstAnswer(transcript, 'T1'), // what they do
            pitch_sample: extractFirstAnswer(transcript, 'T2'),
            story: extractFirstAnswer(transcript, 'T3'),
            why: extractFirstAnswer(transcript, 'T4'),
            cringe_and_rewrite: extractFirstAnswer(transcript, 'T5'),
            post_opener_closer: extractFirstAnswer(transcript, 'T6'),
            confirmedTraits,
            rejectedTraits,
        };
    } else {
        // Legacy structured questionnaire path (kept for backward compat / dev testing)
        const { answers, samples } = body;
        const requiredFields = ['brand', 'lang', 'tone', 'rhythm', 'humor', 'person', 'opener', 'audience'];
        for (const f of requiredFields) {
            if (!answers[f]) return res.status(400).json({ error: `Missing required answer: ${f}` });
        }

        const samplesBlock = (samples || [])
            .filter(s => s && s.text && s.text.trim().length > 50)
            .slice(0, 5)
            .map((s, i) => `--- Sample ${i + 1} (${s.source || 'unknown'}) ---\n${s.text.trim().slice(0, 6000)}`)
            .join('\n\n');

        userMessage = `Build a voice profile from the following.

QUESTIONNAIRE ANSWERS
- What they build: ${answers.brand}
- Primary language: ${answers.lang}
- Stated dominant tone: ${answers.tone}
- Formality (1=super casual, 5=very formal): ${answers.formality}
- Rhythm: ${answers.rhythm}
- Humor: ${answers.humor}
- Person: ${answers.person}
- Typical opener: ${answers.opener}
- Audience: ${answers.audience}
- Self-described signature phrases: ${answers.signature || '(not provided)'}
- Self-described phrases to avoid: ${answers.avoid || '(not provided)'}

WRITING SAMPLES
${samplesBlock || '(no samples provided — rely on questionnaire only)'}

Output the JSON profile now.`;

        answersForStorage = answers;
    }

    let profile = null;
    let attempt = 0;
    let lastError = null;

    while (attempt < 2 && !profile) {
        attempt++;
        try {
            const client = new Anthropic();
            const response = await client.messages.create({
                model: MODEL,
                max_tokens: 2400,
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userMessage }],
            });

            const text = response.content
                .filter(b => b.type === 'text')
                .map(b => b.text)
                .join('')
                .trim();

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('No JSON in response');
            profile = JSON.parse(jsonMatch[0]);
        } catch (err) {
            lastError = err;
            if (attempt >= 2) break;
        }
    }

    if (!profile) {
        return res.status(502).json({ error: `Falló la generación: ${lastError?.message || 'unknown'}` });
    }

    // Persist (fire-and-forget)
    let savedId = null;
    try {
        savedId = await saveEcoProfile({
            answers: answersForStorage,
            profile,
            summary: profile.summary || null,
            samples_count: isConversation ? (body.samples || []).length : (body.samples || []).length,
        });
    } catch (e) { /* silent */ }

    const id = savedId || `local-${Math.random().toString(36).slice(2, 12)}`;

    logEcoEvent({
        profile_id: id,
        kind: 'profile_created',
        metadata: {
            mode: isConversation ? 'conversation' : 'questionnaire',
            samples_count: (body.samples || []).length,
            lang: isConversation ? body.lang : body.answers?.lang,
            transcript_turns: isConversation ? body.transcript.length : null,
            confirmed_traits: isConversation ? (body.confirmedTraits || []).length : null,
        },
    }).catch(() => {});

    return res.status(200).json({
        id,
        profile,
        summary: profile.summary || null,
    });
}

function extractFirstAnswer(transcript, questionId) {
    const turn = transcript.find(t => t.questionId === questionId);
    return turn ? turn.answer.slice(0, 500) : null;
}
