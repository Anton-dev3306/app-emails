import './globals.css';
import Provider from './providers';

export const metadata = {
    title: 'Detector de Suscripciones',
    description: 'Limpia tu inbox automáticamente',
};

export default function RootLayout({ children }) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body suppressHydrationWarning>
                <Provider>
                    {children}
                </Provider>
            </body>
        </html>
    );
}