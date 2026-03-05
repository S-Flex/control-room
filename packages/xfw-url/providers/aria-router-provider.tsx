import { useHref } from "../hooks/use-href";
import { useNavigate } from "../hooks/use-navigate";
import { type FC } from "react";
import { RouterProvider } from "react-aria-components";

export const AriaRouterProvider: FC<{ children: React.ReactNode; }> = ({ children }) => {
    const navigate = useNavigate();
    return <RouterProvider navigate={navigate} useHref={useHref}>{children}</RouterProvider>;
};
