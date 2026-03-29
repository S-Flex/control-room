import type { ParamValue } from "@/types/data";
import { createContext, useContext } from "react";

export type CallbackParameters = {
    data?: ParamValue[];
};
export type CallbackFunction = (params: CallbackParameters) => void;
export type CallbacksRecord = Record<string, CallbackFunction>;

const callbackContext = createContext<CallbacksRecord>({});


export const CallbackProvider: React.FC<{ children: React.ReactNode; callbacks: CallbacksRecord; }> = ({ children, callbacks }) => {
    const inheritedCallbacks = useContext(callbackContext);

    return <callbackContext.Provider value={{ ...inheritedCallbacks, ...callbacks }}>
        {children}
    </callbackContext.Provider>;
};

export const useCallbackContext = () => useContext(callbackContext);