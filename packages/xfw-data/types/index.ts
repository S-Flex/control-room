// Type representing any valid JSON-serializable value
export type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONRecord
    | JSONValue[];

export type JSONRecord = { [key: string]: JSONValue; };

export type ParamDefinition = {
    key: string;
    isOptional?: boolean;
    isQueryParam?: boolean;
    /** When value is not used for a query, but is an output of identities (e.g. when a list lets you select an item, it outputs to query params) */
    isIdentOnly?: boolean;
    defaultValue?: JSONValue;
    /** @deprecated default value for a param */
    val?: JSONValue;
};

export type ParamValue = {
    key: string;
    val: JSONValue;
};

export type ApiErrorCode =
    | "network-error"
    | "invalid-json"
    | "bad-request"
    | "unauthorized"
    | "not-found"
    | "server-error"
    | "unknown";

export type ApiResult<T> =
    | { ok: true; data: T; }
    | { ok: false; error: string; code: ApiErrorCode; status?: number; };

export type DataTable = {
    src: string;
    primaryKeys: { key: string; }[];
    params: ParamDefinition[];
    fields: FieldGroup[];
};

export type FieldGroup = {
    title?: string;
    fieldGroupClassName?: string;
    fieldGroupCondFields?: unknown;
    fieldGroup: Field[];
};

export type Field = {
    key: string;
    type: string;
    templateOptions: {
        label: { text: string; ml?: Record<string, unknown>; };
        readOnly?: boolean;
        required?: boolean;
    };
    fieldGroupIsArray?: boolean;
    fieldGroup?: Field[];
    xfw?: {
        inputData?: {
            src: string;
            textField: string;
            valueField: string;
        };
        hidden?: boolean;
        chartRole?: 'x' | 'y' | 'value' | 'name' | 'group' | 'className';
    };
};

export type DataGroup = {
    title?: { text: string; };
    widgetId: string;
    src: string | [string, string];
    params: ParamDefinition[];
    layout: string;
    edit?: { updateMutations: 'direct' | 'save' | 'batch'; };
    isCollapsable?: boolean;
    rowOptions?: {
        colorKey?: string;
        nav?: Record<string, unknown> & { onSelect?: Record<string, unknown>; };
    };
    page?: number;
    footer?: {
        navs?: Record<string, unknown>[];
        className?: string;
    };
    chartConfig?: Record<string, unknown>;
    flowGraphEditorConfig?: Record<string, unknown>;
};

export type DataConfig = {
    baseUrl: string;
    getToken: () => string | null;
};
