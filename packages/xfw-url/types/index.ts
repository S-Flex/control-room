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
