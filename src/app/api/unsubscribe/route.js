import { getServerSession } from 'next-auth';
import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { authOptions } from '../auth/[...nextauth]/route';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(req) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.accessToken) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const { senderEmail, sender, userEmail } = await req.json();

        if (!senderEmail) {
            return NextResponse.json({ error: 'Email del remitente requerido' }, { status: 400 });
        }

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({
            access_token: session.accessToken
        });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Paso 1: Buscar correos del remitente para obtener enlaces de desuscripción
        const searchResponse = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 10,
            q: `from:${senderEmail}`
        });

        const messages = searchResponse.data.messages || [];

        if (messages.length === 0) {
            return NextResponse.json({
                error: 'No se encontraron correos de este remitente',
                success: false
            }, { status: 404 });
        }

        let unsubscribeLink = null;
        let unsubscribeEmail = null;
        let listUnsubscribePost = null;
        let gmailUnsubscribeUrl = null;

        // Paso 2: Analizar el mensaje MÁS RECIENTE (el que tiene el botón de Gmail)
        const latestMessage = await gmail.users.messages.get({
            userId: 'me',
            id: messages[0].id,
            format: 'full',
            metadataHeaders: ['List-Unsubscribe', 'List-Unsubscribe-Post']
        });

        const headers = latestMessage.data.payload?.headers || [];

        // CRÍTICO: Buscar List-Unsubscribe (este es el que Gmail usa para el botón)
        const listUnsubscribe = headers.find(h =>
            h.name.toLowerCase() === 'list-unsubscribe'
        )?.value || '';

        // Buscar List-Unsubscribe-Post (RFC 8058 - One-Click)
        const listUnsubscribePostHeader = headers.find(h =>
            h.name.toLowerCase() === 'list-unsubscribe-post'
        )?.value || '';

        if (listUnsubscribePostHeader) {
            listUnsubscribePost = listUnsubscribePostHeader;
        }

        if (listUnsubscribe) {
            // Extraer TODAS las URLs del header (puede tener múltiples)
            const allUrls = listUnsubscribe.match(/<(https?:\/\/[^>]+)>/g);

            if (allUrls && allUrls.length > 0) {
                // Gmail usa la PRIMERA URL HTTP como el enlace del botón
                gmailUnsubscribeUrl = allUrls[0].replace(/[<>]/g, '');
                unsubscribeLink = gmailUnsubscribeUrl;
            }

            // Extraer email mailto (backup)
            const emailMatch = listUnsubscribe.match(/<mailto:([^>]+)>/);
            if (emailMatch) {
                unsubscribeEmail = emailMatch[1].split('?')[0];
            }
        }

        // Si no hay List-Unsubscribe, buscar en el contenido
        if (!unsubscribeLink) {
            const content = latestMessage.data.payload;
            const result = findUnsubscribeInContent(content);
            if (result.link) {
                unsubscribeLink = result.link;
            }
        }

        let unsubscribeResult = {
            success: false,
            method: null,
            message: '',
            steps: []
        };

        // PASO 3: SIMULAR EL FLUJO DE GMAIL (Como lo hace el botón "Anular suscripción")

        // Método 1: One-Click Unsubscribe (Lo que Gmail intenta primero)
        if (listUnsubscribePost && gmailUnsubscribeUrl) {
            try {
                unsubscribeResult.steps.push('Intentando One-Click Unsubscribe (método de Gmail)...');

                const oneClickResult = await attemptOneClickUnsubscribe(
                    gmailUnsubscribeUrl,
                    listUnsubscribePost
                );

                if (oneClickResult.success) {
                    unsubscribeResult = {
                        success: true,
                        method: 'one-click-gmail',
                        message: 'Desuscripción exitosa usando el botón de Gmail (One-Click)',
                        steps: [...unsubscribeResult.steps, 'One-Click exitoso ✓']
                    };
                } else {
                    unsubscribeResult.steps.push('One-Click falló, probando siguiente método...');
                }
            } catch (error) {
                unsubscribeResult.steps.push('One-Click error, continuando...');
            }
        }

        // Método 2: Seguir el enlace de desuscripción (Simular clic en el botón de Gmail)
        if (!unsubscribeResult.success && gmailUnsubscribeUrl) {
            try {
                unsubscribeResult.steps.push(`Abriendo enlace del botón de Gmail: ${gmailUnsubscribeUrl}`);

                const pageResult = await followUnsubscribeLinkAndProcess(
                    gmailUnsubscribeUrl,
                    userEmail
                );

                if (pageResult.success) {
                    unsubscribeResult = {
                        success: true,
                        method: 'gmail-link-flow',
                        message: pageResult.message,
                        steps: [...unsubscribeResult.steps, ...pageResult.steps],
                        finalUrl: pageResult.finalUrl
                    };
                } else {
                    unsubscribeResult.steps.push(...pageResult.steps);
                }
            } catch (error) {
                unsubscribeResult.steps.push(`Error siguiendo enlace: ${error.message}`);
            }
        }

        // Método 3: Si hay otro enlace en el contenido, intentar con ese
        if (!unsubscribeResult.success && unsubscribeLink && unsubscribeLink !== gmailUnsubscribeUrl) {
            try {
                unsubscribeResult.steps.push(`Intentando con enlace alternativo: ${unsubscribeLink}`);

                const altResult = await followUnsubscribeLinkAndProcess(
                    unsubscribeLink,
                    userEmail
                );

                if (altResult.success) {
                    unsubscribeResult = {
                        success: true,
                        method: 'alternative-link',
                        message: altResult.message,
                        steps: [...unsubscribeResult.steps, ...altResult.steps],
                        finalUrl: altResult.finalUrl
                    };
                }
            } catch (error) {
                unsubscribeResult.steps.push(`Error con enlace alternativo: ${error.message}`);
            }
        }

        // Método 4: Enviar email de desuscripción
        if (!unsubscribeResult.success && unsubscribeEmail) {
            try {
                unsubscribeResult.steps.push(`Enviando email a: ${unsubscribeEmail}`);

                const emailResult = await sendUnsubscribeEmail(gmail, unsubscribeEmail, userEmail);
                if (emailResult.success) {
                    unsubscribeResult = {
                        success: true,
                        method: 'email',
                        message: 'Email de desuscripción enviado',
                        steps: [...unsubscribeResult.steps, 'Email enviado ✓']
                    };
                }
            } catch (error) {
                unsubscribeResult.steps.push(`Error enviando email: ${error.message}`);
            }
        }

        // PASO 4: Crear filtro en Gmail (SIEMPRE, incluso si la desuscripción falló)
        try {
            await createGmailFilter(gmail, senderEmail);
            unsubscribeResult.filterCreated = true;
            unsubscribeResult.steps.push('Filtro de Gmail creado ✓');
        } catch (error) {
            unsubscribeResult.steps.push('No se pudo crear filtro');
        }

        // PASO 5: Archivar correos existentes
        try {
            const messageIds = messages.map(m => m.id);
            if (messageIds.length > 0) {
                await gmail.users.messages.batchModify({
                    userId: 'me',
                    requestBody: {
                        ids: messageIds,
                        addLabelIds: [],
                        removeLabelIds: ['UNREAD', 'INBOX']
                    }
                });
                unsubscribeResult.archivedCount = messageIds.length;
                unsubscribeResult.steps.push(`${messageIds.length} correos archivados ✓`);
            }
        } catch (error) {
            unsubscribeResult.steps.push('No se pudieron archivar correos');
        }

        return NextResponse.json({
            success: true,
            unsubscribeResult,
            gmailButtonUrl: gmailUnsubscribeUrl,
            debugInfo: {
                foundOneClick: !!listUnsubscribePost,
                foundListUnsubscribe: !!listUnsubscribe,
                foundInContent: !!unsubscribeLink
            },
            message: unsubscribeResult.success
                ? unsubscribeResult.message
                : 'Filtro creado y correos archivados. La desuscripción automática no fue posible.'
        });

    } catch (error) {
        console.error('Error en desuscripción:', error);
        return NextResponse.json(
            {
                error: 'Error al procesar desuscripción',
                details: error.message,
                success: false
            },
            { status: 500 }
        );
    }
}

