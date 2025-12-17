import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/route';

export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.accessToken) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { senderEmail } = await req.json();

        if (!senderEmail) {
            return NextResponse.json({
                error: 'Email del remitente requerido'
            }, { status: 400 });
        }

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({
            access_token: session.accessToken
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const result = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 500,
            q: `from:${senderEmail}`
        });

        const totalEmails = (result.data.messages || []).length;

        return NextResponse.json({
            success: true,
            total: totalEmails,
            senderEmail
        });

    } catch (error) {
        console.error('Error al contar correos:', error);
        return NextResponse.json(
            {
                error: 'Error al contar correos',
                details: error.message,
                success: false
            },
            { status: 500 }
        );
    }
}