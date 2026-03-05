import { type KeyValue } from "../lib/url";
import { useStableNavigate } from "../providers/navigation-provider";
import type { ParamValue } from "../types";


export type NavigateParams = {
    partialPath?: string;
    path?: string;
    outlets?: KeyValue[];
    queryParams?: ParamValue[];
} | string;

export const useNavigate = () => {

    return useStableNavigate();
};
