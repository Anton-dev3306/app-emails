import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/route';

export async function POST() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.accessToken) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({
            access_token: session.accessToken
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Obtener lista de mensajes
        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 100,
            q: 'unsubscribe OR subscription OR newsletter'
        });

        const messages = response.data.messages || [];

        // Obtener detalles de los primeros 20 mensajes
        const emailDetails = await Promise.all(
            messages.slice(0, 20).map(async (message) => {
                const detail = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                    format: 'metadata',
                    metadataHeaders: ['From', 'Subject', 'Date']
                });

                const headers = detail.data.payload?.headers || [];
                const from = headers.find(h => h.name === 'From')?.value || '';
                const subject = headers.find(h => h.name === 'Subject')?.value || '';

                return { from, subject };
            })
        );

        // Agrupar por remitente
        const senderMap = new Map();

        emailDetails.forEach(email => {
            const emailMatch = email.from.match(/<(.+?)>/) || email.from.match(/(\S+@\S+)/);
            const senderEmail = emailMatch?.[1] || email.from;

            if (!senderMap.has(senderEmail)) {
                senderMap.set(senderEmail, {
                    sender: email.from.split('<')[0].trim(),
                    senderEmail,
                    totalEmails: 0,
                    category: 'Otro',
                    frequency: 'Ocasional'
                });
            }
            senderMap.get(senderEmail).totalEmails++;
        });

        // Convertir a array y filtrar
        const subscriptions = Array.from(senderMap.values())
            .filter(s => s.totalEmails >= 2)
            .map(s => ({
                ...s,
                frequency: s.totalEmails > 10 ? 'Frecuente' : 
                          s.totalEmails > 5 ? 'Regular' : 'Ocasional',
                category: determineCategoryFromEmail(s.sender, s.senderEmail)
            }));

        return NextResponse.json({ subscriptions });

    } catch (error) {
        console.error('Error en el análisis:', error);
        return NextResponse.json(
            { error: 'Error en el análisis de correos', details: error.message },
            { status: 500 }
        );
    }
}

function determineCategoryFromEmail(sender, email) {
    const text = (sender + email).toLowerCase();
    if (text.includes('github') || text.includes('linkedin')) return 'Profesional';
    if (text.includes('shop') || text.includes('store') || text.includes('buy')) return 'Comercial';
    if (text.includes('news') || text.includes('newsletter')) return 'Noticias';
    if (text.includes('social') || text.includes('community')) return 'Social';
    return 'Otro';
}