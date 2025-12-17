"use client";
import { Button, Flex, Text, Box, Progress } from "@radix-ui/themes";
import { Mail, Loader } from 'lucide-react';

export default function AnalyzeButton({ isAnalyzing, onAnalyze }) {
    return (
        <Button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            size="3"
            style={{ width: '100%' }}
        >
            {isAnalyzing ? (
                <Flex align="center" gap="2">
                    <Loader className="animate-spin h-4 w-4" />
                    Analizando...
                </Flex>
            ) : (
                <Flex align="center" gap="2">
                    <Mail className="h-5 w-5" />
                    Analizar Emails
                </Flex>
            )}
        </Button>
    );
}