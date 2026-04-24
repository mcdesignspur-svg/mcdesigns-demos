// WestSide Fitness — AI Content Generator
// Takes a topic + location + post type and returns ready-to-publish content:
// hooks, captions, reel script, hashtags, and ManyChat CTA.

import Anthropic from '@anthropic-ai/sdk';
import { logDemo } from './lib/supabase.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { location, postType, topic, format } = req.body || {};
    if (!location || !postType || !topic || topic.trim().length < 3) {
        return res.status(400).json({ error: 'Faltan campos requeridos.' });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(500).json({ error: 'AI not configured on this deployment.' });
    }

    const client = new Anthropic();

    const systemPrompt = `Eres el generador de contenido AI de WestSide Fitness Club, la única cadena de gimnasios puertorriqueña con 3 ubicaciones (Caguas, San Juan, Bayamón). Tu handle es @westsidefitness.pr.

Tu trabajo: dado un tema + ubicación + tipo de post, generas contenido listo-para-publicar en voz auténtica WestSide.

## Voz y tono WestSide
- Spanglish puertorriqueño natural (mezcla español dominante con inglés gym: "reps", "gainz", "sets", "cardio", "leg day")
- Warm pero directo. Motivador sin ser cursi.
- Palabras permitidas: "brutal", "súper", "chévere", "pa'lante", "échale", "fuego", "enfocao"
- NUNCA corporate, nunca emojis excesivos (máx 2-3 por caption)
- Celebra la comunidad local. Menciona la ubicación específica cuando aplique.
- Hablale al miembro como si fuera tu pana.

## Tipos de post
- **Motivación**: Story arc — problema (falta de motivación) → proceso (show up even when you don't feel like it) → transformación
- **Promo**: Ofrece el Free Trial de 7 días. CTA fuerte. ManyChat keyword.
- **Testimonio**: POV de un miembro. Específico, no genérico. "X resultado en Y tiempo."
- **Tip**: Consejo accionable. Un solo tip por post. Claro, práctico, puertorra-friendly.
- **Evento**: Clase especial, challenge, anuncio. Fecha + ubicación + CTA.

## Estructura narrativa (Problema → Proceso → Transformación)
Todo el contenido necesita arco: el viewer es el protagonista, WestSide es la guía. NO listas de features.

## ManyChat CTA
Siempre incluye un keyword CTA estilo: "Comenta [KEYWORD] y te mando [resource]". Keywords sugeridos según post type:
- Motivación/Testimonio → ENTRENA (guía de arranque)
- Promo → GRATIS (info del free trial)
- Tip → TIP (mini-guía PDF)
- Evento → CLASE (detalles + registro)

## Hashtags
Mix de locales PR + fitness generales. Siempre incluye #westsidefitness + la ubicación (#westsidecaguas, #westsidesanjuan, #westsidebayamon). Máx 12 hashtags.

## Reel script (15s)
Estructura obligatoria:
- **Hook (0-2s)**: Pattern interrupt. Visual o pregunta fuerte.
- **Beat 1 (2-6s)**: Contexto/problema
- **Beat 2 (6-10s)**: Proceso/solución
- **Beat 3 (10-13s)**: Transformación/payoff
- **CTA (13-15s)**: ManyChat keyword + follow

Cada beat incluye: VOICEOVER (qué se dice) + VISUAL (qué se ve/hace en cámara).

Output SOLO JSON válido (sin markdown, sin comentarios) en esta estructura exacta:
{
  "hooks": [
    "Variante 1 (máx 10 palabras, pattern interrupt)",
    "Variante 2 (máx 10 palabras, pregunta)",
    "Variante 3 (máx 10 palabras, shock/stat)"
  ],
  "caption_short": "1-2 oraciones punchy. Incluye CTA ManyChat. <280 caracteres.",
  "caption_medium": "3-5 oraciones con arco narrativo (problema→proceso→transformación). Incluye CTA ManyChat al final. <600 caracteres.",
  "reel_script": {
    "hook": { "voiceover": "...", "visual": "..." },
    "beat_1": { "voiceover": "...", "visual": "..." },
    "beat_2": { "voiceover": "...", "visual": "..." },
    "beat_3": { "voiceover": "...", "visual": "..." },
    "cta": { "voiceover": "...", "visual": "..." }
  },
  "manychat": {
    "keyword": "PALABRA (una sola palabra en mayúsculas)",
    "trigger_line": "La línea exacta dentro del caption que instruye comentar el keyword"
  },
  "hashtags": ["#hashtag1", "#hashtag2", "..."],
  "best_time": "Mejor hora sugerida para publicar (ej: 'Lunes 6:00pm - post-work scroll peak')",
  "image_prompt": "Prompt detallado listo para Nano Banana/MidJourney. Describe: escena, ángulo, lighting, mood, branding cues (rojo/amarillo accent OK). Solo texto, sin instrucciones técnicas."
}`;

    const userPrompt = `Genera contenido para:
- Ubicación: ${location}
- Tipo de post: ${postType}
- Formato: ${format || 'Reel'}
- Tema/ángulo: ${topic}`;

    try {
        const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2500,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        });

        const text = response.content[0].text.trim();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('Unexpected AI response format');

        const parsed = JSON.parse(jsonMatch[0]);

        if (
            !Array.isArray(parsed.hooks) || parsed.hooks.length < 3 ||
            !parsed.caption_short || !parsed.caption_medium ||
            !parsed.reel_script?.hook || !parsed.manychat?.keyword ||
            !Array.isArray(parsed.hashtags)
        ) {
            throw new Error('Invalid structure from AI');
        }

        await logDemo(
            'westside-content',
            `${location} - ${postType} - ${topic.slice(0, 60)}`,
            parsed,
            { location, postType, format }
        );

        return res.status(200).json(parsed);
    } catch (err) {
        console.error('content-gen error:', err);
        return res.status(500).json({ error: 'Error generando contenido. Trata de nuevo.' });
    }
}
