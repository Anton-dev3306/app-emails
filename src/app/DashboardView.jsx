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
import GroupManagementPanel from './components/GroupManagementPanel';
import GroupSelector from './components/GroupSelector';

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
                                          groups,
                                          groupsLoading,
                                          groupsError,
                                          onCreateGroup,
                                          onUpdateGroup,
                                          onDeleteGroup,
                                          onAddToGroup,
                                          onRemoveFromGroup
                                      }) {
    console.log('[DashboardView] Grupos recibidos:', groups);
    console.log('[DashboardView] Total:', groups?.length);
    console.log('[DashboardView] Loading:', groupsLoading);

    const [selectedGroupId, setSelectedGroupId] = useState('all');

    // Filtrar newsletters según el grupo seleccionado
    const filteredSubscriptions = useMemo(() => {
        if (selectedGroupId === 'all') {
            return subscriptions;
        }

        const selectedGroup = groups?.find(g => g.id === selectedGroupId);
        if (!selectedGroup || !selectedGroup.newsletters) {
            return [];
        }

        const groupEmails = new Set(selectedGroup.newsletters.map(n => n.senderEmail));
        return subscriptions.filter(sub => groupEmails.has(sub.senderEmail));
    }, [subscriptions, selectedGroupId, groups]);

    return (
        <Theme>
            <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
                <Container>
                    <Box py="6">
                        <Grid columns={{ initial: '1', md: '3' }} gap="4">
                            {/* Columna izquierda: Panel de grupos (1/3) */}
                            <Box>
                                <GroupManagementPanel
                                    groups={groups}
                                    loading={groupsLoading}
                                    onCreateGroup={onCreateGroup}
                                    onUpdateGroup={onUpdateGroup}
                                    onDeleteGroup={onDeleteGroup}
                                />
                            </Box>

                            {/* Columna derecha: Dashboard principal (2/3) */}
                            <Box style={{ gridColumn: 'span 2' }}>
                                <Card size="4">
                                    <DashboardHeader
                                        session={session}
                                        onSignOut={onSignOut}
                                    />

                                    <WelcomeCard />

                                    <Separator size="4" mb="6" />

                                    <Flex justify="between" align="center" gap="3" mb="4">

                                        <GroupSelector
                                            groups={groups}
                                            selectedGroup={selectedGroupId}
                                            onSelectGroup={setSelectedGroupId}
                                        />
                                        <AnalyzeButton
                                            isAnalyzing={isAnalyzing}
                                            onAnalyze={onAnalyze}
                                        />
                                    </Flex>

                                    <StatusMessage status={analysisStatus} />

                                    <SubscriptionList
                                        subscriptions={filteredSubscriptions}
                                        subscriptionStates={subscriptionStates}
                                        onToggleSubscription={onToggleSubscription}
                                        onToggleSpam={onToggleSpam}
                                        groups={groups}
                                        onAddToGroup={onAddToGroup}
                                        onRemoveFromGroup={onRemoveFromGroup}
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