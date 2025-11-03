"use client";
import { Card, Flex, Text } from "@radix-ui/themes";
import { CheckCircle, AlertTriangle } from 'lucide-react';

export default function StatusMessage({ status }) {
    if (!status) return null;

    if (status === 'success') {
        return (
            <Card mt="4" style={{ backgroundColor: 'var(--green-3)' }}>
                <Flex align="center" gap="2">
                    <CheckCircle className="h-5 w-5" style={{ color: 'var(--green-11)' }} />
                    <Text style={{ color: 'var(--green-11)' }}>
                        Análisis completado con éxito
                    </Text>
                </Flex>
            </Card>
        );
    }

    if (status === 'error') {
        return (
            <Card mt="4" style={{ backgroundColor: 'var(--red-3)' }}>
                <Flex align="center" gap="2">
                    <AlertTriangle className="h-5 w-5" style={{ color: 'var(--red-11)' }} />
                    <Text style={{ color: 'var(--red-11)' }}>
                        Error al analizar los emails
                    </Text>
                </Flex>
            </Card>
        );
    }

    return null;
}