import { useState, useEffect } from 'react';

const STORAGE_KEY = 'email_subscriptions_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas

export function useEmailAnalysis(userEmail) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStatus, setAnalysisStatus] = useState(null);
    const [subscriptions, setSubscriptions] = useState([]);
    const [analysisProgress, setAnalysisProgress] = useState({
        current: 0,
        total: 0,
        percentage: 0,
        phase: ''
    });
    const [finalStats, setFinalStats] = useState(null);

    useEffect(() => {
        if (userEmail) {
            loadFromCache();
        }
    }, [userEmail]);

    const loadFromCache = () => {
        try {
            const cacheKey = `${STORAGE_KEY}_${userEmail}`;
            const cached = localStorage.getItem(cacheKey);

            if (cached) {
                const data = JSON.parse(cached);
                const cacheAge = Date.now() - data.timestamp;

                if (cacheAge < CACHE_DURATION) {
                    setSubscriptions(data.subscriptions);
                    setFinalStats({
                        totalAnalyzed: data.totalAnalyzed || data.subscriptions.length,
                        totalNewsletters: data.subscriptions.length
                    });
                    setAnalysisStatus({
                        type: 'cached',
                        message: `${data.subscriptions.length} newsletters cargadas (actualizado hace ${formatCacheAge(cacheAge)})`
                    });
                    return true;
                }
            }

            setAnalysisStatus({
                type: 'info',
                message: 'Haz clic en "Analizar Correos" para comenzar el análisis completo'
            });

            return false;
        } catch {
            return false;
        }
    };

    const saveToCache = (subs, totalAnalyzed) => {
        try {
            const cacheKey = `${STORAGE_KEY}_${userEmail}`;
            const data = {
                subscriptions: subs,
                totalAnalyzed: totalAnalyzed,
                timestamp: Date.now(),
                userEmail: userEmail
            };
            localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch {}
    };

    const handleAnalyzeEmails = async () => {
        if (!userEmail) {
            setAnalysisStatus({
                type: 'error',
                message: 'No hay sesión de usuario'
            });
            return;
        }

        setIsAnalyzing(true);
        setFinalStats(null);
        setAnalysisProgress({ current: 0, total: 0, percentage: 0, phase: '' });
        setAnalysisStatus({
            type: 'analyzing',
            message: 'Iniciando análisis...'
        });

        try {
            const response = await fetch('/api/analyze-emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`Error HTTP ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    setIsAnalyzing(false);
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6).trim();
                            if (!jsonStr) continue;

                            const data = JSON.parse(jsonStr);

                            if (data.type === 'start') {
                                setAnalysisStatus({
                                    type: 'analyzing',
                                    message: data.message
                                });
                            } else if (data.type === 'phase') {
                                setAnalysisProgress(prev => ({
                                    ...prev,
                                    phase: data.message
                                }));
                                setAnalysisStatus({
                                    type: 'analyzing',
                                    message: data.message
                                });
                            } else if (data.type === 'collecting') {
                                setAnalysisProgress({
                                    current: data.current,
                                    total: data.current,
                                    percentage: 0,
                                    phase: data.message
                                });
                                setAnalysisStatus({
                                    type: 'analyzing',
                                    message: data.message
                                });
                            } else if (data.type === 'progress') {
                                setAnalysisProgress({
                                    current: data.current,
                                    total: data.total,
                                    percentage: data.percentage,
                                    phase: data.message
                                });
                                setAnalysisStatus({
                                    type: 'analyzing',
                                    message: data.message
                                });
                            } else if (data.type === 'counting') {
                                setAnalysisProgress(prev => ({
                                    ...prev,
                                    phase: data.message
                                }));
                                setAnalysisStatus({
                                    type: 'analyzing',
                                    message: data.message
                                });
                            } else if (data.type === 'complete') {
                                const subs = data.subscriptions || [];
                                setSubscriptions(subs);
                                setFinalStats({
                                    totalAnalyzed: data.totalAnalyzed || 0,
                                    totalNewsletters: subs.length
                                });

                                if (subs.length > 0) {
                                    saveToCache(subs, data.totalAnalyzed);
                                }

                                setAnalysisStatus({
                                    type: 'success',
                                    message: `¡Análisis completo! ${subs.length} newsletters encontradas de ${data.totalAnalyzed} correos encontrados`
                                });
                                setAnalysisProgress({ current: 0, total: 0, percentage: 0, phase: '' });
                            } else if (data.type === 'error') {
                                throw new Error(data.details || data.error);
                            }
                        } catch (parseError) {
                            if (!parseError.message.includes('Unterminated')) {
                                console.error('Error parsing SSE data:', parseError);
                            }
                        }
                    }
                }
            }

        } catch (error) {
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
            setIsAnalyzing(false);
            setAnalysisProgress({ current: 0, total: 0, percentage: 0, phase: '' });
        }
    };

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
        analysisProgress,
        finalStats,
        handleAnalyzeEmails
    };
}
