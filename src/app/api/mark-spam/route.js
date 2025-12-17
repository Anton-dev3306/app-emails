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

        const { senderEmail, sender, totalEmails } = await req.json();

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

        //Proceso de busqueda de todos los correos del remitente
        let allMessages = [];
        let pageToken = null;
        let iterations = 0;
        const maxIterations = 50;
        do {
            try {
                const searchResponse = await gmail.users.messages.list({
                    userId: 'me',
                    maxResults: 500,
                    q: `from:${senderEmail}`,
                    pageToken: pageToken,
                    includeSpamTrash: true
                });

                const messages = searchResponse.data.messages || [];

                if (messages.length > 0) {
                    allMessages = [...allMessages, ...messages];
                    console.log(`Iteración ${iterations + 1}: +${messages.length} correos. Total: ${allMessages.length}/${totalEmails || '?'}`);
                }

                pageToken = searchResponse.data.nextPageToken;
                iterations++;

                // Continuar hasta que no haya más páginas O alcancemos el total esperado
                if (pageToken && totalEmails && allMessages.length >= totalEmails) {
                    console.log(`Alcanzado el total esperado: ${allMessages.length}`);
                    break;
                }

                if (pageToken) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } catch (error) {
                console.error('Error en búsqueda:', error);
                break;
            }
        } while (pageToken && iterations < maxIterations);

        if (allMessages.length === 0) {
            return NextResponse.json({
                error: 'No se encontraron correos de este remitente',
                success: false
            }, { status: 404 });
        }

        console.log(`TOTAL encontrado: ${allMessages.length} correos de ${senderEmail}`);

        // Marcar TODOS como SPAM en lotes grandes
        let markedCount = 0;
        const batchSize = 1000;
        const batches = Math.ceil(allMessages.length / batchSize);

        console.log(`Marcando spam en ${batches} lotes de hasta ${batchSize} correos...`);

        for (let i = 0; i < allMessages.length; i += batchSize) {
            const batch = allMessages.slice(i, i + batchSize);
            const messageIds = batch.map(m => m.id);

            try {
                await gmail.users.messages.batchModify({
                    userId: 'me',
                    requestBody: {
                        ids: messageIds,
                        addLabelIds: ['SPAM'],
                        removeLabelIds: ['INBOX', 'UNREAD']
                    }
                });

                markedCount += messageIds.length;
                console.log(`Spam: ${markedCount}/${allMessages.length} (${Math.round(markedCount/allMessages.length*100)}%)`);
            } catch (error) {
                console.error(`Error en lote ${Math.floor(i/batchSize) + 1}:`, error.message);
            }

            // Pequeña pausa entre lotes
            if (i + batchSize < allMessages.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Crear filtro para correos futuros
        let filterCreated = false;
        try {
            await gmail.users.settings.filters.create({
                userId: 'me',
                requestBody: {
                    criteria: {
                        from: senderEmail
                    },
                    action: {
                        addLabelIds: ['SPAM'],
                        removeLabelIds: ['INBOX', 'UNREAD']
                    }
                }
            });
            filterCreated = true;
            console.log(`Filtro de spam creado para ${senderEmail}`);
        } catch (error) {
            console.error('Error creando filtro:', error.message);
        }

        const successRate = Math.round((markedCount / allMessages.length) * 100);

        return NextResponse.json({
            success: true,
            message: `${markedCount} correos marcados como spam`,
            details: {
                totalFound: allMessages.length,
                markedAsSpam: markedCount,
                successRate: successRate,
                filterCreated,
                senderEmail,
                senderName: sender,
                iterations: iterations
            },
            summary: filterCreated
                ? `${markedCount} de ${allMessages.length} correos (${successRate}%) de ${sender} marcados como spam y filtro creado.`
                : `${markedCount} de ${allMessages.length} correos (${successRate}%) de ${sender} marcados como spam.`
        });

    } catch (error) {
        console.error('Error marcando como spam:', error);
        return NextResponse.json(
            {
                error: 'Error al marcar como spam',
                details: error.message,
                success: false
            },
            { status: 500 }
        );
    }
}