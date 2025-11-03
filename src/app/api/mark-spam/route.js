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

        const { senderEmail, sender, userEmail } = await req.json();

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

        // Paso 1: Analizar correos para identificar patrones de newsletter
        const searchResponse = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 20,
            q: `from:${senderEmail}`
        });

        const messages = searchResponse.data.messages || [];

        if (messages.length === 0) {
            return NextResponse.json({
                error: 'No se encontraron correos de este remitente',
                success: false
            }, { status: 404 });
        }

        // Paso 2: Identificar características de la newsletter
        const newsletterPatterns = await identifyNewsletterPatterns(gmail, messages, senderEmail);

        if (!newsletterPatterns.isNewsletter) {
            return NextResponse.json({
                success: false,
                error: 'No se detectaron patrones de newsletter en estos correos',
                suggestion: 'Este remitente no parece enviar newsletters. ¿Deseas marcar todos sus correos como spam?'
            }, { status: 400 });
        }

        // Paso 3: Buscar SOLO correos que coincidan con el patrón de newsletter
        let allNewsletterMessages = [];
        let pageToken = null;

        // Construir query específica para newsletters
        const newsletterQuery = buildNewsletterQuery(senderEmail, newsletterPatterns);

        for (let i = 0; i < 5; i++) {
            const searchNewsletters = await gmail.users.messages.list({
                userId: 'me',
                maxResults: 100,
                q: newsletterQuery,
                pageToken: pageToken
            });

            const foundMessages = searchNewsletters.data.messages || [];
            allNewsletterMessages = [...allNewsletterMessages, ...foundMessages];

            pageToken = searchNewsletters.data.nextPageToken;
            if (!pageToken) break;
        }

        // Paso 4: Marcar SOLO los correos de newsletter como SPAM
        let markedCount = 0;
        const batchSize = 1000;

        for (let i = 0; i < allNewsletterMessages.length; i += batchSize) {
            const batch = allNewsletterMessages.slice(i, i + batchSize);
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
            } catch (error) {
                console.error(`Error marcando lote:`, error);
            }
        }

        // Paso 5: Crear filtro SOLO para newsletters futuras
        let filterCreated = false;
        try {
            const filterCriteria = buildFilterCriteria(senderEmail, newsletterPatterns);

            await gmail.users.settings.filters.create({
                userId: 'me',
                requestBody: {
                    criteria: filterCriteria,
                    action: {
                        addLabelIds: ['SPAM'],
                        removeLabelIds: ['INBOX', 'UNREAD']
                    }
                }
            });
            filterCreated = true;
        } catch (error) {
            console.log('Error creando filtro:', error.message);
        }

        return NextResponse.json({
            success: true,
            message: 'Newsletters marcadas como spam exitosamente',
            details: {
                totalNewslettersFound: allNewsletterMessages.length,
                markedAsSpam: markedCount,
                filterCreated,
                senderEmail,
                senderName: sender,
                newsletterPatterns: {
                    hasListUnsubscribe: newsletterPatterns.hasListUnsubscribe,
                    hasNewsletterKeywords: newsletterPatterns.hasNewsletterKeywords,
                    subjectPattern: newsletterPatterns.subjectPattern,
                    hasUnsubscribeLink: newsletterPatterns.hasUnsubscribeLink
                }
            },
            summary: filterCreated
                ? `${markedCount} newsletters marcadas como spam y filtro creado. Las futuras newsletters de ${senderEmail} irán automáticamente a spam, pero otros correos importantes del remitente llegarán normalmente.`
                : `${markedCount} newsletters marcadas como spam.`
        });

    } catch (error) {
        console.error('Error marcando newsletters como spam:', error);
        return NextResponse.json(
            {
                error: 'Error al marcar newsletters como spam',
                details: error.message,
                success: false
            },
            { status: 500 }
        );
    }
}

