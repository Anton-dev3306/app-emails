"use client";
import "@radix-ui/themes/styles.css";
import { Theme, Flex } from "@radix-ui/themes";
import { useSession, signIn, signOut } from "next-auth/react";
import { Loader } from "lucide-react";
import { useState } from 'react';

// Vistas
import LandingPage from './LandingPage';
import DashboardView from './DashboardView';

// Hooks
import { useEmailAnalysis } from './hooks/useEmailAnalysis';
import { useSubscriptions } from './hooks/useSubscriptions';
import { useNewsletterGroups } from './hooks/useNewsletterGroups';

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

    //cierre de sesión
    const handleSignOut = () => {
        signOut({ redirect: false });
    };

    // Loading inicial
    if (status === "loading") {
        return (
            <Theme>
                <Flex
                    align="center"
                    justify="center"
                    style={{ minHeight: '100vh' }}
                >
                    <Loader className="animate-spin h-12 w-12 text-blue-600" />
                </Flex>
            </Theme>
        );
    }

    if (status === "unauthenticated") {
        return (
            <LandingPage
                onGetStarted={handleGetStarted}
                isLoading={isSigningIn}
            />
        );
    }

    return (
        <>

            <DashboardView
            session={session}
            onSignOut={handleSignOut}
            isAnalyzing={isAnalyzing}
            analysisStatus={analysisStatus}
            onAnalyze={handleAnalyzeEmails}
            subscriptions={subscriptions}
            subscriptionStates={subscriptionStates}
            onToggleSubscription={handleSubscriptionToggle}
            onToggleSpam={handleSpamToggle}
            notification={notification}
            clearNotification={clearNotification}
            />

        </>
    );
}