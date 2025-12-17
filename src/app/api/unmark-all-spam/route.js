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
                        error: 'No hay newsletters para desmarcar'
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
                    message: `Iniciando desmarcado masivo de ${subscriptions.length} newsletters...`,
                    totalNewsletters: subscriptions.length
                })}\n\n`));

                let totalRestored = 0;
                let totalFiltersRemoved = 0;
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
                        // Buscar TODOS los correos en spam del remitente
                        let allSpamMessages = [];
                        let pageToken = null;
                        let iterations = 0;
                        const maxIterations = 50;

                        do {
                            const searchResponse = await gmail.users.messages.list({
                                userId: 'me',
                                maxResults: 500,
                                q: `from:${sub.email}`,
                                labelIds: ['SPAM'],
                                pageToken: pageToken,
                                includeSpamTrash: true
                            });

                            const messages = searchResponse.data.messages || [];
                            allSpamMessages = [...allSpamMessages, ...messages];

                            pageToken = searchResponse.data.nextPageToken;
                            iterations++;
                        } while (pageToken && iterations < maxIterations);

                        // Restaurar correos de spam en lotes
                        if (allSpamMessages.length > 0) {
                            const batchSize = 1000;
                            for (let j = 0; j < allSpamMessages.length; j += batchSize) {
                                const batch = allSpamMessages.slice(j, j + batchSize);
                                const messageIds = batch.map(m => m.id);

                                await gmail.users.messages.batchModify({
                                    userId: 'me',
                                    requestBody: {
                                        ids: messageIds,
                                        addLabelIds: ['INBOX'],
                                        removeLabelIds: ['SPAM']
                                    }
                                });

                                totalRestored += messageIds.length;

                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                    type: 'restored',
                                    current: i + 1,
                                    total: subscriptions.length,
                                    totalRestored: totalRestored,
                                    newsletter: sub.sender,
                                    restoredInNewsletter: messageIds.length,
                                    message: `${totalRestored} correos restaurados...`
                                })}\n\n`));
                            }
                        }

                        // Eliminar filtros de spam
                        try {
                            const filtersResponse = await gmail.users.settings.filters.list({
                                userId: 'me'
                            });

                            const filters = filtersResponse.data.filter || [];

                            for (const filter of filters) {
                                const matchesSender =
                                    filter.criteria?.from === sub.email ||
                                    (filter.criteria?.query && filter.criteria.query.includes(sub.email));

                                const sendsToSpam =
                                    filter.action?.addLabelIds?.includes('SPAM') ||
                                    filter.action?.addLabelIds?.includes('TRASH');

                                if (matchesSender && sendsToSpam) {
                                    await gmail.users.settings.filters.delete({
                                        userId: 'me',
                                        id: filter.id
                                    });
                                    totalFiltersRemoved++;
                                }
                            }
                        } catch (filterError) {
                            console.log(`Filtros no eliminados para ${sub.email}:`, filterError.message);
                        }

                        processedNewsletters.push({
                            email: sub.email,
                            sender: sub.sender,
                            totalEmails: allSpamMessages.length,
                            restored: allSpamMessages.length
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
                    totalRestored: totalRestored,
                    totalFiltersRemoved: totalFiltersRemoved,
                    processedNewsletters: processedNewsletters,
                    message: `¡Completado! ${totalRestored} correos restaurados y ${totalFiltersRemoved} filtros eliminados.`
                })}\n\n`));

                controller.close();

            } catch (error) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'Error en el desmarcado masivo',
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