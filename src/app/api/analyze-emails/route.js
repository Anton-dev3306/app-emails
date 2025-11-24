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

        console.log('[ANALYZE] ========== INICIO DEL ANÁLISIS ==========');
        console.log('[ANALYZE] Usuario:', session.user?.email);

        // ESTRATEGIA MEJORADA: Múltiples queries más específicas
        const queries = [
            // Búsquedas por headers específicos de newsletters
            'list-unsubscribe',
            'list-id',

            // Palabras clave comunes
            'unsubscribe',
            'newsletter',
            'subscription',

            // Términos relacionados
            'mailing list',
            'automated',
            'no-reply OR noreply',

            // Categorías de Gmail
            'category:promotions',
            'category:updates'
        ];

        let allMessageIds = new Set();
        let queryResults = {};

        // Ejecutar cada query y recopilar resultados
        for (const query of queries) {
            try {
                console.log(`[ANALYZE] Buscando: "${query}"`);

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

                console.log(`[ANALYZE] → Encontrados: ${messages.length}, Nuevos únicos: ${newMessages}`);

                // Pequeña pausa para no saturar la API
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                console.error(`[ANALYZE] Error en query "${query}":`, error.message);
            }
        }

        console.log(`[ANALYZE] Total de mensajes únicos encontrados: ${allMessageIds.size}`);
        console.log('[ANALYZE] Desglose por query:', JSON.stringify(queryResults, null, 2));

        if (allMessageIds.size === 0) {
            return NextResponse.json({
                subscriptions: [],
                totalAnalyzed: 0,
                totalUnique: 0,
                message: 'No se encontraron correos que coincidan con los criterios de búsqueda',
                timestamp: new Date().toISOString()
            });
        }

        // Limitar a 300 mensajes para análisis (aumentado de 200)
        const messagesToAnalyze = Array.from(allMessageIds).slice(0, 300);
        console.log(`[ANALYZE] Analizando ${messagesToAnalyze.length} mensajes...`);

        // Obtener detalles en lotes de 50 (batch processing)
        const batchSize = 50;
        const batches = [];

        for (let i = 0; i < messagesToAnalyze.length; i += batchSize) {
            batches.push(messagesToAnalyze.slice(i, i + batchSize));
        }

        console.log(`[ANALYZE] Procesando en ${batches.length} lotes de hasta ${batchSize} mensajes`);

        let allEmailDetails = [];
        let processedCount = 0;

        for (const [index, batch] of batches.entries()) {
            console.log(`[ANALYZE] Procesando lote ${index + 1}/${batches.length}...`);

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
                    } catch (err) {
                        console.error(`[ANALYZE] Error en mensaje ${messageId}:`, err.message);
                        return null;
                    }
                })
            );

            const validResults = batchResults
                .filter(result => result.status === 'fulfilled' && result.value !== null)
                .map(result => result.value);

            allEmailDetails.push(...validResults);
            processedCount += validResults.length;

            console.log(`[ANALYZE] Lote ${index + 1} completado: ${validResults.length}/${batch.length} exitosos`);

            // Pausa entre lotes
            if (index < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        console.log(`[ANALYZE] Total procesados exitosamente: ${allEmailDetails.length}/${messagesToAnalyze.length}`);

        if (allEmailDetails.length === 0) {
            return NextResponse.json({
                subscriptions: [],
                totalAnalyzed: 0,
                totalUnique: 0,
                message: 'No se pudieron procesar los correos encontrados',
                timestamp: new Date().toISOString()
            });
        }

        // Agrupar por remitente con análisis detallado
        const senderMap = new Map();

        allEmailDetails.forEach(email => {
            // Extraer email del remitente con múltiples métodos
            let senderEmail = null;

            // Método 1: Buscar en From
            const fromMatch = email.from.match(/<(.+?)>/) || email.from.match(/(\S+@\S+\.\S+)/);
            if (fromMatch) {
                senderEmail = fromMatch[1]?.trim().toLowerCase();
            }

            // Método 2: Buscar en Return-Path si no se encontró
            if (!senderEmail && email.returnPath) {
                const returnMatch = email.returnPath.match(/<(.+?)>/) || email.returnPath.match(/(\S+@\S+\.\S+)/);
                if (returnMatch) {
                    senderEmail = returnMatch[1]?.trim().toLowerCase();
                }
            }

            // Método 3: Usar From directamente si parece un email
            if (!senderEmail && email.from.includes('@')) {
                senderEmail = email.from.trim().toLowerCase();
            }

            if (!senderEmail) {
                console.warn('[ANALYZE] No se pudo extraer email de:', email.from);
                return;
            }

            // Extraer nombre del remitente
            let senderName = email.from.split('<')[0].trim().replace(/['"]/g, '');
            if (!senderName || senderName === senderEmail) {
                senderName = senderEmail.split('@')[0];
            }

            // Crear o actualizar entrada del remitente
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
            senderData.subjects.push(email.subject);
            senderData.dates.push(email.date);
            senderData.messageIds.push(email.messageId);

            if (email.listUnsubscribe) senderData.hasUnsubscribeLink = true;
            if (email.listId) senderData.hasListId = true;
        });

        console.log(`[ANALYZE] Remitentes únicos identificados: ${senderMap.size}`);

        // Filtrar y enriquecer datos
        const subscriptions = Array.from(senderMap.values())
            .filter(s => {
                // Filtros más permisivos para capturar más newsletters
                return s.totalEmails >= 1 && ( // Reducido de 2 a 1
                    s.hasUnsubscribeLink ||
                    s.hasListId ||
                    s.totalEmails >= 3 || // Si tiene 3+ emails, probablemente es newsletter
                    s.senderEmail.includes('noreply') ||
                    s.senderEmail.includes('no-reply') ||
                    s.senderEmail.includes('newsletter') ||
                    s.senderEmail.includes('notification')
                );
            })
            .map(s => {
                // Calcular frecuencia basada en cantidad
                const frequency = s.totalEmails > 20 ? 'Muy frecuente' :
                    s.totalEmails > 10 ? 'Frecuente' :
                        s.totalEmails > 5 ? 'Regular' :
                            s.totalEmails > 2 ? 'Ocasional' : 'Esporádica';

                // Determinar categoría
                const category = determineCategoryFromEmail(
                    s.sender,
                    s.senderEmail,
                    s.subjects
                );

                // Calcular engagement
                const engagement = s.totalEmails > 15 ? 'Alto' :
                    s.totalEmails > 8 ? 'Medio' : 'Bajo';

                // Calcular score de confiabilidad
                let reliabilityScore = 0;
                if (s.hasUnsubscribeLink) reliabilityScore += 2;
                if (s.hasListId) reliabilityScore += 2;
                if (s.totalEmails > 5) reliabilityScore += 1;

                const reliability = reliabilityScore >= 4 ? 'Alta' :
                    reliabilityScore >= 2 ? 'Media' : 'Baja';

                return {
                    sender: s.sender,
                    senderEmail: s.senderEmail,
                    totalEmails: s.totalEmails,
                    category,
                    frequency,
                    engagement,
                    reliability,
                    hasUnsubscribeLink: s.hasUnsubscribeLink,
                    hasListId: s.hasListId,
                    recentSubjects: s.subjects.slice(-3).reverse(), // Últimos 3
                    lastEmailDate: s.dates[s.dates.length - 1],
                    firstEmailDate: s.dates[0]
                };
            })
            .sort((a, b) => b.totalEmails - a.totalEmails); // Ordenar por cantidad

        console.log(`[ANALYZE] Newsletters finales: ${subscriptions.length}`);
        console.log('[ANALYZE] ========== FIN DEL ANÁLISIS ==========');

        // Estadísticas detalladas
        const stats = {
            totalAnalyzed: allEmailDetails.length,
            totalUnique: senderMap.size,
            totalNewsletters: subscriptions.length,
            categories: getCategoryCounts(subscriptions),
            frequencies: getFrequencyCounts(subscriptions),
            reliability: getReliabilityCounts(subscriptions)
        };

        return NextResponse.json({
            subscriptions,
            ...stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[ANALYZE] ========== ERROR ==========');
        console.error('[ANALYZE] Tipo:', error.constructor.name);
        console.error('[ANALYZE] Mensaje:', error.message);
        console.error('[ANALYZE] Stack:', error.stack);

        return NextResponse.json(
            {
                error: 'Error en el análisis de correos',
                details: error.message,
                code: error.code || 'UNKNOWN_ERROR'
            },
            { status: 500 }
        );
    }
}

// Función mejorada para determinar categoría
function determineCategoryFromEmail(sender, email, subjects = []) {
    const text = (sender + ' ' + email + ' ' + subjects.join(' ')).toLowerCase();

    // Orden de prioridad: más específico primero
    if (text.match(/github|gitlab|bitbucket|stackoverflow|dev\.to|hashnode/)) return 'Desarrollo';
    if (text.match(/linkedin|indeed|glassdoor|job|career|hiring|recruit/)) return 'Profesional';
    if (text.match(/amazon|ebay|shop|store|buy|sale|discount|offer|deal|coupon/)) return 'Comercial';
    if (text.match(/nyt|cnn|bbc|reuters|news|newsletter|daily|weekly|bulletin/)) return 'Noticias';
    if (text.match(/bank|paypal|stripe|payment|invoice|receipt|transaction|billing/)) return 'Financiero';
    if (text.match(/facebook|twitter|instagram|reddit|discord|social|community/)) return 'Social';
    if (text.match(/udemy|coursera|pluralsight|education|course|learn|training|webinar/)) return 'Educación';
    if (text.match(/fitness|health|wellness|medical|workout|nutrition/)) return 'Salud';
    if (text.match(/airbnb|booking|expedia|travel|hotel|flight|trip/)) return 'Viajes';
    if (text.match(/spotify|netflix|youtube|entertainment|music|movie|game|event/)) return 'Entretenimiento';
    if (text.match(/medium|substack|blog|article|post/)) return 'Blogs';
    if (text.match(/security|alert|notification|update|verification/)) return 'Seguridad';

    return 'Otro';
}

// Contar por categoría
function getCategoryCounts(subscriptions) {
    const counts = {};
    subscriptions.forEach(sub => {
        counts[sub.category] = (counts[sub.category] || 0) + 1;
    });
    return counts;
}

// Contar por frecuencia
function getFrequencyCounts(subscriptions) {
    const counts = {};
    subscriptions.forEach(sub => {
        counts[sub.frequency] = (counts[sub.frequency] || 0) + 1;
    });
    return counts;
}

// Contar por confiabilidad
function getReliabilityCounts(subscriptions) {
    const counts = {};
    subscriptions.forEach(sub => {
        counts[sub.reliability] = (counts[sub.reliability] || 0) + 1;
    });
    return counts;
}
