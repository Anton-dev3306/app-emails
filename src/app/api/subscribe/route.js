import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.accessToken) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { senderEmail, sender, userEmail } = await req.json();

        if (!senderEmail || !userEmail) {
            return NextResponse.json({
                error: 'Datos incompletos'
            }, { status: 400 });
        }

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({
            access_token: session.accessToken
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Paso 1: Buscar emails del remitente para obtener métodos de suscripción
        const searchResponse = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 20,
            q: `from:${senderEmail}`
        });

        const messages = searchResponse.data.messages || [];

        let subscribeLink = null;
        let subscribeEmail = null;
        let listSubscribeHeader = null;
        let websiteUrl = null;

        // Paso 2: Analizar mensajes para encontrar métodos de suscripción
        for (const message of messages.slice(0, 10)) {
            const detail = await gmail.users.messages.get({
                userId: 'me',
                id: message.id,
                format: 'full'
            });

            const headers = detail.data.payload?.headers || [];

            // Buscar List-Subscribe header (RFC 2369)
            const listSubscribe = headers.find(h =>
                h.name.toLowerCase() === 'list-subscribe'
            )?.value || '';

            if (listSubscribe) {
                listSubscribeHeader = listSubscribe;

                // Extraer URL HTTP
                const urlMatch = listSubscribe.match(/<(https?:\/\/[^>]+)>/);
                if (urlMatch) {
                    subscribeLink = urlMatch[1];
                }

                // Extraer email mailto
                const emailMatch = listSubscribe.match(/<mailto:([^>]+)>/);
                if (emailMatch) {
                    subscribeEmail = emailMatch[1].split('?')[0];
                }
            }

            // Buscar en el contenido del email
            if (!subscribeLink) {
                const content = detail.data.payload;
                const result = findSubscribeInContent(content);
                if (result.link) {
                    subscribeLink = result.link;
                }
                if (result.email) {
                    subscribeEmail = result.email;
                }
                if (result.website) {
                    websiteUrl = result.website;
                }
            }

            // Si encontramos métodos, salir del loop
            if (subscribeLink || subscribeEmail) {
                break;
            }
        }

        let subscribeResult = {
            success: false,
            method: null,
            message: '',
            requiresManualAction: false
        };

        // Paso 3: Intentar suscripción usando diferentes métodos

        // Método 1: Enviar email de suscripción (más confiable para newsletters)
        if (subscribeEmail) {
            try {
                const emailResult = await sendSubscribeEmail(gmail, subscribeEmail, userEmail);
                if (emailResult.success) {
                    subscribeResult = {
                        success: true,
                        method: 'email',
                        message: 'Email de suscripción enviado exitosamente',
                        subscribeEmail
                    };
                }
            } catch (error) {
                console.log('Email subscribe failed:', error);
            }
        }

        // Método 2: HTTP POST/GET al enlace de suscripción
        if (!subscribeResult.success && subscribeLink) {
            try {
                const httpResult = await attemptHttpSubscribe(subscribeLink, userEmail);
                if (httpResult.success) {
                    subscribeResult = {
                        success: true,
                        method: 'http-link',
                        message: 'Suscripción procesada vía enlace HTTP',
                        requiresManualAction: httpResult.requiresConfirmation,
                        subscribeLink
                    };
                }
            } catch (error) {
                console.log('HTTP subscribe failed:', error);
            }
        }

        // Método 3: Buscar formulario de suscripción en el sitio web del remitente
        if (!subscribeResult.success && !subscribeLink && websiteUrl) {
            try {
                const websiteResult = await findSubscribeFormOnWebsite(websiteUrl, senderEmail);
                if (websiteResult.found) {
                    subscribeResult = {
                        success: false,
                        method: 'website-form',
                        message: 'Formulario de suscripción encontrado',
                        requiresManualAction: true,
                        subscribeLink: websiteResult.formUrl
                    };
                }
            } catch (error) {
                console.log('Website form search failed:', error);
            }
        }

        // Paso 4: Actualizar o crear registro en base de datos
        try {
            const existingSubscription = await prisma.subscription.findFirst({
                where: {
                    userEmail: userEmail,
                    senderEmail: senderEmail,
                },
            });

            const subscriptionData = {
                senderName: sender,
                status: subscribeResult.success ? 'SUBSCRIBED' : 'PENDING',
                subscribeLink: subscribeLink || websiteUrl,
                subscribeEmail: subscribeEmail,
                lastUpdated: new Date(),
                subscriptionMethod: subscribeResult.method,
            };

            if (existingSubscription) {
                await prisma.subscription.update({
                    where: { id: existingSubscription.id },
                    data: subscriptionData,
                });
            } else {
                await prisma.subscription.create({
                    data: {
                        userEmail,
                        senderEmail,
                        ...subscriptionData,
                    },
                });
            }
        } catch (dbError) {
            console.error('Database error:', dbError);
        }

        // Paso 5: Eliminar filtros de Gmail que bloqueen este remitente
        try {
            await removeBlockingFilters(gmail, senderEmail);
        } catch (error) {
            console.log('Failed to remove filters:', error);
        }

        // Paso 6: Mover correos existentes de vuelta a la bandeja de entrada
        if (subscribeResult.success && messages.length > 0) {
            try {
                const messageIds = messages.slice(0, 50).map(m => m.id);
                await gmail.users.messages.batchModify({
                    userId: 'me',
                    requestBody: {
                        ids: messageIds,
                        addLabelIds: ['INBOX'],
                        removeLabelIds: ['SPAM', 'TRASH']
                    }
                });
                subscribeResult.restoredCount = messageIds.length;
            } catch (error) {
                console.log('Failed to restore messages:', error);
            }
        }

        return NextResponse.json({
            success: subscribeResult.success || subscribeResult.method !== null,
            subscribeResult,
            subscribeLink: subscribeLink || websiteUrl,
            subscribeEmail,
            message: subscribeResult.success
                ? subscribeResult.message
                : subscribeResult.requiresManualAction
                    ? 'Se encontró un formulario de suscripción. Por favor complétalo manualmente.'
                    : 'No se pudo encontrar un método automático de suscripción. Intenta contactar al remitente directamente.'
        });

    } catch (error) {
        console.error('Error en suscripción:', error);
        return NextResponse.json(
            {
                error: 'Error al procesar suscripción',
                details: error.message,
                success: false
            },
            { status: 500 }
        );
    }
}

