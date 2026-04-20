// Burbuja Social — Intake form handler
// Simula: AI classification + priority scoring + WhatsApp routing
// Producción: Anthropic para clasificar + Supabase + Twilio/Meta WhatsApp + N8N para onboarding

import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, phone, email, service, message, timeline } = req.body || {};

    if (!name || !phone || !email || !service || !message) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    let category = null;
    let priority = 'MEDIA';
    let aiRoute = service;

    // Try AI classification if key is configured
    if (process.env.ANTHROPIC_API_KEY) {
        try {
            const client = new Anthropic();
            const response = await client.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 300,
                system: `You classify incoming inquiries for Burbuja Social Creative Studio (Caguas, PR).

They offer three service lines:
- "agencia": social media management, paid ads, graphic design, brand consulting
- "fotografia": product photography, branding sessions, portraits, events, content
- "alquiler": studio rental by hour/day (photo/video studio with gear)

Output ONLY valid JSON (no markdown, no commentary):
{
  "category": "[short 2-4 word category like 'Sesión de producto', 'Rebrand completo', 'Alquiler evento', 'Social media mensual']",
  "priority": "ALTA" | "MEDIA" | "BAJA",
  "route": "agencia" | "fotografia" | "alquiler"
}

Priority rules:
- ALTA: ASAP timeline, high-value (day rental, full rebrand, multi-month retainer), repeat hints
- MEDIA: standard timelines, single session/project
- BAJA: info-gathering tone, flexible timeline, low specificity`,
                messages: [
                    {
                        role: 'user',
                        content: `Service selected: ${service}
Timeline: ${timeline || 'not specified'}
Message: ${message}`,
                    },
                ],
            });

            const text = response.content[0].text.trim();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.category) category = parsed.category;
                if (parsed.priority) priority = parsed.priority;
                if (parsed.route) aiRoute = parsed.route;
            }
        } catch (err) {
            // Silent fallback to heuristic
        }
    }

    // Fallback heuristic if AI didn't respond
    if (!category) {
        category = {
            agencia: 'Agencia Digital',
            fotografia: 'Sesión de Fotografía',
            alquiler: 'Alquiler de Estudio',
        }[service] || 'Consulta General';

        if (timeline === 'ASAP') priority = 'ALTA';
        else if (timeline === 'Flexible') priority = 'BAJA';
    }

    const whatsappPreview = buildWhatsAppMessage({ name, service: aiRoute, category, timeline });

    return res.status(200).json({
        ok: true,
        category,
        priority,
        route: aiRoute,
        whatsappPreview,
        timestamp: new Date().toISOString(),
    });
}

function buildWhatsAppMessage({ name, service, category, timeline }) {
    const firstName = name.split(' ')[0];
    const signoffs = {
        agencia: 'Equipo Burbuja Agencia',
        fotografia: 'Liliana · Burbuja Photo',
        alquiler: 'Coordinación Estudio Burbuja',
    };
    const intros = {
        agencia: '¡Qué emoción tenerte por acá! 💫',
        fotografia: '¡Hola! Gracias por escoger Burbuja para tu sesión 📸',
        alquiler: '¡Perfecto, tenemos el estudio listo para ti! 🎬',
    };

    return `${intros[service] || '¡Hola!'} Soy de Burbuja Social Creative Studio.

Hola ${firstName}, recibimos tu mensaje sobre: ${category}.

${timeline === 'ASAP' ? '⚡ Vi que lo necesitas lo antes posible — te priorizo.' : ''}

Próximo paso: te envío por acá mismo 3 opciones de horario para una llamada corta (15 min) y revisar detalles. ¿Te va mejor hoy tarde, mañana AM, o mañana PM?

Mientras tanto, si tienes referencias visuales o más detalles, envíalos por acá sin pena.

— ${signoffs[service] || 'Burbuja Social'}`;
}
