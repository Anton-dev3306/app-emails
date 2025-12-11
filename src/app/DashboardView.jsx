"use client";
import "@radix-ui/themes/styles.css";
import { useState, useMemo } from 'react';
import { Theme, Box, Card, Separator, Flex, Grid } from "@radix-ui/themes";
import Container from './components/layout/Container';
import DashboardHeader from './components/DashboardHeader';
import WelcomeCard from './components/WelcomeCard';
import AnalyzeButton from './components/AnalyzeButton';
import StatusMessage from './components/StatusMessage';
import SubscriptionList from './components/SubscriptionList';

import NotificationCard from './components/NotificationCard';

export default function DashboardView({
                                          session,
                                          onSignOut,
                                          isAnalyzing,
                                          analysisStatus,
                                          onAnalyze,
                                          subscriptions,
                                          subscriptionStates,
                                          onToggleSubscription,
                                          onToggleSpam,
                  
                                          notification,
                                          clearNotification
                                      }) {
    const [selectedGroupId, setSelectedGroupId] = useState('all');

    const filteredSubscriptions = useMemo(() => {
        if (selectedGroupId === 'all') return subscriptions;

        const selectedGroup = groups?.find(g => g.id === selectedGroupId);
        if (!selectedGroup || !selectedGroup.newsletters) return [];

        const emails = new Set(selectedGroup.newsletters.map(n => n.senderEmail));
        return subscriptions.filter(sub => emails.has(sub.senderEmail));
    }, [subscriptions, selectedGroupId, groups]);

    return (
        <Theme>
            <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
                <Container size="2" px="4">
                    <Box py="3">
                        <Card size="4">
                            <DashboardHeader
                                session={session}
                                onSignOut={onSignOut}
                            />

                            <WelcomeCard />

                            <Separator size="4" mb="6" />

                                    <Flex justify="between" align="center" gap="3" mb="4">
                                        <AnalyzeButton
                                            isAnalyzing={isAnalyzing}
                                            onAnalyze={onAnalyze}
                                        />
                                    </Flex>

                                    <StatusMessage status={analysisStatus} />

                                    {notification && (
                                        <NotificationCard
                                            notification={notification}
                                            onClose={clearNotification}
                                        />
                                    )}

                                    <SubscriptionList
                                        subscriptionStates={subscriptionStates}
                                        onToggleSubscription={onToggleSubscription}
                                        onToggleSpam={onToggleSpam}
                                    />

                                </Card>
                            </Box>
                        </Grid>
                    </Box>
                </Container>
            </div>
        </Theme>
    );
}