// Identificar patrones que indican que es una newsletter
async function identifyNewsletterPatterns(gmail, messages, senderEmail) {
    const patterns = {
        isNewsletter: false,
        hasListUnsubscribe: false,
        hasNewsletterKeywords: false,
        subjectPattern: null,
        hasUnsubscribeLink: false,
        commonSubjectPrefix: null,
        listId: null
    };

    const subjects = [];
    let unsubscribeCount = 0;
    let listUnsubscribeCount = 0;

    // Analizar primeros 10 mensajes
    for (const message of messages.slice(0, 10)) {
        try {
            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'full'
            });

            const headers = detail.data.payload?.headers || [];

            // Buscar List-Unsubscribe header (señal de newsletter)
            const listUnsubscribe = headers.find(h =>
                h.name.toLowerCase() === 'list-unsubscribe'
            )?.value;

            if (listUnsubscribe) {
                listUnsubscribeCount++;
                patterns.hasListUnsubscribe = true;
            }

            // Buscar List-ID header
            const listId = headers.find(h =>
                h.name.toLowerCase() === 'list-id'
            )?.value;

            if (listId && !patterns.listId) {
                patterns.listId = listId;
            }

            // Obtener subject
            const subject = headers.find(h => h.name === 'Subject')?.value || '';
            subjects.push(subject);

            // Buscar enlaces de desuscripción en el contenido
            const content = detail.data.payload;
            if (hasUnsubscribeInContent(content)) {
                unsubscribeCount++;
                patterns.hasUnsubscribeLink = true;
            }

            // Buscar palabras clave de newsletter
            const newsletterKeywords = [
                'newsletter', 'update', 'digest', 'weekly', 'monthly',
                'subscription', 'boletín', 'noticia', 'actualización'
            ];

            const subjectLower = subject.toLowerCase();
            if (newsletterKeywords.some(keyword => subjectLower.includes(keyword))) {
                patterns.hasNewsletterKeywords = true;
            }

        } catch (error) {
            console.log('Error analizando mensaje:', error);
        }
    }

    // Detectar patrón común en subjects
    patterns.commonSubjectPrefix = findCommonPrefix(subjects);

    // Determinar si es newsletter basado en múltiples señales
    const newsletterScore =
        (patterns.hasListUnsubscribe ? 3 : 0) +
        (patterns.hasUnsubscribeLink ? 2 : 0) +
        (patterns.hasNewsletterKeywords ? 2 : 0) +
        (patterns.listId ? 2 : 0) +
        (patterns.commonSubjectPrefix ? 1 : 0);

    patterns.isNewsletter = newsletterScore >= 3;

    return patterns;
}

// Buscar enlaces de desuscripción en el contenido
function hasUnsubscribeInContent(part) {
    const searchInPart = (p) => {
        if (p.body?.data) {
            try {
                const decodedContent = Buffer.from(p.body.data, 'base64').toString('utf-8');
                const unsubscribePatterns = [
                    /unsubscribe/i,
                    /opt-out/i,
                    /cancelar suscripci[óo]n/i,
                    /darse de baja/i
                ];

                return unsubscribePatterns.some(pattern => pattern.test(decodedContent));
            } catch (e) {
                return false;
            }
        }

        if (p.parts) {
            return p.parts.some(subPart => searchInPart(subPart));
        }

        return false;
    };

    return searchInPart(part);
}

// Encontrar prefijo común en subjects (ej: "[Newsletter]", "Weekly Update:")
function findCommonPrefix(subjects) {
    if (subjects.length < 3) return null;

    // Buscar patrones entre corchetes [...]
    const bracketPattern = /^\[([^\]]+)\]/;
    const bracketsMatches = subjects.map(s => s.match(bracketPattern)?.[1]).filter(Boolean);

    if (bracketsMatches.length >= subjects.length * 0.7) {
        return `[${bracketsMatches[0]}]`;
    }

    // Buscar patrones con dos puntos "Prefix: ..."
    const colonPattern = /^([^:]+):/;
    const colonMatches = subjects.map(s => s.match(colonPattern)?.[1]).filter(Boolean);

    if (colonMatches.length >= subjects.length * 0.7) {
        return `${colonMatches[0]}:`;
    }

    // Buscar palabras iniciales comunes
    const words = subjects.map(s => s.split(' ')[0]);
    const wordCount = {};
    words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
    });

    const mostCommon = Object.entries(wordCount)
        .sort((a, b) => b[1] - a[1])[0];

    if (mostCommon && mostCommon[1] >= subjects.length * 0.7) {
        return mostCommon[0];
    }

    return null;
}

// Construir query específica para newsletters
function buildNewsletterQuery(senderEmail, patterns) {
    let query = `from:${senderEmail}`;

    // Agregar condiciones específicas de newsletter
    const conditions = [];

    if (patterns.commonSubjectPrefix) {
        // Escapar caracteres especiales para Gmail query
        const escapedPrefix = patterns.commonSubjectPrefix.replace(/[:\[\]]/g, '');
        conditions.push(`subject:"${escapedPrefix}"`);
    }

    // Buscar correos con palabras clave de newsletter
    const newsletterKeywords = [
        'newsletter', 'update', 'digest', 'subscription',
        'unsubscribe', 'weekly', 'monthly'
    ];

    const keywordConditions = newsletterKeywords.map(k => `"${k}"`).join(' OR ');
    conditions.push(`(${keywordConditions})`);

    if (conditions.length > 0) {
        query += ` (${conditions.join(' OR ')})`;
    }

    return query;
}

// Construir criterios de filtro para newsletters futuras
function buildFilterCriteria(senderEmail, patterns) {
    const criteria = {
        from: senderEmail
    };

    // Agregar filtro por subject si hay patrón común
    if (patterns.commonSubjectPrefix) {
        const escapedPrefix = patterns.commonSubjectPrefix.replace(/[:\[\]]/g, '').trim();
        criteria.subject = escapedPrefix;
    } else if (patterns.hasNewsletterKeywords) {
        // Si no hay prefijo común pero tiene keywords, filtrar por keywords
        criteria.query = `from:${senderEmail} (newsletter OR subscription OR update OR digest)`;
    }

    return criteria;
}