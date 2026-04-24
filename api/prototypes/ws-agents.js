// Claude helper calls for the WestSide Content Studio prototype.
// The public prototype presents three stages: Strategy, Copy, and QA.
// Context and visual generation run as internal substeps.

import Anthropic from '@anthropic-ai/sdk';
import { CONTEXT_TOOLS, runTool, BRAND_VOICE } from './ws-tools.js';

const SONNET = process.env.WESTSIDE_SONNET_MODEL || 'claude-sonnet-4-6';
const HAIKU = process.env.WESTSIDE_HAIKU_MODEL || 'claude-haiku-4-5-20251001';

function client() { return new Anthropic(); }

// --------------------------------------------------------------------
// Feedback formatters — shared by Strategist + Copy
// --------------------------------------------------------------------
function formatFeedbackBlock(feedback) {
    if (!feedback || feedback.length === 0) return '';
    const rules = feedback.map((f, i) => `  ${i + 1}. ${f.rule}${f.notes ? ` — ${f.notes}` : ''}`).join('\n');
    return `\nCalibración acumulada (aplicar SIEMPRE, orden = más reciente primero):\n${rules}\n`;
}

function formatFeedbackSystemBlock(feedback) {
    if (!feedback || feedback.length === 0) return '';
    const rules = feedback.map((f, i) => `${i + 1}. ${f.rule}${f.notes ? ` (${f.notes})` : ''}`).join('\n');
    return `\n## Calibración acumulada (overrides obligatorios, más reciente primero)\n${rules}\nAplica TODAS estas reglas. Si hay conflicto con el Brand voice KB, gana la calibración más reciente.\n`;
}

// --------------------------------------------------------------------
// Regenerate element — ephemeral sub-run for "Regenerar hooks" / "Regenerar caption"
// --------------------------------------------------------------------
export async function regenerateElement({ element, currentDraft, strategy, context, input, feedback = [], nudge = '' }) {
    if (!['hooks', 'caption', 'hashtags'].includes(element)) {
        throw new Error(`Invalid element: ${element}`);
    }

    const feedbackSystemBlock = formatFeedbackSystemBlock(feedback);
    const nudgeLine = nudge ? `\nNudge específico para esta regeneración: ${nudge}` : '';

    const system = `Eres CopyAgent regenerando un elemento específico del draft. Voz WestSide (spanglish PR, warm, directo).

Brand voice KB:
${JSON.stringify(BRAND_VOICE, null, 2)}
${feedbackSystemBlock}
## Guardia de profanity (REGLA DURA)
NUNCA uses ninguna palabra de \`vocabulary_prohibited\` — son slang PR soez inapropiado para un negocio familiar. Regla absoluta.

Genera SOLO el elemento "${element}" — mantén coherencia con el resto del draft existente.${nudgeLine}

Output SOLO JSON válido según el elemento:
${element === 'hooks' ? '{ "hooks": ["v1 ≤10 palabras", "v2 ≤10 palabras", "v3 ≤10 palabras"] }' : ''}${element === 'caption' ? '{ "caption_short": "≤280 chars con CTA ManyChat", "caption_medium": "≤600 chars con arco completo + CTA ManyChat" }' : ''}${element === 'hashtags' ? '{ "hashtags": ["≤12 items, incluye #westsidefitness + hashtag de ubicación"] }' : ''}`;

    const user = `Draft actual (NO lo regeneres completo, solo el elemento pedido):
${JSON.stringify({
    hooks: currentDraft.hooks,
    caption_short: currentDraft.caption_short,
    caption_medium: currentDraft.caption_medium,
    hashtags: currentDraft.hashtags,
    manychat: currentDraft.manychat,
}, null, 2)}

Estrategia original:
${JSON.stringify(strategy, null, 2)}

Input:
${JSON.stringify(input, null, 2)}

Regenera SOLO "${element}".`;

    const resp = await client().messages.create({
        model: SONNET,
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: user }],
    });
    const text = resp.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(`regenerateElement(${element}): no JSON`);
    return JSON.parse(match[0]);
}

