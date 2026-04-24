// Mock tools for ContextAgent — hardcoded WestSide data.
// In production these hit Jonas API + Supabase; for the prototype they're static.

const CLASSES = {
    'Caguas': [
        { day: 'Lun', time: '5:30am · 6:00pm', class: 'CrossFit WOD' },
        { day: 'Mar', time: '6:00pm', class: 'Zumba PR' },
        { day: 'Mié', time: '5:30am · 7:00pm', class: 'HIIT + Core' },
        { day: 'Jue', time: '6:00pm', class: 'Spinning' },
        { day: 'Vie', time: '6:00pm', class: 'Leg Day Guiado' },
        { day: 'Sáb', time: '9:00am', class: 'Open Gym + Stretch' },
    ],
    'San Juan': [
        { day: 'Lun', time: '6:00am · 6:30pm', class: 'Functional Training' },
        { day: 'Mar', time: '7:00pm', class: 'Yoga Flow' },
        { day: 'Mié', time: '6:30pm', class: 'Box + Strength' },
        { day: 'Jue', time: '6:30pm', class: 'Spinning' },
        { day: 'Vie', time: '6:30pm', class: 'Full Body Burn' },
        { day: 'Sáb', time: '10:00am', class: 'Community WOD' },
    ],
    'Bayamón': [
        { day: 'Lun', time: '5:30am · 7:00pm', class: 'Strength Circuit' },
        { day: 'Mar', time: '7:00pm', class: 'Zumba + Reggaeton' },
        { day: 'Mié', time: '6:00pm', class: 'HIIT' },
        { day: 'Jue', time: '7:00pm', class: 'Mobility + Core' },
        { day: 'Vie', time: '6:30pm', class: 'Leg Day' },
        { day: 'Sáb', time: '9:30am', class: 'Saturday Burn' },
    ],
};

const PROMOS = {
    'Caguas': [
        { name: 'Free Trial 7 días', ends: 'vigente', copy_hint: 'sin tarjeta, sin compromiso' },
        { name: 'Miembro trae miembro', ends: 'vigente', copy_hint: '$0 de inscripción para ambos' },
    ],
    'San Juan': [
        { name: 'Free Trial 7 días', ends: 'vigente', copy_hint: 'sin tarjeta, sin compromiso' },
        { name: 'Plan anual pre-pagado', ends: 'fin de mes', copy_hint: '2 meses gratis' },
    ],
    'Bayamón': [
        { name: 'Free Trial 7 días', ends: 'vigente', copy_hint: 'sin tarjeta, sin compromiso' },
        { name: 'Estudiante universitario', ends: 'vigente', copy_hint: '$19.99/mo con ID válido' },
    ],
};

const RECENT_POSTS = {
    'Caguas': [
        { date: '2d ago', topic: 'leg day motivation', type: 'Motivación' },
        { date: '4d ago', topic: 'community spotlight Juan R.', type: 'Testimonio' },
        { date: '7d ago', topic: 'clases de lunes', type: 'Tip' },
    ],
    'San Juan': [
        { date: '1d ago', topic: 'yoga flow beginners', type: 'Tip' },
        { date: '3d ago', topic: 'Saturday WOD recap', type: 'Evento' },
        { date: '6d ago', topic: 'free trial reminder', type: 'Promo' },
    ],
    'Bayamón': [
        { date: '2d ago', topic: 'Zumba reggaeton hype', type: 'Evento' },
        { date: '5d ago', topic: 'morning routine shift', type: 'Motivación' },
        { date: '8d ago', topic: 'plan estudiante', type: 'Promo' },
    ],
};

const IG_INSIGHTS = {
    'Caguas': { best_time: 'Lun 6:30pm · Sáb 10am', top_format: 'Reel', engagement_rate: '4.2%' },
    'San Juan': { best_time: 'Mar 7pm · Jue 6pm', top_format: 'Reel', engagement_rate: '3.8%' },
    'Bayamón': { best_time: 'Lun 6pm · Vie 7pm', top_format: 'Carrusel', engagement_rate: '4.5%' },
};

// Tool schemas exposed to ContextAgent (Anthropic tool_use format)
export const CONTEXT_TOOLS = [
    {
        name: 'get_weekly_classes',
        description: 'Returns the weekly class schedule for a specific WestSide location.',
        input_schema: {
            type: 'object',
            properties: {
                location: { type: 'string', enum: ['Caguas', 'San Juan', 'Bayamón'] },
            },
            required: ['location'],
        },
    },
    {
        name: 'get_active_promos',
        description: 'Returns active promotions/offers for a specific location.',
        input_schema: {
            type: 'object',
            properties: {
                location: { type: 'string', enum: ['Caguas', 'San Juan', 'Bayamón'] },
            },
            required: ['location'],
        },
    },
    {
        name: 'get_recent_posts',
        description: 'Returns the last 3 published posts for a location so we avoid repeating topics.',
        input_schema: {
            type: 'object',
            properties: {
                location: { type: 'string', enum: ['Caguas', 'San Juan', 'Bayamón'] },
            },
            required: ['location'],
        },
    },
    {
        name: 'get_ig_insights',
        description: 'Returns cached Instagram Insights for the location: best posting time, top format, engagement rate.',
        input_schema: {
            type: 'object',
            properties: {
                location: { type: 'string', enum: ['Caguas', 'San Juan', 'Bayamón'] },
            },
            required: ['location'],
        },
    },
];

export function runTool(name, input) {
    const loc = input?.location;
    switch (name) {
        case 'get_weekly_classes': return CLASSES[loc] || [];
        case 'get_active_promos': return PROMOS[loc] || [];
        case 'get_recent_posts': return RECENT_POSTS[loc] || [];
        case 'get_ig_insights': return IG_INSIGHTS[loc] || null;
        default: return { error: `unknown tool: ${name}` };
    }
}

// Brand voice KB — used by CopyAgent. In production this is a Supabase table.
export const BRAND_VOICE = {
    identity: 'WestSide Fitness Club · única cadena 100% puertorriqueña · 3 locations (Caguas, San Juan, Bayamón) · 20 años operando PR',
    tone: 'Spanglish PR natural, warm pero directo. Motivador sin ser cursi.',
    vocabulary_yes: ['brutal', 'súper', 'chévere', 'pa\'lante', 'échale', 'fuego', 'enfocao', 'reps', 'gainz', 'sets', 'cardio', 'leg day'],
    vocabulary_no: ['team', 'nuestra familia fit', 'corporate wellness', 'elite athlete community'],
    arc: 'Problema → Proceso → Transformación. Viewer es el protagonista, WestSide la guía.',
    emoji_policy: 'máx 2-3 por caption, nunca overused',
    hashtags_required: ['#westsidefitness'],
    hashtag_by_location: {
        'Caguas': '#westsidecaguas',
        'San Juan': '#westsidesanjuan',
        'Bayamón': '#westsidebayamon',
    },
    manychat_keywords: {
        'Motivación': 'ENTRENA',
        'Testimonio': 'ENTRENA',
        'Promo': 'GRATIS',
        'Tip': 'TIP',
        'Evento': 'CLASE',
    },
};
