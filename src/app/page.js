"use client";
import { useSession, signIn, signOut } from 'next-auth/react';
import { useState } from 'react';
import LandingPage from './LandingPage';
import DashboardView from './DashboardView';
import { useEmailAnalysis } from './hooks/useEmailAnalysis';
import { useSubscriptions } from './hooks/useSubscriptions';
import { useBulkSpam } from './hooks/useBulkSpam';

export default function Home() {
    const { status, data: session } = useSession();
    const [isSigningIn, setIsSigningIn] = useState(false);

    const {
        isAnalyzing,
        analysisStatus,
        subscriptions,
        analysisProgress,
        finalStats,
        handleAnalyzeEmails
    } = useEmailAnalysis(session?.user?.email);

    const {
        subscriptionStates,
        handleSpamToggle,
        notification,
        clearNotification
    } = useSubscriptions(session?.user?.email);

    const {
        isProcessing,
        bulkStatus,
        bulkProgress,
        allMarkedAsSpam,
        handleMarkAllAsSpam,
        handleUnmarkAllAsSpam,
        stopProcess
    } = useBulkSpam();

    const handleGetStarted = async () => {
        try {
            setIsSigningIn(true);
            await signIn('google');
        } catch (error) {
            console.error('Error durante el inicio de sesión:', error);
        } finally {
            setIsSigningIn(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut({ callbackUrl: '/' });
        } catch (error) {
            console.error('Error durante el cierre de sesión:', error);
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl">Cargando...</div>
            </div>
        );
    }

    if (status === 'unauthenticated' || !session) {
        return (
            <LandingPage
                onGetStarted={handleGetStarted}
                isSigningIn={isSigningIn}
            />
        );
    }

    return (
        <DashboardView
            session={session}
            onSignOut={handleSignOut}
            isAnalyzing={isAnalyzing}
            analysisStatus={analysisStatus}
            onAnalyze={handleAnalyzeEmails}
            subscriptions={subscriptions}
            analysisProgress={analysisProgress}
            finalStats={finalStats}
            subscriptionStates={subscriptionStates}
            onToggleSpam={handleSpamToggle}
            notification={notification}
            clearNotification={clearNotification}
            // Bulk spam props
            isProcessingBulk={isProcessing}
            bulkStatus={bulkStatus}
            bulkProgress={bulkProgress}
            allMarkedAsSpam={allMarkedAsSpam}
            onMarkAllAsSpam={handleMarkAllAsSpam}
            onUnmarkAllAsSpam={handleUnmarkAllAsSpam}
            onStopBulkProcess={stopProcess}
        />
    );
}