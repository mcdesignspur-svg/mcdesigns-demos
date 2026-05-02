// Eco — Conversational ack + final trait inference.
// Two modes:
//   mode: 'turn'   -> short ack (1-2 sentences) reacting to user's latest answer
//   mode: 'traits' -> 6-8 trait chips inferred from full transcript

import Anthropic from '@anthropic-ai/sdk';

const ACK_MODEL = 'claude-haiku-4-5-20251001';
const TRAITS_MODEL = 'claude-haiku-4-5-20251001';

const ACK_SYSTEM = `You are Eco, a voice cloning interview bot built by MC Designs. You're interviewing a user across 5 short questions to capture their writing voice.

Each turn, you do ONE thing: react to what they just said with a sharp 1-2 sentence acknowledgment, then the system appends the next scripted question (you don't write it).

Your acknowledgments must:
- Be 1-2 sentences. Max. No exceptions.
- Match the user's primary language exactly: {{LANG}}.
  - "es" = Spanish, "en" = English, "spanglish" = mix code-switching naturally, "pt" = Portuguese.
- Pick ONE specific thing they said and reflect it back. Quote a phrase, name a tension, or call out a pattern.
- Sound like a sharp friend taking notes — observant, dry, present. Not a chatbot.
- Never say "great", "awesome", "love it", "thanks for sharing", "interesting", "I see". No fillers.
- No emojis.
- No questions in the ack — the next question is appended by the system.
- If their answer is short or vague, gently note it without scolding ("Corto, pero claro." / "Short and direct — got it.").

Tone calibration: think editor-on-deadline, not therapist. Quick, perceptive, moves the conversation forward.

Output ONLY the acknowledgment text. No preamble, no quotes, no markdown.`;

const TRAITS_SYSTEM = `You are Eco's voice analyst. Based on a 5-turn conversation with a user, output 6-8 short trait "chips" that capture observable patterns of their writing voice.

Output ONLY a JSON array of strings. Nothing else.

Rules for chips:
- 2-4 words each, in the user's primary language ({{LANG}}).
- SPECIFIC and OBSERVABLE — based on actual evidence in the transcript, not generic descriptors.
- Mix categories: rhythm, vocabulary, humor, persona, opener style, anti-pattern, energy.
- Avoid: "professional", "engaging", "creative", "passionate" — meaningless filler.
- Prefer concrete observations like:
  ["Spanglish casual", "Oraciones punchy", "Humor seco", "Yo no nosotros", "Storytelling personal", "Anti-corporate", "Opina con conviction", "Metáforas de deportes"]
  ["Punchy sentences", "Dry humor", "First-person only", "Hates jargon", "Real-world examples", "Direct claims"]

Output format (strict):
["chip1", "chip2", "chip3", "chip4", "chip5", "chip6"]`;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    }

    const { mode, lang, transcript, latestAnswer, latestQuestion } = req.body || {};

    if (!lang) return res.status(400).json({ error: 'lang required' });
    if (!Array.isArray(transcript)) return res.status(400).json({ error: 'transcript array required' });

    const client = new Anthropic();

    if (mode === 'turn') {
        if (!latestAnswer || !latestQuestion) {
            return res.status(400).json({ error: 'latestAnswer + latestQuestion required for turn mode' });
        }

        const sys = ACK_SYSTEM.replace('{{LANG}}', lang);
        const transcriptText = transcript
            .map(t => `Eco asked: ${t.question}\nUser: ${t.answer}`)
            .join('\n\n');

        const userMsg = `${transcriptText ? 'Conversation so far:\n' + transcriptText + '\n\n---\n\n' : ''}Eco just asked: ${latestQuestion}\nUser just answered: ${latestAnswer}\n\nGenerate ONLY your acknowledgment (1-2 sentences, in ${lang}).`;

        try {
            const response = await client.messages.create({
                model: ACK_MODEL,
                max_tokens: 200,
                system: sys,
                messages: [{ role: 'user', content: userMsg }],
            });

            let ack = response.content
                .filter(b => b.type === 'text')
                .map(b => b.text)
                .join('')
                .trim();

            // Strip wrapping quotes if model added them
            ack = ack.replace(/^["'`]|["'`]$/g, '').trim();

            return res.status(200).json({ ack });
        } catch (err) {
            return res.status(502).json({ error: err.message });
        }
    }

    if (mode === 'traits') {
        if (transcript.length < 3) {
            return res.status(400).json({ error: 'Need at least 3 turns of transcript' });
        }

        const sys = TRAITS_SYSTEM.replace('{{LANG}}', lang);
        const transcriptText = transcript
            .map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer}`)
            .join('\n\n');

        const userMsg = `Conversation transcript:\n\n${transcriptText}\n\nOutput the JSON array of 6-8 trait chips now.`;

        try {
            const response = await client.messages.create({
                model: TRAITS_MODEL,
                max_tokens: 400,
                system: sys,
                messages: [{ role: 'user', content: userMsg }],
            });

            const text = response.content
                .filter(b => b.type === 'text')
                .map(b => b.text)
                .join('')
                .trim();

            const match = text.match(/\[[\s\S]*\]/);
            if (!match) throw new Error('No JSON array in response');
            const traits = JSON.parse(match[0]);
            if (!Array.isArray(traits)) throw new Error('Not an array');

            return res.status(200).json({ traits: traits.slice(0, 8) });
        } catch (err) {
            return res.status(502).json({ error: err.message });
        }
    }

    return res.status(400).json({ error: 'mode must be "turn" or "traits"' });
}
