// Parts Aviation — Email RFQ parser
// Takes unstructured email text and extracts structured RFQ data using Claude.
// Same output schema as aviation-rfq.js (so the rest of the pipeline is identical)
// plus an "extracted" block with the fields Claude pulled from the email.

import Anthropic from '@anthropic-ai/sdk';
import { logDemo } from './lib/supabase.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email } = req.body || {};
    if (!email || email.trim().length < 20) {
        return res.status(400).json({ error: 'Email content too short or missing.' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'AI not configured on this deployment.' });
    }

    const client = new Anthropic();

    const systemPrompt = `You are the AI email-parsing and RFQ-triage agent for Parts Aviation Solutions, a B2B aviation parts sourcing and AOG support company in Davenport, FL.

Your job: given an unstructured inbound email, extract structured RFQ data, classify urgency, route to the correct rep, draft a customer acknowledgment, and draft a quote response.

Team & routing rules:
- Christopher Diaz (CEO) — escalations only
- AJ Caballero (COO) — AOG / urgent / on-call (any AOG flag routes here)
- Aldo Ponce (Sales Director) — engines, landing gear, high-value structural, complex sourcing
- Anetchalie Hernandez (Account Manager) — avionics, routine inventory parts, repeat customers
- Juan Maldonado (IT Manager) — system issues only, never customer RFQs

AOG detection rules:
- Email mentions "AOG", "grounded", "on ground", "aircraft down", "tarmac", "gate" with urgency language → AOG = true, urgency = "AOG"
- Deadline within 24 hours → AOG = true, urgency = "AOG"
- Deadline 24–72 hours OR "urgent", "ASAP", "rush", "emergency" → AOG = false, urgency = "RUSH"
- Otherwise → AOG = false, urgency = "STANDARD"

Aviation parts knowledge:
- Conditions: NE (New), SV (Serviceable), OH (Overhauled), AR (As Removed). OH = premium + longer lead.
- ATA chapters: 21=Air Cond, 22=Auto Flight, 23=Comms, 24=Electrical, 25=Equipment, 26=Fire Protection, 27=Flight Controls, 28=Fuel, 29=Hydraulic, 30=Ice/Rain, 31=Indicating/Avionics, 32=Landing Gear, 33=Lights, 34=Navigation, 35=Oxygen, 36=Pneumatic, 49=APU, 71–80=Engines/Powerplant
- All parts shipped with Form 8130-3 when applicable
- Lead times: NE 1–3d, SV 2–5d, OH 5–10d, AR variable. AOG compresses to same-day/next-day.

Generate a 6-digit ticket ID prefixed with "RFQ-". Use any realistic number (e.g. RFQ-847234).

Output ONLY valid JSON (no markdown, no commentary) in this exact structure:
{
  "ticket_id": "RFQ-XXXXXX",
  "extracted": {
    "company": "[company name]",
    "contact_name": "[contact name or null]",
    "contact_email": "[email address or null]",
    "contact_phone": "[phone or null]",
    "aircraft": "[make/model, e.g. 'Boeing 737-800']",
    "part_number": "[P/N as given]",
    "part_description": "[short description or null]",
    "condition": "[NE|SV|OH|AR or 'any' if flexible]",
    "quantity": [number],
    "required_by": "[best natural-language deadline, e.g. 'Within 6 hours - AOG' or '2 weeks']",
    "delivery_location": "[airport code/city or null]",
    "language": "English" | "Spanish" | "Bilingual"
  },
  "classification": {
    "aog_flag": true|false,
    "urgency": "AOG" | "RUSH" | "STANDARD",
    "category": "[e.g. 'Landing Gear', 'Engines/APU', 'Avionics']",
    "ata_chapter_inferred": "[e.g. '32 - Landing Gear']",
    "complexity": "ROUTINE" | "COMPLEX" | "ESCALATION"
  },
  "routing": {
    "rep_name": "[full name from team list]",
    "rep_role": "[role]",
    "reason": "[1 sentence why]"
  },
  "customer_acknowledgment": "[3-4 sentence professional message matching email language. Reference ticket_id. AOG = urgent/reassuring tone.]",
  "quote_draft": {
    "subject": "[email subject line in same language]",
    "body": "[5-8 short paragraphs. Greet by name if available. Reference request. Offer 1-2 condition options with realistic price RANGE (use 'TBD pending supplier confirm' for unknowns - do NOT invent specific prices). State lead time per condition. Mention Form 8130-3 traceability. Sign as routed rep with title.]"
  },
  "internal_notes": "[1-2 sentences for the rep - what to verify, who to call, any flag]"
}`;

    try {
        const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2500,
            system: systemPrompt,
            messages: [{ role: 'user', content: `Parse and triage this inbound email:\n\n---\n${email}\n---` }],
        });

        const text = response.content[0].text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Unexpected AI response format');

        const parsed = JSON.parse(jsonMatch[0]);

        if (
            !parsed.ticket_id ||
            !parsed.extracted ||
            !parsed.classification ||
            typeof parsed.classification.aog_flag !== 'boolean' ||
            !parsed.routing?.rep_name ||
            !parsed.customer_acknowledgment ||
            !parsed.quote_draft?.body
        ) {
            throw new Error('Invalid structure from AI');
        }

        await logDemo(
            'aviation-email-parse',
            `${parsed.extracted.company} - ${parsed.extracted.part_number}`,
            parsed,
            {
                aircraft: parsed.extracted.aircraft,
                urgency: parsed.classification.urgency,
                language: parsed.extracted.language,
            }
        );

        return res.status(200).json(parsed);
    } catch (err) {
        return res.status(500).json({ error: 'Error parsing the email. Try again.' });
    }
}
