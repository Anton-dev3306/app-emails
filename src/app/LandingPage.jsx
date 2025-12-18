"use client";
import {Theme, Button, Strong} from "@radix-ui/themes";
import { Mail } from "lucide-react";
import Container from './components/layout/Container';

export default function LandingPage({ onGetStarted, isLoading }) {
    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
            <Container>
                <section className="py-10  text-center">
                    <div className="max-w-3xl mx-auto">
                        <div className="flex items-center justify-center gap-4 mb-6">
                            <div className="inline-flex items-center justify-center w-15 h-15 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg shadow-blue-500">
                                <Mail className="text-blue-300" size={40} strokeWidth={2} />
                            </div>

                        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight text-balance">
                            Detector de Suscripciones
                            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                Ocultas
              </span>
                        </h1>
                        <p className="text-2xl text-gray-500 mb-5">
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