// FUNCIÓN CLAVE: Simular todo el flujo del botón de Gmail
async function followUnsubscribeLinkAndProcess(url, userEmail) {
    const steps = [];

    try {
        // PASO 1: Hacer request inicial (como cuando haces clic en el botón de Gmail)
        steps.push('Paso 1: Abriendo página de desuscripción...');

        const initialResponse = await axios.get(url, {
            timeout: 15000,
            maxRedirects: 10, // Seguir redirecciones automáticamente
            validateStatus: (status) => status < 500,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            }
        });

        const finalUrl = initialResponse.request?.res?.responseUrl || url;
        steps.push(`Página cargada: ${finalUrl}`);

        // PASO 2: Analizar la página con Cheerio
        const $ = cheerio.load(initialResponse.data);

        // Buscar mensajes de éxito (muchos sitios desuscriben automáticamente)
        const successMessages = [
            'successfully unsubscribed',
            'you have been unsubscribed',
            'unsubscribe successful',
            'you are now unsubscribed',
            'removed from our list',
            'successfully removed',
            'unsubscribed successfully'
        ];

        const pageText = $('body').text().toLowerCase();
        const hasSuccessMessage = successMessages.some(msg => pageText.includes(msg));

        if (hasSuccessMessage) {
            steps.push('Paso 2: ¡Desuscripción automática detectada! ✓');
            return {
                success: true,
                message: 'Desuscripción automática exitosa al abrir el enlace',
                steps,
                finalUrl
            };
        }

        // PASO 3: Buscar y hacer clic en botones de desuscripción
        steps.push('Paso 2: Buscando botón de desuscripción en la página...');

        const unsubscribeButtons = $('button, input[type="submit"], a').filter((i, el) => {
            const text = $(el).text().toLowerCase();
            const value = $(el).attr('value')?.toLowerCase() || '';
            const href = $(el).attr('href')?.toLowerCase() || '';

            return text.includes('unsubscribe') ||
                text.includes('confirm') ||
                text.includes('remove') ||
                value.includes('unsubscribe') ||
                href.includes('unsubscribe');
        });

        if (unsubscribeButtons.length > 0) {
            steps.push(`Encontrados ${unsubscribeButtons.length} botón(es) de desuscripción`);

            // Intentar hacer clic en cada botón
            for (let i = 0; i < Math.min(unsubscribeButtons.length, 3); i++) {
                const button = unsubscribeButtons.eq(i);
                const href = button.attr('href');
                const formAction = button.closest('form').attr('action');
                const buttonText = button.text().trim();

                steps.push(`Paso 3: Intentando con botón: "${buttonText}"`);

                // Si es un enlace (a), seguirlo
                if (href && href.startsWith('http')) {
                    try {
                        const clickResult = await axios.get(href, {
                            timeout: 15000,
                            maxRedirects: 10,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Referer': finalUrl
                            }
                        });

                        const clickPageText = cheerio.load(clickResult.data)('body').text().toLowerCase();
                        const clickSuccess = successMessages.some(msg => clickPageText.includes(msg));

                        if (clickSuccess) {
                            steps.push('¡Desuscripción exitosa! ✓');
                            return {
                                success: true,
                                message: 'Desuscripción exitosa tras hacer clic en el botón',
                                steps,
                                finalUrl: clickResult.request?.res?.responseUrl || href
                            };
                        }
                    } catch (error) {
                        steps.push(`Error al hacer clic: ${error.message}`);
                    }
                }

                // Si hay un formulario, intentar enviarlo
                if (formAction) {
                    try {
                        const formUrl = formAction.startsWith('http')
                            ? formAction
                            : new URL(formAction, finalUrl).href;

                        const formData = new URLSearchParams();
                        formData.append('email', userEmail);
                        formData.append('unsubscribe', 'true');
                        formData.append('confirm', 'yes');

                        const formResult = await axios.post(formUrl, formData, {
                            timeout: 15000,
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'User-Agent': 'Mozilla/5.0',
                                'Referer': finalUrl
                            }
                        });

                        const formPageText = cheerio.load(formResult.data)('body').text().toLowerCase();
                        const formSuccess = successMessages.some(msg => formPageText.includes(msg));

                        if (formSuccess) {
                            steps.push('¡Formulario enviado exitosamente! ✓');
                            return {
                                success: true,
                                message: 'Desuscripción exitosa tras enviar formulario',
                                steps,
                                finalUrl: formResult.request?.res?.responseUrl || formUrl
                            };
                        }
                    } catch (error) {
                        steps.push(`Error enviando formulario: ${error.message}`);
                    }
                }
            }
        }

        // PASO 4: Si no encontramos botones, intentar POST directo
        steps.push('Paso 4: Intentando POST directo a la URL...');

        try {
            const postResult = await axios.post(finalUrl, {
                email: userEmail,
                action: 'unsubscribe',
                confirm: 'yes'
            }, {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            const postPageText = cheerio.load(postResult.data)('body').text().toLowerCase();
            const postSuccess = successMessages.some(msg => postPageText.includes(msg));

            if (postSuccess) {
                steps.push('POST directo exitoso ✓');
                return {
                    success: true,
                    message: 'Desuscripción exitosa con POST directo',
                    steps,
                    finalUrl
                };
            }
        } catch (error) {
            steps.push(`POST directo falló: ${error.message}`);
        }

        // Si llegamos aquí, no pudimos desuscribir automáticamente
        steps.push('No se pudo completar la desuscripción automáticamente');
        return {
            success: false,
            message: 'Se requiere acción manual',
            steps,
            finalUrl,
            requiresManualAction: true
        };

    } catch (error) {
        steps.push(`Error: ${error.message}`);
        return {
            success: false,
            message: error.message,
            steps
        };
    }
}

