"use client";
import { Card, Text, Flex } from "@radix-ui/themes";
import { CheckCircle } from 'lucide-react';

export default function WelcomeCard() {
    return (
        <Card mb="6" color="indigo" variant="surface">
            <Text size="3" weight="medium" mb="3" color="indigo">
                ¿Qué haremos?
            </Text>
            <Flex direction="column" gap="2">
                <Flex align="center" gap="2">
                    <CheckCircle className="h-4 w-4 text-indigo-600" />
                    <Text size="2" color="gray">
                        Analizaremos tus correos de forma segura
                    </Text>
                </Flex>
                <Flex align="center" gap="2">
                    <CheckCircle className="h-4 w-4 text-indigo-600" />
                    <Text size="2" color="gray">
                        Identificaremos tus suscripciones activas
                    </Text>
                </Flex>
                <Flex align="center" gap="2">
                    <CheckCircle className="h-4 w-4 text-indigo-600" />
                    <Text size="2" color="gray">
                        Te mostraremos un resumen detallado
                    </Text>
                </Flex>
            </Flex>
        </Card>
    );
}