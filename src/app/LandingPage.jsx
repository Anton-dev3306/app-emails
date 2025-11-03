"use client";
import { Theme, Button } from "@radix-ui/themes";
import { Mail } from "lucide-react";
import Container from './components/layout/Container';

export default function LandingPage({ onGetStarted, isLoading }) {
    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
            <Container>
                <section className="py-20 text-center">
                    <div className="max-w-3xl mx-auto">
                        <div className="inline-flex items-center justify-center p-2 mb-6 bg-blue-100 rounded-full">
                            <Mail className="text-blue-600" size={48} />
                        </div>
                        <h1 className="text-5xl font-bold text-gray-900 mb-6">
                            Detector de Suscripciones Ocultas
                        </h1>
                        <p className="text-xl text-gray-600 mb-8">
                            Conecta tu Gmail y descubre todas las suscripciones que olvidaste.
                        </p>
                        <Theme>
                            <Button
                                onClick={onGetStarted}
                                disabled={isLoading}
                                size="3"
                                className="px-6"
                            >
                                {isLoading ? (
                                    <span className="flex items-center">
                                        <span className="animate-spin mr-2">⌛</span>
                                        Iniciando sesión...
                                    </span>
                                ) : (
                                    <span className="flex items-center">
                                        <Mail className="mr-2 h-5 w-5" />
                                        Comenzar Ahora
                                    </span>
                                )}
                            </Button>
                        </Theme>
                    </div>
                </section>
            </Container>
        </div>
    );
}