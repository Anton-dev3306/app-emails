import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { authOptions } from '../auth/[...nextauth]/route';

export async function POST(request) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            // Helper para enviar datos de forma segura
            const safeEnqueue = (data) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                    return true;
                } catch (error) {
                    console.log('⚠️ No se pudo enviar datos, stream cerrado');
                    return false;
                }
            };

            try {
                const session = await getServerSession(authOptions);

                if (!session?.accessToken) {
                    safeEnqueue({
                        type: 'error',
                        error: 'No autorizado'
                    });
                    controller.close();
                    return;
                }

                const oauth2Client = new google.auth.OAuth2();
                oauth2Client.setCredentials({
                    access_token: session.accessToken
                });

                const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

                if (!safeEnqueue({
                    type: 'start',
                    message: 'Iniciando análisis...'
                })) {
                    return;
                }

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
                if (!safeEnqueue({
                    type: 'phase',
                    message: 'Buscando newsletters en tu correo...'
                })) {
                    return;
                }

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

                            if (!safeEnqueue({
                                type: 'collecting',
                                current: allMessageIds.size,
                                message: `Encontrados ${allMessageIds.size} correos potenciales...`
                            })) {
                                return;
                            }

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
                    safeEnqueue({
                        type: 'complete',
                        subscriptions: [],
                        totalAnalyzed: 0,
                        message: 'No se encontraron newsletters'
                    });
                    controller.close();
                    return;
                }

                // Fase 2: Analizar TODOS los mensajes
                if (!safeEnqueue({
                    type: 'phase',
                    message: `Analizando ${allMessageIds.size} correos...`
                })) {
                    return;
                }

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

                    if (!safeEnqueue({
                        type: 'progress',
                        current: analyzedCount,
                        total: messagesToAnalyze.length,
                        percentage: percentage,
                        message: `${analyzedCount} correos analizados...`
                    })) {
                        return;
                    }

                    await new Promise(resolve => setTimeout(resolve, 100));
                }

                // Fase 3: Agrupar y contar
                if (!safeEnqueue({
                    type: 'phase',
                    message: 'Agrupando newsletters y contando correos exactos...'
                })) {
                    return;
                }

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
                if (!safeEnqueue({
                    type: 'phase',
                    message: `Obteniendo conteo exacto de ${senderMap.size} remitentes...`
                })) {
                    return;
                }

                console.log('🚀 Iniciando Fase 4 - Total remitentes:', senderMap.size);

                const senderEntries = Array.from(senderMap.entries());
                console.log('📋 Primeros 3 remitentes en senderEntries:', senderEntries.slice(0, 3).map(([email]) => email));

                const subscriptionsWithExactCount = [];
                const batchSizeCount = 20;
                let processedCount = 0;

                for (let i = 0; i < senderEntries.length; i += batchSizeCount) {
                    const batch = senderEntries.slice(i, i + batchSizeCount);
                    console.log(`\n🔄 Procesando lote ${Math.floor(i/batchSizeCount) + 1}, tamaño: ${batch.length}`);

                    const batchResults = await Promise.all(
                        batch.map(async (entry, batchIndex) => {
                            const senderEmail = entry[0];
                            const senderData = entry[1];

                            console.log(`  ➡️ [${batchIndex}] Iniciando: ${senderEmail}`);

                            try {
                                // Obtener conteo REAL paginando todos los resultados
                                let exactCount = 0;
                                let pageToken = null;

                                do {
                                    const searchResult = await gmail.users.messages.list({
                                        userId: 'me',
                                        q: `from:"${senderEmail}"`,
                                        maxResults: 500,
                                        pageToken: pageToken
                                    });

                                    const messages = searchResult.data.messages || [];
                                    exactCount += messages.length;
                                    pageToken = searchResult.data.nextPageToken;

                                    // Si no hay más páginas, salir
                                    if (!pageToken) break;
                                } while (pageToken);

                                console.log(`  ✅ [${batchIndex}] ${senderEmail} -> Count: ${exactCount}`);

                                let mostCommonName = senderEmail.split('@')[0];
                                let maxCount = 0;

                                const namesArray = Array.from(senderData.names.entries());
                                for (const [name, count] of namesArray) {
                                    if (count > maxCount) {
                                        maxCount = count;
                                        mostCommonName = name;
                                    }
                                }

                                const resultObj = {
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

                                console.log(`  📦 [${batchIndex}] Objeto creado para ${senderEmail}:`, { email: resultObj.email, totalEmails: resultObj.totalEmails });

                                return resultObj;
                            } catch (error) {
                                console.log(`  ❌ [${batchIndex}] Error en ${senderEmail}:`, error.message);

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

                    console.log(`\n📊 Lote completado. Resultados:`, batchResults.map(r => ({ email: r.email, count: r.totalEmails })));

                    subscriptionsWithExactCount.push(...batchResults);
                    processedCount += batch.length;

                    console.log(`📈 Total acumulado: ${subscriptionsWithExactCount.length} subscriptions`);
                    console.log(`🔢 Primeras 3 en array:`, subscriptionsWithExactCount.slice(0, 3).map(s => ({ email: s.email, count: s.totalEmails })));

                    if (!safeEnqueue({
                        type: 'counting',
                        current: processedCount,
                        total: senderEntries.length,
                        message: `Conteo exacto: ${processedCount}/${senderEntries.length} remitentes procesados...`
                    })) {
                        return;
                    }
                }

                console.log('\n🏁 Fase 4 completada. Total subscriptions:', subscriptionsWithExactCount.length);
                console.log('📊 Verificación final - Primeras 5:', subscriptionsWithExactCount.slice(0, 5).map(s => ({
                    email: s.email,
                    count: s.totalEmails,
                    freq: s.frequency
                })));

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

                console.log('✅ Después de filtrar y ordenar:', subscriptions.slice(0, 5).map(s => ({
                    email: s.email,
                    count: s.totalEmails
                })));

                const finalData = {
                    type: 'complete',
                    subscriptions: subscriptions,
                    totalAnalyzed: messagesToAnalyze.length,
                    totalProcessed: allEmailDetails.length,
                    totalUnique: senderMap.size,
                    message: `¡Análisis completo! ${subscriptions.length} newsletters encontradas`
                };

                safeEnqueue(finalData);
                controller.close();

            } catch (error) {
                console.error('💥 Error fatal en API:', error);
                safeEnqueue({
                    type: 'error',
                    error: 'Error en el análisis de correos',
                    details: error.message
                });
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Deshabilita buffering de nginx/proxy
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