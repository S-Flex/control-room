import { useHref } from "@/hooks/routing/use-href";
import { useNavigate } from "@/hooks/routing/use-navigate";
import { type FC } from "react";
import { RouterProvider } from "react-aria-components";

export const AriaRouterProvider: FC<{ children: React.ReactNode; }> = ({ children }) => {
    const navigate = useNavigate();
    return <RouterProvider navigate={navigate} useHref={useHref}>{children}</RouterProvider>;
};