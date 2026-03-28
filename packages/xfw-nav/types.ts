export type JSONValue =
    | string
    | number
    | boolean
    | null
    | { [key: string]: JSONValue }
    | JSONValue[];

export type JSONRecord = { [key: string]: JSONValue };

export type NavItemConditionOp = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'not_in';

export interface NavItemCondition {
    key: string;
    op?: NavItemConditionOp;
    value: JSONValue;
}

export type NavItemConditionGroup =
    | { and: NavItemConditionExpr[] }
    | { or: NavItemConditionExpr[] };

export type NavItemConditionExpr = NavItemCondition | NavItemConditionGroup;

export interface NavItem {
    nav_item_id?: number | string;
    code?: string;
    icon?: string;
    i18n?: Record<string, Record<string, string>>;
    block?: Record<string, unknown>;
    type?: string;
    text?: string;
    disable_active_style?: boolean;
    hidden_when?: NavItemConditionExpr | NavItemConditionExpr[];
    func?: string;
    path?: string;
    outlet?: string;
    params?: { key: string; default_value?: JSONValue; val?: JSONValue }[];
    keyboard_shortcut?: string;
    data_group?: string;
    menu?: NavItem[];
    condition?: string;
}
