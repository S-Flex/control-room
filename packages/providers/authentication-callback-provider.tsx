import { loginUser, logout } from "@/lib/auth/authClient";
import { disconnectSocket } from "@/lib/socket";
import { useMemo } from "react";
import { CallbackProvider, type CallbacksRecord } from "./callback-provider";

/** Provides all authentication related callbacks to the application. */
export const AuthenticationCallbackProvider = ({ children }: { children: React.ReactNode; }) => {

    const callbacks = useMemo(() => {
        return {
            'auth.login': async (params) => {
                if (!params || !params.data)
                    throw new Error("No login parameters provided");

                const email = params.data.find(p => p.key === "email")?.val;
                const password = params.data.find(p => p.key === "password")?.val;

                if (typeof email !== "string" || typeof password !== "string")
                    throw new Error("Invalid login parameters");

                if (await loginUser({ email, password }))
                    window.location.reload();
            },
            'auth.logout': async () => {
                disconnectSocket();
                await logout();
                window.location.reload();
            }
        } satisfies CallbacksRecord;
    }, []);

    return <CallbackProvider callbacks={callbacks}>{children}</CallbackProvider>;
};