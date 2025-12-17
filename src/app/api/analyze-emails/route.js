import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';
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

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({
            access_token: session.accessToken
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'start',
                    message: 'Iniciando análisis...'
                })}\n\n`));

                const queries = [
                    'list-unsubscribe',
                    'list-id',
                    'unsubscribe',
                    'newsletter',
                    'subscription',
                    'mailing list',
                    'automated',
                    'no-reply OR noreply',
                    'category:promotions',
                    'category:updates'
                ];

                let allMessageIds = new Set();

                // Fase 1: Recolectar TODOS los IDs
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'phase',
                    message: 'Buscando newsletters en tu correo...'
                })}\n\n`));

                for (const query of queries) {
                    try {
                        let pageToken = null;

                        do {
                            const result = await gmail.users.messages.list({
                                userId: 'me',
                                maxResults: 500,
                                q: query,
                                pageToken: pageToken
                            });

                            const messages = result.data.messages || [];
                            messages.forEach(msg => allMessageIds.add(msg.id));

                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                type: 'collecting',
                                current: allMessageIds.size,
                                message: `Encontrados ${allMessageIds.size} correos potenciales...`
                            })}\n\n`));

                            pageToken = result.data.nextPageToken;

                            if (pageToken) {
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        } while (pageToken);

                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (error) {
                        // Error silencioso
                    }
                }

                if (allMessageIds.size === 0) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'complete',
                        subscriptions: [],
                        totalAnalyzed: 0,
                        message: 'No se encontraron newsletters'
                    })}\n\n`));
                    controller.close();
                    return;
                }

                // Fase 2: Analizar TODOS los mensajes
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'phase',
                    message: `Analizando ${allMessageIds.size} correos...`
                })}\n\n`));

                const messagesToAnalyze = Array.from(allMessageIds);
                const batchSize = 100;
                let allEmailDetails = [];
                let analyzedCount = 0;

                for (let i = 0; i < messagesToAnalyze.length; i += batchSize) {
                    const batch = messagesToAnalyze.slice(i, i + batchSize);

                    const batchResults = await Promise.allSettled(
                        batch.map(async (messageId) => {
                            try {
                                const detail = await gmail.users.messages.get({
                                    userId: 'me',
                                    id: messageId,
                                    format: 'metadata',
                                    metadataHeaders: ['From', 'Subject', 'Date', 'List-Unsubscribe', 'List-Id', 'Return-Path']
                                });

                                const headers = detail.data.payload?.headers || [];

                                return {
                                    from: headers.find(h => h.name === 'From')?.value || '',
                                    subject: headers.find(h => h.name === 'Subject')?.value || '',
                                    date: headers.find(h => h.name === 'Date')?.value || '',
                                    listUnsubscribe: headers.find(h => h.name === 'List-Unsubscribe')?.value || '',
                                    listId: headers.find(h => h.name === 'List-Id')?.value || '',
                                    returnPath: headers.find(h => h.name === 'Return-Path')?.value || '',
                                    messageId: messageId
                                };
                            } catch {
                                return null;
                            }
                        })
                    );

                    const validResults = batchResults
                        .filter(result => result.status === 'fulfilled' && result.value !== null)
                        .map(result => result.value);

                    allEmailDetails.push(...validResults);
                    analyzedCount += batch.length;

                    const percentage = Math.round((analyzedCount / messagesToAnalyze.length) * 100);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'progress',
                        current: analyzedCount,
                        total: messagesToAnalyze.length,
                        percentage: percentage,
                        message: `${analyzedCount} correos analizados...`
                    })}\n\n`));

                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Fase 3: Agrupar y contar
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'phase',
                    message: 'Agrupando newsletters y contando correos exactos...'
                })}\n\n`));

                const senderMap = new Map();

                for (const email of allEmailDetails) {
                    const senderEmail = extractEmail(email);
                    if (!senderEmail) continue;

                    const senderName = extractSenderName(email.from, senderEmail);

                    if (!senderMap.has(senderEmail)) {
                        senderMap.set(senderEmail, {
                            email: senderEmail,
                            names: new Map(),
                            totalEmails: 0,
                            hasUnsubscribeLink: false,
                            hasListId: false,
                            subjects: [],
                            dates: [],
                            messageIds: []
                        });
                    }

                    const senderData = senderMap.get(senderEmail);
                    senderData.totalEmails++;

                    const currentCount = senderData.names.get(senderName) || 0;
                    senderData.names.set(senderName, currentCount + 1);

                    senderData.subjects.push(email.subject);
                    senderData.dates.push(email.date);
                    senderData.messageIds.push(email.messageId);

                    if (email.listUnsubscribe) senderData.hasUnsubscribeLink = true;
                    if (email.listId) senderData.hasListId = true;
                }

// Fase 4: Obtener conteos exactos en paralelo con lotes
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'phase',
                    message: `Obteniendo conteo exacto de ${senderMap.size} remitentes...`
                })}\n\n`));

                const senderEntries = Array.from(senderMap.entries());
                const subscriptionsWithExactCount = [];
                const batchSizeCount = 20;
                let processedCount = 0;

                for (let i = 0; i < senderEntries.length; i += batchSizeCount) {
                    const batch = senderEntries.slice(i, i + batchSizeCount);

                    const batchResults = await Promise.all(
                        batch.map(async (entry) => {
                            const senderEmail = entry[0];
                            const senderData = entry[1];

                            try {
                                const searchResult = await gmail.users.messages.list({
                                    userId: 'me',
                                    q: `from:"${senderEmail}"`,
                                    maxResults: 1
                                });

                                const exactCount = searchResult.data.resultSizeEstimate || senderData.totalEmails;

                                let mostCommonName = senderEmail.split('@')[0];
                                let maxCount = 0;

                                const namesArray = Array.from(senderData.names.entries());
                                for (const [name, count] of namesArray) {
                                    if (count > maxCount) {
                                        maxCount = count;
                                        mostCommonName = name;
                                    }
                                }

                                return {
                                    sender: mostCommonName,
                                    email: senderEmail,
                                    totalEmails: exactCount,
                                    frequency: calculateFrequency(exactCount),
                                    hasUnsubscribeLink: senderData.hasUnsubscribeLink,
                                    hasListId: senderData.hasListId,
                                    recentSubjects: [...senderData.subjects].slice(-3).reverse(),
                                    lastEmailDate: senderData.dates[senderData.dates.length - 1],
                                    firstEmailDate: senderData.dates[0]
                                };
                            } catch (error) {
                                let mostCommonName = senderEmail.split('@')[0];
                                let maxCount = 0;

                                const namesArray = Array.from(senderData.names.entries());
                                for (const [name, count] of namesArray) {
                                    if (count > maxCount) {
                                        maxCount = count;
                                        mostCommonName = name;
                                    }
                                }

                                return {
                                    sender: mostCommonName,
                                    email: senderEmail,
                                    totalEmails: senderData.totalEmails,
                                    frequency: calculateFrequency(senderData.totalEmails),
                                    hasUnsubscribeLink: senderData.hasUnsubscribeLink,
                                    hasListId: senderData.hasListId,
                                    recentSubjects: [...senderData.subjects].slice(-3).reverse(),
                                    lastEmailDate: senderData.dates[senderData.dates.length - 1],
                                    firstEmailDate: senderData.dates[0]
                                };
                            }
                        })
                    );

                    subscriptionsWithExactCount.push(...batchResults);
                    processedCount += batch.length;

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'counting',
                        current: processedCount,
                        total: senderEntries.length,
                        message: `Conteo exacto: ${processedCount}/${senderEntries.length} remitentes procesados...`
                    })}\n\n`));
                }

                const subscriptions = subscriptionsWithExactCount
                    .filter(s => {
                        return s.totalEmails >= 1 && (
                            s.hasUnsubscribeLink ||
                            s.hasListId ||
                            s.totalEmails >= 3 ||
                            s.email.includes('noreply') ||
                            s.email.includes('no-reply') ||
                            s.email.includes('newsletter') ||
                            s.email.includes('notification')
                        );
                    })
                    .sort((a, b) => b.totalEmails - a.totalEmails);

                const finalData = {
                    type: 'complete',
                    subscriptions: subscriptions,
                    totalAnalyzed: messagesToAnalyze.length,
                    totalProcessed: allEmailDetails.length,
                    totalUnique: senderMap.size,
                    message: `¡Análisis completo! ${subscriptions.length} newsletters encontradas`
                };

                controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`));
                controller.close();

            } catch (error) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'Error en el análisis de correos',
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

