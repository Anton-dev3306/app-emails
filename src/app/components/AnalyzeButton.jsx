"use client";
import { Button, Flex, Text, Box, Progress } from "@radix-ui/themes";
import { Mail, Loader } from 'lucide-react';

export default function AnalyzeButton({
                                          isAnalyzing,
                                          onAnalyze,
                                          analysisProgress,
                                          finalStats
                                      }) {
    return (
        <Box style={{ width: '100%' }}>
            {!isAnalyzing ? (
                <>
                    <Button
                        onClick={onAnalyze}
                        disabled={isAnalyzing}
                        size="3"
                        style={{ width: '100%' }}
                    >
                        <Flex align="center" gap="2">
                            <Mail className="h-5 w-5" />
                            Analizar Correos
                        </Flex>
                    </Button>

                    {finalStats && (
                        <Box mt="3">
                            <Text size="2" color="gray" align="center" style={{ display: 'block' }}>
                                Último análisis: {finalStats.totalAnalyzed} correos analizados, {finalStats.totalNewsletters} remitentes encontrados.
                            </Text>
                        </Box>
                    )}
                </>
            ) : (
                <Box>
                    <Flex direction="column" gap="3" style={{ width: '100%' }}>
                        <Flex align="center" justify="center" gap="2">
                            <Loader className="animate-spin h-5 w-5" />
                            <Text weight="bold" size="3">
                                {analysisProgress.phase || 'Analizando...'}
                            </Text>
                        </Flex>

                        {analysisProgress.total > 0 && (
                            <>
                                <Box>
                                    <Progress
                                        value={analysisProgress.percentage}
                                        max={100}
                                        size="3"
                                    />
                                </Box>

                                <Text size="2" color="gray" align="center">
                                    {analysisProgress.current} / {analysisProgress.total} correos ({analysisProgress.percentage}%)
                                </Text>
                            </>
                        )}

                        {analysisProgress.total === 0 && analysisProgress.current > 0 && (
                            <Text size="2" color="gray" align="center">
                                {analysisProgress.current} correos encontrados...
                            </Text>
                        )}
                    </Flex>
                </Box>
            )}
        </Box>
    );
}