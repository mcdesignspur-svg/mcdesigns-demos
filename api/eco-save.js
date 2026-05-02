// Eco — Save profile (email gate) and log validation events.
// Two flows:
//   kind: "save"   -> attach email + willingness to existing profile, also log event
//   kind: "rating" -> log a per-output rating event

import { logEcoEvent, attachEmailToProfile } from './lib/supabase.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body || {};
    const { kind, profileId } = body;

    if (kind === 'save') {
        const { email, willingness } = body;
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
            return res.status(400).json({ error: 'Email inválido' });
        }

        // If we have a real Supabase id, attach. If localish (local-...), just log event.
        let updated = false;
        if (profileId && !String(profileId).startsWith('local-')) {
            try {
                updated = await attachEmailToProfile(profileId, { email, willingness });
            } catch (e) {
                // silent
            }
        }

        logEcoEvent({
            profile_id: profileId || null,
            kind: 'save',
            metadata: { email, willingness, updated },
        }).catch(() => {});

        return res.status(200).json({ ok: true, persisted: updated });
    }

    if (kind === 'rating') {
        const { rating, result } = body;
        if (!rating || rating < 1 || rating > 4) {
            return res.status(400).json({ error: 'Rating inválido' });
        }
        logEcoEvent({
            profile_id: profileId || null,
            kind: 'rating',
            rating,
            directive: result?.directive || null,
            input_chars: result?.input?.length || null,
            output_chars: result?.output?.length || null,
            metadata: {},
        }).catch(() => {});
        return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'kind inválido' });
}