function extractEmail(email) {
    let senderEmail = null;

    const fromMatch = email.from.match(/<(.+?)>/) || email.from.match(/(\S+@\S+\.\S+)/);
    if (fromMatch) {
        senderEmail = fromMatch[1]?.trim().toLowerCase();
    }

    if (!senderEmail && email.returnPath) {
        const returnMatch = email.returnPath.match(/<(.+?)>/) || email.returnPath.match(/(\S+@\S+\.\S+)/);
        if (returnMatch) {
            senderEmail = returnMatch[1]?.trim().toLowerCase();
        }
    }

    if (!senderEmail && email.from.includes('@')) {
        senderEmail = email.from.trim().toLowerCase();
    }

    return senderEmail;
}

function extractSenderName(fromHeader, senderEmail) {
    let senderName = fromHeader.split('<')[0].trim().replace(/['"]/g, '');

    if (!senderName || senderName === senderEmail || senderName.includes('@')) {
        const emailPart = senderEmail.split('@')[0];

        senderName = emailPart
            .replace(/[._-]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    return senderName;
}

function calculateFrequency(totalEmails) {
    if (totalEmails > 400) return 'Muy frecuente (400+)';
    if (totalEmails > 300) return 'Muy frecuente (300+)';
    if (totalEmails > 200) return 'Frecuente';
    if (totalEmails > 100) return 'Regular';
    if (totalEmails > 25) return 'Ocasional';
    return 'Esporádica';
}