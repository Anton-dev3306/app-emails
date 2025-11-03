import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            authorization: {
                params: {
                    scope: [
                        'https://www.googleapis.com/auth/gmail.readonly ' ,
                        'https://www.googleapis.com/auth/userinfo.profile ' ,
                        'https://www.googleapis.com/auth/userinfo.email',
                        'https://www.googleapis.com/auth/gmail.modify',
                        'https://www.googleapis.com/auth/gmail.send'].join(' '),
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        })
    ],
    callbacks: {
        async jwt({ token, account, trigger }) {
            // Inicial o actualización del token
            if (account) {
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.expiresAt = account.expires_at * 1000; // Convertir a milisegundos
            }

            // Verificar si el token está por expirar (5 minutos antes)
            if (token.expiresAt && Date.now() > token.expiresAt - 300000) {
                try {
                    const response = await fetch('https://oauth2.googleapis.com/token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams({
                            client_id: process.env.GOOGLE_CLIENT_ID,
                            client_secret: process.env.GOOGLE_CLIENT_SECRET,
                            grant_type: 'refresh_token',
                            refresh_token: token.refreshToken,
                        }),
                    });

                    const tokens = await response.json();
                    if (!response.ok) throw tokens;

                    token.accessToken = tokens.access_token;
                    token.expiresAt = Date.now() + (tokens.expires_in * 1000);
                } catch (error) {
                    console.error('Error refreshing access token', error);
                    token.error = 'RefreshAccessTokenError';
                }
            }

            return token;
        },
        async session({ session, token }) {
            session.accessToken = token.accessToken;
            session.error = token.error;
            return session;
        }
    },
    secret: process.env.NEXTAUTH_SECRET,
    // Agregar eventos para manejar la desvinculación
    events: {
        async signOut({ token }) {
            if (token.accessToken) {
                try {
                    await fetch('https://oauth2.googleapis.com/revoke', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: `token=${token.accessToken}`,
                    });
                } catch (error) {
                    console.error('Error revoking token', error);
                }
            }
        },
    },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };