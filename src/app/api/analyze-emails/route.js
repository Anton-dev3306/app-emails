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
        let queryResults = {};

        for (const query of queries) {
            try {
                const result = await gmail.users.messages.list({
                    userId: 'me',
                    maxResults: 100,
                    q: query
                });

                const messages = result.data.messages || [];
                const beforeCount = allMessageIds.size;

                messages.forEach(msg => allMessageIds.add(msg.id));

                const newMessages = allMessageIds.size - beforeCount;
                queryResults[query] = { total: messages.length, nuevos: newMessages };

                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
                // error silencioso
            }
        }

        if (allMessageIds.size === 0) {
            return NextResponse.json({
                subscriptions: [],
                totalAnalyzed: 0,
                totalUnique: 0,
                message: 'No se encontraron correos que coincidan con los criterios de búsqueda',
                timestamp: new Date().toISOString()
            });
        }

        const messagesToAnalyze = Array.from(allMessageIds).slice(0, 300);

        const batchSize = 50;
        const batches = [];

        for (let i = 0; i < messagesToAnalyze.length; i += batchSize) {
            batches.push(messagesToAnalyze.slice(i, i + batchSize));
        }

        let allEmailDetails = [];
        for (const [index, batch] of batches.entries()) {
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

            if (index < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        if (allEmailDetails.length === 0) {
            return NextResponse.json({
                subscriptions: [],
                totalAnalyzed: 0,
                totalUnique: 0,
                message: 'No se pudieron procesar los correos encontrados',
                timestamp: new Date().toISOString()
            });
        }

        const senderMap = new Map();

        allEmailDetails.forEach(email => {
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

            if (!senderEmail) return;

            let senderName = email.from.split('<')[0].trim().replace(/['"]/g, '');
            if (!senderName || senderName === senderEmail) {
                senderName = senderEmail.split('@')[0];
            }

            if (!senderMap.has(senderEmail)) {
                senderMap.set(senderEmail, {
                    sender: senderName,
                    senderEmail: senderEmail,
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