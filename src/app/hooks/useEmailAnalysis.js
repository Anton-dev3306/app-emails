import { useState } from 'react';

export function useEmailAnalysis(userEmail) {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisStatus, setAnalysisStatus] = useState(null);
    const [subscriptions, setSubscriptions] = useState([]);

    const handleAnalyzeEmails = async () => {
        if (!userEmail) return;

        setIsAnalyzing(true);
        setAnalysisStatus('analyzing');

        try {
            const response = await fetch('/api/analyze-emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: userEmail }),
            });

            if (!response.ok) throw new Error('Error en el análisis');

            const data = await response.json();
            setSubscriptions(data.subscriptions);
            setAnalysisStatus('success');
        } catch (error) {
            console.error('Error:', error);
            setAnalysisStatus('error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    return {
        isAnalyzing,
        analysisStatus,
        subscriptions,
        handleAnalyzeEmails
    };
}