// Función para buscar enlaces y datos de suscripción en el contenido
function findSubscribeInContent(part) {
    let link = null;
    let email = null;
    let website = null;

    const searchInPart = (p) => {
        if (p.body?.data) {
            try {
                const decodedContent = Buffer.from(p.body.data, 'base64').toString('utf-8');

                // Patrones para enlaces de suscripción
                const urlPatterns = [
                    /https?:\/\/[^\s<>"]+?(?:subscribe|signup|sign-up|join|newsletter)[^\s<>"]{0,100}/gi,
                    /<a[^>]+?href=["']([^"']+?(?:subscribe|signup|sign-up|join|newsletter)[^"']+?)["'][^>]*>/gi,
                    /https?:\/\/[^\s<>"]+?(?:list\.subscribe|email\.subscribe|newsletter\.subscribe)[^\s<>"]{0,100}/gi
                ];

                for (const pattern of urlPatterns) {
                    const matches = decodedContent.match(pattern);
                    if (matches && matches.length > 0) {
                        const firstMatch = matches[0];
                        const urlMatch = firstMatch.match(/https?:\/\/[^\s<>"]+/);
                        if (urlMatch) {
                            link = urlMatch[0].replace(/[.,;)]$/, '');
                            break;
                        }
                    }
                }

                // Buscar mailto para suscripción
                const emailPatterns = [
                    /mailto:([^\s<>"]+?(?:subscribe|join|list)[^\s<>"]*)/gi,
                    /<a[^>]+?href=["']mailto:([^"'?]+)[^"']*["'][^>]*subscribe[^>]*>/gi
                ];

                for (const pattern of emailPatterns) {
                    const emailMatch = decodedContent.match(pattern);
                    if (emailMatch) {
                        email = emailMatch[0].replace('mailto:', '').split('?')[0].replace(/[<>"]/g, '');
                        break;
                    }
                }

                // Buscar URL del sitio web del remitente
                if (!website) {
                    const websitePattern = /https?:\/\/(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\/)?/gi;
                    const websiteMatches = decodedContent.match(websitePattern);
                    if (websiteMatches && websiteMatches.length > 0) {
                        website = websiteMatches[0];
                    }
                }
            } catch (e) {
                console.log('Error decoding part:', e);
            }
        }

        if (p.parts && !link) {
            for (const subPart of p.parts) {
                searchInPart(subPart);
                if (link) break;
            }
        }
    };

    searchInPart(part);
    return { link, email, website };
}

// Enviar email de suscripción
async function sendSubscribeEmail(gmail, toEmail, fromEmail) {
    try {
        // Diferentes formatos de mensaje de suscripción
        const subjects = ['Subscribe', 'Subscribe Request', 'Newsletter Subscription'];
        const bodies = [
            'Please subscribe this email address to your mailing list.',
            'subscribe',
            'I would like to subscribe to your newsletter.'
        ];

        // Intentar con diferentes formatos
        for (let i = 0; i < subjects.length; i++) {
            try {
                const email = [
                    `From: ${fromEmail}`,
                    `To: ${toEmail}`,
                    `Subject: ${subjects[i]}`,
                    'Content-Type: text/plain; charset=utf-8',
                    '',
                    bodies[i]
                ].join('\r\n');

                const encodedEmail = Buffer.from(email)
                    .toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');

                await gmail.users.messages.send({
                    userId: 'me',
                    requestBody: {
                        raw: encodedEmail
                    }
                });

                return { success: true, method: 'email' };
            } catch (error) {
                if (i === subjects.length - 1) throw error;
                continue;
            }
        }

        return { success: false };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Suscripción vía HTTP
async function attemptHttpSubscribe(url, userEmail) {
    try {
        // Analizar la URL para determinar el mejor método
        const urlLower = url.toLowerCase();

        // Método 1: POST con email en el body
        if (urlLower.includes('api') || urlLower.includes('subscribe')) {
            try {
                const postResponse = await axios.post(url, {
                    email: userEmail,
                    subscribe: true,
                    action: 'subscribe'
                }, {
                    timeout: 10000,
                    maxRedirects: 5,
                    validateStatus: (status) => status < 500,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (compatible; SubscribeBot/1.0)'
                    }
                });

                if (postResponse.status >= 200 && postResponse.status < 400) {
                    return {
                        success: true,
                        method: 'POST',
                        requiresConfirmation: checkIfRequiresConfirmation(postResponse.data),
                        statusCode: postResponse.status
                    };
                }
            } catch (error) {
                console.log('POST failed, trying GET');
            }
        }

        // Método 2: GET con email como parámetro
        try {
            const getUrl = url.includes('?')
                ? `${url}&email=${encodeURIComponent(userEmail)}`
                : `${url}?email=${encodeURIComponent(userEmail)}`;

            const getResponse = await axios.get(getUrl, {
                timeout: 10000,
                maxRedirects: 5,
                validateStatus: (status) => status < 500,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; SubscribeBot/1.0)'
                }
            });

            if (getResponse.status >= 200 && getResponse.status < 400) {
                return {
                    success: true,
                    method: 'GET',
                    requiresConfirmation: checkIfRequiresConfirmation(getResponse.data),
                    statusCode: getResponse.status
                };
            }
        } catch (error) {
            console.log('GET failed');
        }

        // Método 3: Simplemente abrir la URL (para formularios web)
        return {
            success: false,
            method: 'manual',
            requiresConfirmation: true,
            message: 'Requiere completar formulario manualmente'
        };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Buscar formulario de suscripción en el sitio web
async function findSubscribeFormOnWebsite(websiteUrl, senderEmail) {
    try {
        const response = await axios.get(websiteUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; SubscribeBot/1.0)'
            }
        });

        const html = response.data.toLowerCase();

        // Buscar palabras clave de suscripción
        const subscribeKeywords = ['subscribe', 'newsletter', 'signup', 'join our list'];
        const hasSubscribeForm = subscribeKeywords.some(keyword => html.includes(keyword));

        if (hasSubscribeForm) {
            // Intentar extraer URL del formulario
            const formMatch = html.match(/<form[^>]+action=["']([^"']+)["'][^>]*>/i);
            if (formMatch && formMatch[1]) {
                const formUrl = formMatch[1].startsWith('http')
                    ? formMatch[1]
                    : new URL(formMatch[1], websiteUrl).href;

                return { found: true, formUrl };
            }

            return { found: true, formUrl: websiteUrl };
        }

        return { found: false };
    } catch (error) {
        return { found: false, error: error.message };
    }
}

// Verificar si requiere confirmación
function checkIfRequiresConfirmation(responseData) {
    if (typeof responseData !== 'string') {
        responseData = JSON.stringify(responseData);
    }

    const confirmationKeywords = [
        'confirm',
        'verification',
        'check your email',
        'verify',
        'activation',
        'pending'
    ];

    return confirmationKeywords.some(keyword =>
        responseData.toLowerCase().includes(keyword)
    );
}

// Eliminar filtros que bloqueen al remitente
async function removeBlockingFilters(gmail, senderEmail) {
    try {
        const filtersResponse = await gmail.users.settings.filters.list({
            userId: 'me'
        });

        const filters = filtersResponse.data.filter || [];

        for (const filter of filters) {
            // Buscar filtros que bloqueen este remitente
            if (filter.criteria?.from === senderEmail) {
                const blocksInbox =
                    filter.action?.removeLabelIds?.includes('INBOX') ||
                    filter.action?.addLabelIds?.includes('TRASH') ||
                    filter.action?.addLabelIds?.includes('SPAM');

                if (blocksInbox) {
                    await gmail.users.settings.filters.delete({
                        userId: 'me',
                        id: filter.id
                    });
                }
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Error removing filters:', error);
        return { success: false, error: error.message };
    }
}