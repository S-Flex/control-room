import { useAuxRoutes } from "../hooks/use-aux-routes";
import { createContext, useContext } from "react";
import { Routes } from "react-router";

const auxRouteContext = createContext({ main: "/", aux: {} as Record<string, string> });


export const AuxRouteProvider = ({ children }: { children: React.ReactNode; }) => {
    const { main, aux } = useAuxRoutes();

    return <auxRouteContext.Provider value={{ main, aux }}>
        {children}
    </auxRouteContext.Provider>;
};

export const useAuxOutlet = ({ outlet }: { outlet: string; }) => {
    const ctx = useContext(auxRouteContext);
    return ctx.aux[outlet] || undefined;
};

export const useMainRoute = () => {
    const ctx = useContext(auxRouteContext);
    return ctx.main;
};

export const MainRoutes = ({ children }: { children: React.ReactNode; }) => {
    const path = useMainRoute();
    return <Routes location={{ pathname: path }}>
        {children}
    </Routes>;
};

export const AuxRoutes = ({ outlet, children }: { outlet: string; children: React.ReactNode; }) => {
    const path = useAuxOutlet({ outlet });
    if (!path) return null;
    return <Routes location={{ pathname: path }}>
        {children}
    </Routes>;
};