// --------------------------------------------------------------------
// ContextAgent — pulls fresh data via tool_use loop
// --------------------------------------------------------------------
export async function contextAgent({ location }) {
    const c = client();
    const system = `Eres ContextAgent. Tu única tarea: reunir contexto operacional de una ubicación de WestSide Fitness usando las tools disponibles. Llama las 4 tools (get_weekly_classes, get_active_promos, get_recent_posts, get_ig_insights) para la ubicación dada, y al final devuelve un resumen JSON estructurado con: { classes_this_week, active_promos, recent_topics, best_time, engagement_signal }. No inventes data. No escribas copy — solo estructura.`;

    const messages = [{ role: 'user', content: `Ubicación: ${location}. Reúne todo el contexto.` }];

    // Tool loop
    for (let i = 0; i < 6; i++) {
        const resp = await c.messages.create({
            model: HAIKU,
            max_tokens: 1500,
            system,
            tools: CONTEXT_TOOLS,
            messages,
        });

        if (resp.stop_reason === 'tool_use') {
            const toolUses = resp.content.filter(b => b.type === 'tool_use');
            messages.push({ role: 'assistant', content: resp.content });
            messages.push({
                role: 'user',
                content: toolUses.map(tu => ({
                    type: 'tool_result',
                    tool_use_id: tu.id,
                    content: JSON.stringify(runTool(tu.name, tu.input)),
                })),
            });
            continue;
        }

        // end_turn — expect final text with JSON
        const text = resp.content.find(b => b.type === 'text')?.text || '';
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error('ContextAgent: no JSON in final output');
        return JSON.parse(match[0]);
    }
    throw new Error('ContextAgent: tool loop exceeded');
}

// --------------------------------------------------------------------
// StrategistAgent — decides angle, format, hook archetype
// --------------------------------------------------------------------
export async function strategistAgent({ context, input, feedback = [] }) {
    const system = `Eres StrategistAgent. Dado el contexto operacional y la intención del post, decides la estrategia creativa. Salida SOLO JSON válido, sin markdown:
{
  "narrative_arc": "Problema → Proceso → Transformación explícito (1 oración por paso)",
  "hook_archetype": "pattern-interrupt | pregunta | shock-stat | contradicción",
  "recommended_format": "Reel | Carrusel | Static",
  "audience_emotional_state": "frase corta",
  "angle": "1 oración con el ángulo específico",
  "manychat_goal": "qué lead-gen objetivo (si aplica, ej: free-trial signup | guía PDF | info clase)"
}`;

    const feedbackBlock = formatFeedbackBlock(feedback);
    const user = `Contexto:\n${JSON.stringify(context, null, 2)}\n\nInput:\n- Ubicación: ${input.location}\n- Tipo: ${input.post_type}\n- Formato solicitado: ${input.format}\n- Tema: ${input.topic}\n${feedbackBlock}\nDecide la estrategia.`;

    const resp = await client().messages.create({
        model: SONNET,
        max_tokens: 800,
        system,
        messages: [{ role: 'user', content: user }],
    });
    const text = resp.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('StrategistAgent: no JSON');
    return JSON.parse(match[0]);
}

// --------------------------------------------------------------------
// CopyAgent — hooks + captions + reel script in WestSide voice
// --------------------------------------------------------------------
export async function copyAgent({ context, strategy, input, feedback = [] }) {
    const isReel = input?.format === 'Reel';
    const feedbackSystemBlock = formatFeedbackSystemBlock(feedback);

    const reelSchema = `  "reel_script": {
    "hook": { "voiceover": "...", "visual": "..." },
    "beat_1": { "voiceover": "...", "visual": "..." },
    "beat_2": { "voiceover": "...", "visual": "..." },
    "beat_3": { "voiceover": "...", "visual": "..." },
    "cta": { "voiceover": "...", "visual": "..." }
  },
`;

    const system = `Eres CopyAgent. Redactas en voz WestSide Fitness Club — spanglish PR auténtico, warm, directo.

Brand voice KB:
${JSON.stringify(BRAND_VOICE, null, 2)}
${feedbackSystemBlock}
## Guardia de profanity (REGLA DURA)
NUNCA uses ninguna palabra de \`vocabulary_prohibited\` — son slang PR soez inapropiado para un negocio familiar. Esta regla es absoluta, no la suavices ni por contexto creativo.

Debes aplicar el arco narrativo Problema→Proceso→Transformación que te pasa el Strategist. Nunca listas de features. Viewer es el protagonista, WestSide la guía.

Salida SOLO JSON válido, sin markdown:
{
  "hooks": ["v1 <=10 palabras", "v2 <=10 palabras", "v3 <=10 palabras"],
  "caption_short": "<=280 chars con CTA ManyChat",
  "caption_medium": "<=600 chars con arco completo + CTA ManyChat",
${isReel ? reelSchema : ''}  "manychat": { "keyword": "UNA_PALABRA", "trigger_line": "línea exacta en caption" },
  "hashtags": ["<=12 hashtags, incluye #westsidefitness + hashtag de ubicación"]
}${isReel ? '' : '\n\nFormato: ' + input.format + '. NO generes reel_script — no aplica.'}`;

    const user = `Contexto operacional:\n${JSON.stringify(context, null, 2)}\n\nEstrategia:\n${JSON.stringify(strategy, null, 2)}\n\nInput:\n${JSON.stringify(input, null, 2)}\n\nEscribe todo el copy.`;

    const resp = await client().messages.create({
        model: SONNET,
        max_tokens: isReel ? 2500 : 1600,
        system,
        messages: [{ role: 'user', content: user }],
    });
    const text = resp.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('CopyAgent: no JSON');
    return JSON.parse(match[0]);
}

