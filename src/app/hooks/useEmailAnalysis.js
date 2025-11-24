import { useState, useEffect } from 'react';

const STORAGE_KEY = 'email_subscriptions_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

export function useEmailAnalysis(userEmail) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStatus, setAnalysisStatus] = useState(null);
    const [subscriptions, setSubscriptions] = useState([]);
// Cargar cache al montar el componente
    useEffect(() => {
        if (userEmail) {
            loadFromCache();
        }
    }, [userEmail]);
// Cargar suscripciones desde localStorage
    const loadFromCache = () => {
        try {
            const cacheKey = `${STORAGE_KEY}_${userEmail}`;
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
                const data = JSON.parse(cached);
                const cacheAge = Date.now() - data.timestamp;

                console.log('[useEmailAnalysis] Cache encontrado, edad:', Math.round(cacheAge / 1000 / 60), 'minutos');

                // Si el cache es válido (menos de 24 horas)
                if (cacheAge < CACHE_DURATION) {
                    setSubscriptions(data.subscriptions);
                    setAnalysisStatus({
                        type: 'cached',
                        message: `${data.subscriptions.length} newsletters cargadas (actualizado hace ${formatCacheAge(cacheAge)})`
                    });
                    console.log('[useEmailAnalysis] Cache válido, cargando', data.subscriptions.length, 'newsletters');
                    return true;
                }

                console.log('[useEmailAnalysis] Cache expirado');
            }

            // No hay cache o está expirado
            setAnalysisStatus({
                type: 'info',
                message: 'Haz clic en "Analizar Correos" para comenzar'
            });
            return false;
        } catch (error) {
            console.error('[useEmailAnalysis] Error cargando cache:', error);
            return false;
        }
    };

    // Guardar suscripciones en localStorage
    const saveToCache = (subs) => {
        try {
            const cacheKey = `${STORAGE_KEY}_${userEmail}`;
            const data = {
                subscriptions: subs,
                timestamp: Date.now(),
                userEmail: userEmail
            };
            localStorage.setItem(cacheKey, JSON.stringify(data));
            console.log('[useEmailAnalysis] Guardado en cache:', subs.length, 'newsletters');
        } catch (error) {
            console.error('[useEmailAnalysis] Error guardando cache:', error);
        }
    };

    // Analizar correos
    const handleAnalyzeEmails = async () => {
        if (!userEmail) {
            setAnalysisStatus({
                type: 'error',
                message: 'No hay sesión de usuario'
            });
            return;
        }

        setIsAnalyzing(true);
        setAnalysisStatus({
            type: 'analyzing',
            message: 'Analizando tus correos... Esto puede tomar un momento'
        });

        try {
            console.log('[useEmailAnalysis] Iniciando análisis para:', userEmail);

            const response = await fetch('/api/analyze-emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Error HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('[useEmailAnalysis] Análisis completado:', {
                newsletters: data.subscriptions?.length || 0,
                analizados: data.totalAnalyzed,
                unicos: data.totalUnique
            });

            if (data.subscriptions && data.subscriptions.length > 0) {
                setSubscriptions(data.subscriptions);

                // Guardar en cache
                saveToCache(data.subscriptions);

                setAnalysisStatus({
                    type: 'success',
                    message: `¡Análisis completo! ${data.subscriptions.length} newsletters encontradas de ${data.totalAnalyzed} correos analizados`
                });
            } else {
                setSubscriptions([]);
                setAnalysisStatus({
                    type: 'warning',
                    message: 'No se encontraron newsletters en tu correo'
                });
            }
        } catch (error) {
            console.error('[useEmailAnalysis] Error:', error);

            // Mensajes de error específicos
            let errorMessage = 'Error al analizar correos';

            if (error.message.includes('401') || error.message.includes('No autorizado')) {
                errorMessage = 'Sesión expirada. Por favor, cierra sesión e inicia nuevamente.';
            } else if (error.message.includes('403')) {
                errorMessage = 'Sin permisos para acceder a Gmail. Verifica la autorización.';
            } else if (error.message.includes('429')) {
                errorMessage = 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.';
            } else if (error.message.includes('Network')) {
                errorMessage = 'Error de conexión. Verifica tu internet.';
            } else {
                errorMessage = `Error: ${error.message}`;
            }

            setAnalysisStatus({
                type: 'error',
                message: errorMessage
            });
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Función auxiliar para formatear edad del cache
    const formatCacheAge = (milliseconds) => {
        const minutes = Math.floor(milliseconds / 1000 / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} día${days > 1 ? 's' : ''}`;
        if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
        if (minutes > 0) return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
        return 'menos de un minuto';
    };

    return {
        isAnalyzing,
        analysisStatus,
        subscriptions,
        handleAnalyzeEmails
    };
}
