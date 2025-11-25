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
import NotificationToast from './components/NotificationToast';

export default function Home() {
    const { status, data: session } = useSession();
    const [isSigningIn, setIsSigningIn] = useState(false);

    // Hooks de lógica (solo se ejecutan si hay sesión)
    const {
        isAnalyzing,
        analysisStatus,
        subscriptions,
        handleAnalyzeEmails
    } = useEmailAnalysis(session?.user?.email);

    const {
        subscriptionStates,
        handleSubscriptionToggle,
        handleSpamToggle
    } = useSubscriptions(session?.user?.email);

    const {
        groups,
        loading: groupsLoading,
        error: groupsError,
        createGroup,
        updateGroup,
        deleteGroup,
        addNewsletterToGroup,
        removeNewsletterFromGroup
    } = useNewsletterGroups(session?.user?.email);

    // Manejador de inicio de sesión
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

    // Manejador de cierre de sesión
    const handleSignOut = () => {
        signOut({ redirect: false });
    };

    // Manejador para agregar newsletter a grupo
    const handleAddToGroup = async (groupId, subscription) => {
        const result = await addNewsletterToGroup(
            groupId,
            subscription.senderEmail,
            subscription.sender
        );

        if (!result.success) {
            alert(result.error || 'Error al agregar newsletter al grupo');
        }
    };

    // Manejador para eliminar grupo con confirmación
    const handleDeleteGroup = async (groupId) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este grupo?.')) {
            return;
        }

        const result = await deleteGroup(groupId);
        if (!result.success) {
            alert(result.error || 'Error al eliminar grupo');
        }
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

    // Si NO está autenticado -> Mostrar Landing Page
    if (status === "unauthenticated") {
        return (
            <LandingPage
                onGetStarted={handleGetStarted}
                isLoading={isSigningIn}
            />
        );
    }

    // Si está autenticado -> Mostrar Dashboard
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
            groups={groups}
            groupsLoading={groupsLoading}
            groupsError={groupsError}
            onCreateGroup={createGroup}
            onUpdateGroup={updateGroup}
            onDeleteGroup={handleDeleteGroup}
            onAddToGroup={handleAddToGroup}
            onRemoveFromGroup={removeNewsletterFromGroup}
        />
    );
}