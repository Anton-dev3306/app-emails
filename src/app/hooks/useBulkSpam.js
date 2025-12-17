import { useState, useCallback, useRef } from 'react';

export function useBulkSpam() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [bulkStatus, setBulkStatus] = useState(null);
    const [bulkProgress, setBulkProgress] = useState({
        current: 0,
        total: 0,
        totalMarked: 0,
        currentNewsletter: '',
        markedInNewsletter: 0
    });
    const [allMarkedAsSpam, setAllMarkedAsSpam] = useState(false);
    const abortControllerRef = useRef(null);

    const stopProcess = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsProcessing(false);
            setBulkStatus({
                type: 'warning',
                message: 'Proceso detenido por el usuario'
            });
            setBulkProgress({ current: 0, total: 0, totalMarked: 0, currentNewsletter: '', markedInNewsletter: 0 });
        }
    }, []);

    const handleMarkAllAsSpam = useCallback(async (subscriptions) => {
        if (!subscriptions || subscriptions.length === 0) {
            setBulkStatus({
                type: 'error',
                message: 'No hay newsletters para marcar como spam'
            });
            return;
        }

        abortControllerRef.current = new AbortController();
        setIsProcessing(true);
        setBulkProgress({ current: 0, total: subscriptions.length, totalMarked: 0, currentNewsletter: '', markedInNewsletter: 0 });
        setBulkStatus({
            type: 'processing',
            message: 'Iniciando marcado masivo...'
        });

        try {
            const response = await fetch('/api/mark-all-spam', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ subscriptions }),
                signal: abortControllerRef.current.signal
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
                    setIsProcessing(false);
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
                                setBulkStatus({
                                    type: 'processing',
                                    message: data.message
                                });
                                setBulkProgress(prev => ({
                                    ...prev,
                                    total: data.totalNewsletters
                                }));
                            } else if (data.type === 'processing') {
                                setBulkProgress(prev => ({
                                    current: data.current,
                                    total: data.total,
                                    totalMarked: prev.totalMarked,
                                    currentNewsletter: data.newsletter,
                                    markedInNewsletter: 0
                                }));
                                setBulkStatus({
                                    type: 'processing',
                                    message: data.message
                                });
                            } else if (data.type === 'marked') {
                                setBulkProgress({
                                    current: data.current,
                                    total: data.total,
                                    totalMarked: data.totalMarked,
                                    currentNewsletter: data.newsletter,
                                    markedInNewsletter: data.markedInNewsletter || 0
                                });
                                setBulkStatus({
                                    type: 'processing',
                                    message: data.message
                                });
                            } else if (data.type === 'complete') {
                                setAllMarkedAsSpam(true);
                                setBulkStatus({
                                    type: 'success',
                                    message: data.message
                                });
                                setBulkProgress({ current: 0, total: 0, totalMarked: 0, currentNewsletter: '', markedInNewsletter: 0 });
                            } else if (data.type === 'error') {
                                throw new Error(data.details || data.error);
                            }
                        } catch (parseError) {
                            if (!parseError.message.includes('Unterminated')) {
                                console.error('Error parsing SSE:', parseError);
                            }
                        }
                    }
                }
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                return;
            }
            setBulkStatus({
                type: 'error',
                message: `Error: ${error.message}`
            });
            setIsProcessing(false);
            setBulkProgress({ current: 0, total: 0, totalMarked: 0, currentNewsletter: '', markedInNewsletter: 0 });
        }
    }, []);

    const handleUnmarkAllAsSpam = useCallback(async (subscriptions) => {
        if (!subscriptions || subscriptions.length === 0) {
            setBulkStatus({
                type: 'error',
                message: 'No hay newsletters para desmarcar'
            });
            return;
        }

        abortControllerRef.current = new AbortController();
        setIsProcessing(true);
        setBulkProgress({ current: 0, total: subscriptions.length, totalMarked: 0, currentNewsletter: '', markedInNewsletter: 0 });
        setBulkStatus({
            type: 'processing',
            message: 'Iniciando desmarcado masivo...'
        });

        try {
            const response = await fetch('/api/unmark-all-spam', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ subscriptions }),
                signal: abortControllerRef.current.signal
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
                    setIsProcessing(false);
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
                                setBulkStatus({
                                    type: 'processing',
                                    message: data.message
                                });
                                setBulkProgress(prev => ({
                                    ...prev,
                                    total: data.totalNewsletters
                                }));
                            } else if (data.type === 'processing') {
                                setBulkProgress(prev => ({
                                    current: data.current,
                                    total: data.total,
                                    totalMarked: prev.totalMarked,
                                    currentNewsletter: data.newsletter,
                                    markedInNewsletter: 0
                                }));
                                setBulkStatus({
                                    type: 'processing',
                                    message: data.message
                                });
                            } else if (data.type === 'restored') {
                                setBulkProgress({
                                    current: data.current,
                                    total: data.total,
                                    totalMarked: data.totalRestored,
                                    currentNewsletter: data.newsletter,
                                    markedInNewsletter: data.restoredInNewsletter || 0
                                });
                                setBulkStatus({
                                    type: 'processing',
                                    message: data.message
                                });
                            } else if (data.type === 'complete') {
                                setAllMarkedAsSpam(false);
                                setBulkStatus({
                                    type: 'success',
                                    message: data.message
                                });
                                setBulkProgress({ current: 0, total: 0, totalMarked: 0, currentNewsletter: '', markedInNewsletter: 0 });
                            } else if (data.type === 'error') {
                                throw new Error(data.details || data.error);
                            }
                        } catch (parseError) {
                            if (!parseError.message.includes('Unterminated')) {
                                console.error('Error parsing SSE:', parseError);
                            }
                        }
                    }
                }
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                return; // Ya manejado por stopProcess
            }
            setBulkStatus({
                type: 'error',
                message: `Error: ${error.message}`
            });
            setIsProcessing(false);
            setBulkProgress({ current: 0, total: 0, totalMarked: 0, currentNewsletter: '', markedInNewsletter: 0 });
        }
    }, []);

    return {
        isProcessing,
        bulkStatus,
        bulkProgress,
        allMarkedAsSpam,
        handleMarkAllAsSpam,
        handleUnmarkAllAsSpam,
        stopProcess
    };
}