// --------------------------------------------------------------------
// VisualAgent — image prompt + shoot references
// --------------------------------------------------------------------
export async function visualAgent({ context, strategy, input }) {
    const isReel = input?.format === 'Reel';

    const fullSchema = `{
  "image_prompt": "Prompt completo en inglés, describiendo escena + ángulo + lighting + mood + branding cues. ~60 palabras.",
  "shoot_references": [
    "Referencia 1 para shoot en persona (1 oración actionable)",
    "Referencia 2",
    "Referencia 3"
  ],
  "suggested_visual_beat": "qué visual es el money-shot del post"
}`;

    const minimalSchema = `{
  "image_prompt": "Prompt breve en inglés (~40 palabras) describiendo escena + mood + branding cues (rojo/amarillo WestSide OK)."
}`;

    const system = `Eres VisualAgent. ${isReel
        ? 'Generas prompt detallado de imagen + 3 shoot references para el equipo WestSide.'
        : 'Generas un prompt de imagen breve y accionable.'} Considera branding WestSide, ubicación, formato (${input.format}).

Salida SOLO JSON válido:
${isReel ? fullSchema : minimalSchema}`;

    const user = `Estrategia:\n${JSON.stringify(strategy, null, 2)}\n\nUbicación: ${input.location}. Tipo: ${input.post_type}. Formato: ${input.format}.`;

    const resp = await client().messages.create({
        model: isReel ? SONNET : HAIKU,
        max_tokens: isReel ? 1000 : 400,
        system,
        messages: [{ role: 'user', content: user }],
    });
    const text = resp.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('VisualAgent: no JSON');
    return JSON.parse(match[0]);
}

// --------------------------------------------------------------------
// QAAgent — validates + either PASS or FAIL with fixes
// --------------------------------------------------------------------
export async function qaAgent({ copy, visual, strategy }) {
    const prohibitedList = (BRAND_VOICE.vocabulary_prohibited || []).join(', ');
    const system = `Eres QAAgent. Validas contenido antes de mostrarlo al cliente. Chequeos:
1. caption_short <=280 chars
2. caption_medium <=600 chars
3. hooks: 3 variantes, cada una <=10 palabras
4. hashtags: 5-12 items, incluye #westsidefitness y hashtag de ubicación
5. ManyChat keyword es UNA palabra en mayúsculas
6. Arco narrativo Problema→Proceso→Transformación presente en caption_medium
7. Voz WestSide auténtica (spanglish PR, no corporate, no "team/family")
8. Sin promesas médicas o claims prohibidos
9. Profanity guard: contenido NO contiene ninguna de estas palabras (case-insensitive, ni siquiera embedded en otras palabras): ${prohibitedList}. Si detectas alguna → FAIL obligatorio.

Salida SOLO JSON:
{
  "status": "pass" | "fail",
  "checks": [
    { "name": "caption_short_length", "pass": true|false, "note": "..." },
    ...todos los 9 checks
  ],
  "blocker_notes": "Si fail, qué específicamente está mal. Si pass, null."
}`;

    const user = `Copy:\n${JSON.stringify(copy, null, 2)}\n\nVisual:\n${JSON.stringify(visual, null, 2)}\n\nEstrategia:\n${JSON.stringify(strategy, null, 2)}`;

    const resp = await client().messages.create({
        model: HAIKU,
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: user }],
    });
    const text = resp.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('QAAgent: no JSON');
    return JSON.parse(match[0]);
}
