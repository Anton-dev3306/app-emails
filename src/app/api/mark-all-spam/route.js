import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../auth/[...nextauth]/route';

export async function POST(request) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                const session = await getServerSession(authOptions);

                if (!session?.accessToken) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'error',
                        error: 'No autorizado'
                    })}\n\n`));
                    controller.close();
                    return;
                }

                const body = await request.json();
                const { subscriptions } = body;

                if (!subscriptions || subscriptions.length === 0) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'error',
                        error: 'No hay newsletters para marcar como spam'
                    })}\n\n`));
                    controller.close();
                    return;
                }

                const oauth2Client = new google.auth.OAuth2();
                oauth2Client.setCredentials({
                    access_token: session.accessToken
                });

                const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'start',
                    message: `Iniciando marcado masivo de ${subscriptions.length} newsletters...`,
                    totalNewsletters: subscriptions.length
                })}\n\n`));

                let totalMarked = 0;
                let totalFiltersCreated = 0;
                const processedNewsletters = [];

                for (let i = 0; i < subscriptions.length; i++) {
                    const sub = subscriptions[i];

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'processing',
                        current: i + 1,
                        total: subscriptions.length,
                        newsletter: sub.sender,
                        message: `Procesando ${sub.sender} (${i + 1}/${subscriptions.length})...`
                    })}\n\n`));

                    try {
                        //Busqueda de todos los correos por cada remitentes
                        let allMessages = [];
                        let pageToken = null;
                        let iterations = 0;
                        const maxIterations = Math.ceil((sub.totalEmails || 100) / 500) + 2;

                        do {
                            const searchResponse = await gmail.users.messages.list({
                                userId: 'me',
                                maxResults: 500,
                                q: `from:${sub.email}`,
                                pageToken: pageToken,
                                includeSpamTrash: true
                            });

                            const messages = searchResponse.data.messages || [];
                            allMessages = [...allMessages, ...messages];

                            pageToken = searchResponse.data.nextPageToken;
                            iterations++;

                            if (pageToken && allMessages.length >= (sub.totalEmails || 0)) {
                                break;
                            }
                        } while (pageToken && iterations < maxIterations);

                        //Se marca como spam en lotes(por remitente)
                        if (allMessages.length > 0) {
                            const batchSize = 1000;
                            for (let j = 0; j < allMessages.length; j += batchSize) {
                                const batch = allMessages.slice(j, j + batchSize);
                                const messageIds = batch.map(m => m.id);

                                await gmail.users.messages.batchModify({
                                    userId: 'me',
                                    requestBody: {
                                        ids: messageIds,
                                        addLabelIds: ['SPAM'],
                                        removeLabelIds: ['INBOX', 'UNREAD']
                                    }
                                });

                                totalMarked += messageIds.length;

                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                    type: 'marked',
                                    current: i + 1,
                                    total: subscriptions.length,
                                    totalMarked: totalMarked,
                                    newsletter: sub.sender,
                                    markedInNewsletter: messageIds.length,
                                    message: `${totalMarked} correos marcados como spam...`
                                })}\n\n`));
                            }
                        }

                        //Se crea el filtro para marcar como spam futuros correos de ese remitente
                        try {
                            await gmail.users.settings.filters.create({
                                userId: 'me',
                                requestBody: {
                                    criteria: {
                                        from: sub.email
                                    },
                                    action: {
                                        addLabelIds: ['SPAM'],
                                        removeLabelIds: ['INBOX', 'UNREAD']
                                    }
                                }
                            });
                            totalFiltersCreated++;
                        } catch (filterError) {
                            console.log(`Filtro no creado para ${sub.email}:`, filterError.message);
                        }

                        processedNewsletters.push({
                            email: sub.email,
                            sender: sub.sender,
                            totalEmails: allMessages.length,
                            marked: allMessages.length
                        });

                    } catch (error) {
                        console.error(`Error procesando ${sub.email}:`, error);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                            type: 'error_newsletter',
                            newsletter: sub.sender,
                            error: error.message
                        })}\n\n`));
                    }
                }

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'complete',
                    totalMarked: totalMarked,
                    totalFiltersCreated: totalFiltersCreated,
                    processedNewsletters: processedNewsletters,
                    message: `¡Completado! ${totalMarked} correos marcados como spam y ${totalFiltersCreated} filtros creados.`
                })}\n\n`));

                controller.close();

            } catch (error) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'Error en el marcado masivo',
                    details: error.message
                })}\n\n`));
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}