// One-Click Unsubscribe (RFC 8058)
async function attemptOneClickUnsubscribe(url, postHeader) {
    try {
        const response = await axios.post(url, 'List-Unsubscribe=One-Click', {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000,
            maxRedirects: 5,
            validateStatus: (status) => status < 500
        });

        return {
            success: response.status >= 200 && response.status < 400,
            statusCode: response.status
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Buscar enlaces de desuscripción en el contenido
function findUnsubscribeInContent(part) {
    let link = null;

    const searchInPart = (p) => {
        if (p.body?.data) {
            try {
                const decodedContent = Buffer.from(p.body.data, 'base64').toString('utf-8');

                const urlPatterns = [
                    /https?:\/\/[^\s<>"]+?(?:unsubscribe|opt-?out|remove|cancelar|unsub|preferences)[^\s<>"]{0,100}/gi,
                    /<a[^>]+?href=["']([^"']+?(?:unsubscribe|opt-?out|remove|cancelar|unsub)[^"']+?)["'][^>]*>/gi
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
    return { link };
}

// Enviar email de desuscripción
async function sendUnsubscribeEmail(gmail, toEmail, fromEmail) {
    try {
        const email = [
            `From: ${fromEmail}`,
            `To: ${toEmail}`,
            `Subject: Unsubscribe Request`,
            '',
            'Please unsubscribe this email address from your mailing list.'
        ].join('\n');

        const encodedEmail = Buffer.from(email).toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedEmail
            }
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Crear filtro en Gmail
async function createGmailFilter(gmail, senderEmail) {
    try {
        await gmail.users.settings.filters.create({
            userId: 'me',
            requestBody: {
                criteria: {
                    from: senderEmail
                },
                action: {
                    addLabelIds: ['TRASH'],
                    removeLabelIds: ['INBOX', 'UNREAD']
                }
            }
        });

        return { success: true };
    } catch (error) {
        console.error('Error creating filter:', error);
        return { success: false, error: error.message };
    }
}