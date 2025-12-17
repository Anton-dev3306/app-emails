"use client";
import { Button, Flex, Text, Box, Progress } from "@radix-ui/themes";
import { Ban, ShieldOff, Loader, XCircle } from 'lucide-react';

export default function BulkSpamButton({
                                           isProcessing,
                                           allMarkedAsSpam,
                                           bulkProgress,
                                           bulkStatus,
                                           subscriptions,
                                           onMarkAll,
                                           onUnmarkAll,
                                           onStopProcess
                                       }) {
    const handleClick = () => {
        if (allMarkedAsSpam) {
            onUnmarkAll(subscriptions);
        } else {
            onMarkAll(subscriptions);
        }
    };

    const percentage = bulkProgress.total > 0
        ? Math.round((bulkProgress.current / bulkProgress.total) * 100)
        : 0;

    if (!subscriptions || subscriptions.length === 0) {
        return null;
    }

    return (
        <Box style={{ width: '100%' }}>
            {!isProcessing ? (
                <Button
                    onClick={handleClick}
                    size="3"
                    color={allMarkedAsSpam ? "green" : "red"}
                    variant="soft"
                    style={{ width: '100%' }}
                >
                    <Flex align="center" gap="2">
                        {allMarkedAsSpam ? (
                            <>
                                <ShieldOff className="h-5 w-5" />
                                Desmarcar todo como spam
                            </>
                        ) : (
                            <>
                                <Ban className="h-5 w-5" />
                                Marcar todo como spam
                            </>
                        )}
                    </Flex>
                </Button>
            ) : (
                <Box>
                    <Flex direction="column" gap="3" style={{ width: '100%' }}>
                        <Flex align="center" justify="center" gap="2">
                            <Loader className="animate-spin h-5 w-5" />
                            <Text weight="bold" size="3">
                                {bulkStatus?.message || 'Procesando...'}
                            </Text>
                        </Flex>

                        {bulkProgress.total > 0 && (
                            <>
                                <Box>
                                    <Progress
                                        value={percentage}
                                        max={100}
                                        size="3"
                                        color={allMarkedAsSpam ? "green" : "red"}
                                    />
                                </Box>

                                <Flex direction="column" gap="1">
                                    <Text size="2" color="gray" align="center">
                                        Remitente {bulkProgress.current} de {bulkProgress.total} ({percentage}%)
                                    </Text>

                                    {bulkProgress.currentNewsletter && (
                                        <Flex direction="column" gap="1" align="center">
                                            <Text size="2" color="gray" align="center" weight="bold">
                                                {bulkProgress.currentNewsletter}
                                            </Text>
                                            {bulkProgress.markedInNewsletter > 0 && (
                                                <Text size="1" color="gray" align="center">
                                                    {bulkProgress.markedInNewsletter} correo{bulkProgress.markedInNewsletter !== 1 ? 's' : ''} procesado{bulkProgress.markedInNewsletter !== 1 ? 's' : ''} de este remitente
                                                </Text>
                                            )}
                                        </Flex>
                                    )}

                                    {bulkProgress.totalMarked > 0 && (
                                        <Text size="2" color={allMarkedAsSpam ? "green" : "red"} align="center" weight="bold">
                                            Total: {bulkProgress.totalMarked} correos procesados
                                        </Text>
                                    )}
                                </Flex>

                                <Button
                                    onClick={onStopProcess}
                                    size="2"
                                    color="red"
                                    variant="outline"
                                    style={{ width: '100%' }}
                                >
                                    <Flex align="center" gap="2">
                                        <XCircle className="h-4 w-4" />
                                        Detener proceso
                                    </Flex>
                                </Button>
                            </>
                        )}
                    </Flex>
                </Box>
            )}
        </Box>
    );
}