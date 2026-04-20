// WestSide Fitness — Free Trial form submit handler
// Simula: AI lead scoring + WhatsApp confirmation + email al staff
// Para la versión de producción: conectar Twilio/Meta WhatsApp + Supabase + Resend

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name, phone, email, location, goal } = req.body || {};

    if (!name || !phone || !email || !location || !goal) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    // AI Lead Scoring — simulado (en producción: llamada a Claude con perfil del lead)
    const score = scoreLead({ goal, location, email, phone });

    // WhatsApp preview — lo que el lead recibiría en su teléfono
    const whatsappPreview = buildWhatsAppMessage({ name, location, goal });

    // En producción aquí iría:
    // 1. await supabase.from('leads').insert({...})
    // 2. await twilioClient.messages.create({ to: phone, body: whatsappPreview })
    // 3. await resend.emails.send({ to: staff[location], ... })
    // 4. await n8n.trigger('westside-new-lead', {...})

    return res.status(200).json({
        ok: true,
        score,
        whatsappPreview,
        timestamp: new Date().toISOString(),
    });
}

function scoreLead({ goal, location, email, phone }) {
    let score = 60;
    if (goal && goal !== 'Otro') score += 15;
    if (location) score += 10;
    if (email.includes('@') && !email.includes('test')) score += 8;
    if (phone.replace(/\D/g, '').length >= 10) score += 7;
    return Math.min(99, score + Math.floor(Math.random() * 10));
}

function buildWhatsAppMessage({ name, location, goal }) {
    const firstName = name.split(' ')[0];
    return `¡Hola ${firstName}! 💪 Soy Alex de WestSide Fitness ${location}.

Recibimos tu solicitud de Free Trial 7 días. Tu pase está activo desde hoy.

🎯 Objetivo: ${goal}
📍 Ubicación: ${location}
🕐 Próximo paso: Te asigné una sesión de orientación gratis. ¿Mañana 6pm o pasado 10am?

Contesta con el horario que prefieras y te confirmo. ¡Nos vemos pronto!`;
}
