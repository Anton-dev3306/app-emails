"use client";
import { Flex, Text, Button, Avatar, Box } from "@radix-ui/themes";
import { LogOut } from 'lucide-react';

export default function DashboardHeader({ session, onSignOut }) {
    return (
        <Flex direction="column" gap="4" mb="6">
            <Flex justify="between" align="center">
                <Text size="7" weight="bold" style={{ color: '#000' }}></Text>
                <Button onClick={onSignOut} color="red" variant="soft" size="2" style={{ cursor: 'pointer' }}>
                    <LogOut className="h-4 w-4" />
                    Cerrar Sesión
                </Button>
            </Flex>
            <Flex align="center" gap="3">
                {session.user.image ? (
                    <img
                        src={session.user.image}
                        alt="User avatar"
                        style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #e5e7eb'
                        }}
                    />
                ) : (
                    <Avatar
                        size="3"
                        fallback={session.user.email?.charAt(0).toUpperCase() || 'U'}
                        radius="full"
                    />
                )}
                <Box>
                    <Text size="3" weight="bold" style={{ color: '#000' }}>
                        ¡Bienvenido, {session.user.name || session.user.email?.split('@')[0]}!
                    </Text>
                    <br/>
                    <Text size="2" color="gray">{session.user.email}</Text>
                </Box>
            </Flex>
        </Flex>
    );
}