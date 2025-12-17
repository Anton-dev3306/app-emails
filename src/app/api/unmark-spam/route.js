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

        //Proceso de busqueda de TODOS los correos en spam del remitente
        let allSpamMessages = [];
        let pageToken = null;
        let iterations = 0;
        const maxIterations = 50;

      

        do {
            try {
                const searchResponse = await gmail.users.messages.list({
                    userId: 'me',
                    maxResults: 500,
                    q: `from:${senderEmail}`,
                    labelIds: ['SPAM'],
                    pageToken: pageToken,
                    includeSpamTrash: true
                });

                const messages = searchResponse.data.messages || [];

                if (messages.length > 0) {
                    allSpamMessages = [...allSpamMessages, ...messages];
                    console.log(`Iteración ${iterations + 1}: +${messages.length} en spam. Total: ${allSpamMessages.length}`);
                }

                pageToken = searchResponse.data.nextPageToken;
                iterations++;

                // Continuar hasta que no haya más páginas
                if (pageToken) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } catch (error) {
                console.error('Error en búsqueda:', error);
                // Si falla con labelIds, intentar con query
                if (error.message.includes('label')) {
                    console.log('Reintentando con query `in:spam`...');
                    try {
                        const searchResponse = await gmail.users.messages.list({
                            userId: 'me',
                            maxResults: 500,
                            q: `from:${senderEmail} in:spam`,
                            pageToken: pageToken,
                            includeSpamTrash: true
                        });
                        const messages = searchResponse.data.messages || [];
                        if (messages.length > 0) {
                            allSpamMessages = [...allSpamMessages, ...messages];
                        }
                        pageToken = searchResponse.data.nextPageToken;
                    } catch (retryError) {
                        console.error('Reintento falló:', retryError);
                        break;
                    }
                } else {
                    break;
                }
            }
        } while (pageToken && iterations < maxIterations);

        if (allSpamMessages.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No hay correos en spam de este remitente',
                details: {
                    totalFound: 0,
                    restoredToInbox: 0,
                    filtersRemoved: 0,
                    senderEmail,
                    senderName: sender
                },
                summary: `No se encontraron correos en spam de ${sender}.`
            });
        }


        // Restaurar TODOS los correos en lotes grandes
        let restoredCount = 0;
        const batchSize = 1000;
        const batches = Math.ceil(allSpamMessages.length / batchSize);

        console.log(`Restaurando en ${batches} lotes de hasta ${batchSize} correos...`);

        for (let i = 0; i < allSpamMessages.length; i += batchSize) {
            const batch = allSpamMessages.slice(i, i + batchSize);
            const messageIds = batch.map(m => m.id);

            try {
                await gmail.users.messages.batchModify({
                    userId: 'me',
                    requestBody: {
                        ids: messageIds,
                        addLabelIds: ['INBOX'],
                        removeLabelIds: ['SPAM']
                    }
                });

                restoredCount += messageIds.length;
                console.log(`Restaurados: ${restoredCount}/${allSpamMessages.length} (${Math.round(restoredCount/allSpamMessages.length*100)}%)`);
            } catch (error) {
                console.error(`Error en lote ${Math.floor(i/batchSize) + 1}:`, error.message);
            }

            // Pequeña pausa entre lotes
            if (i + batchSize < allSpamMessages.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // Eliminar TODOS los filtros que envían correos a spam
        let filtersRemoved = 0;
        try {
            const filtersResponse = await gmail.users.settings.filters.list({
                userId: 'me'
            });

            const filters = filtersResponse.data.filter || [];

            for (const filter of filters) {
                // Buscar filtros que envíen este remitente a spam
                const matchesSender =
                    filter.criteria?.from === senderEmail ||
                    (filter.criteria?.query && filter.criteria.query.includes(senderEmail));

                const sendsToSpam =
                    filter.action?.addLabelIds?.includes('SPAM') ||
                    filter.action?.addLabelIds?.includes('TRASH');

                if (matchesSender && sendsToSpam) {
                    await gmail.users.settings.filters.delete({
                        userId: 'me',
                        id: filter.id
                    });
                    filtersRemoved++;
                    console.log(`Filtro eliminado: ${filter.id}`);
                }
            }
        } catch (error) {
            console.error('Error eliminando filtros:', error);
        }

        // Marcar los primeros 20 como no leídos
        try {
            if (allSpamMessages.length > 0) {
                const recentMessages = allSpamMessages.slice(0, 20);
                const messageIds = recentMessages.map(m => m.id);

                await gmail.users.messages.batchModify({
                    userId: 'me',
                    requestBody: {
                        ids: messageIds,
                        addLabelIds: ['UNREAD'],
                        removeLabelIds: []
                    }
                });
                console.log(`📬 ${messageIds.length} correos marcados como no leídos`);
            }
        } catch (error) {
            console.log('No se pudieron marcar como no leídos:', error);
        }

        const successRate = Math.round((restoredCount / allSpamMessages.length) * 100);

        return NextResponse.json({
            success: true,
            message: `${restoredCount} correos restaurados`,
            details: {
                totalFound: allSpamMessages.length,
                restoredToInbox: restoredCount,
                successRate: successRate,
                filtersRemoved,
                senderEmail,
                senderName: sender,
                iterations: iterations
            },
            summary: filtersRemoved > 0
                ? `${restoredCount} de ${allSpamMessages.length} correos (${successRate}%) de ${sender} restaurados y ${filtersRemoved} filtro(s) eliminado(s).`
                : `${restoredCount} de ${allSpamMessages.length} correos (${successRate}%) de ${sender} restaurados.`
        });

    } catch (error) {
        console.error('Error desmarcando spam:', error);
        return NextResponse.json(
            {
                error: 'Error al desmarcar spam',
                details: error.message,
                success: false
            },
            { status: 500 }
        );
    }
}

// Función GET sin cambios
export async function GET(req) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.accessToken) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const senderEmail = searchParams.get('senderEmail');

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

        // Contar cuántos correos hay en spam del remitente
        const countResponse = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 1,
            q: `from:${senderEmail} in:spam`,
            includeSpamTrash: true
        });

        const estimatedCount = countResponse.data.resultSizeEstimate || 0;

        return NextResponse.json({
            success: true,
            senderEmail,
            spamCount: estimatedCount,
            message: estimatedCount > 0
                ? `Se encontraron ${estimatedCount} correos en spam de este remitente`
                : 'No hay correos en spam de este remitente'
        });

    } catch (error) {
        console.error('Error obteniendo información:', error);
        return NextResponse.json(
            {
                error: 'Error al obtener información',
                details: error.message,
                success: false
            },
            { status: 500 }
        );
    }
}