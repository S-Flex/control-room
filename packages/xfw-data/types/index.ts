export type JSONValue =
    | string
    | number
    | boolean
    | null
    | JSONRecord
    | JSONValue[];

export type JSONRecord = { [key: string]: JSONValue; };

// Stubs for types sourced from other packages in the origin project
type I18n<K extends string> = { [P in K]?: string | Record<string, string>; };
type NavItem = Record<string, JSONValue>;
type FlowGraphConfig = Record<string, JSONValue>;

// Props injected into every data-driven layout component by the page/outlet system.
export type DataGenericComponentParams = {
    widget_id: string;
    data_group: DataGroup;
    data_item?: JSONValue;
    data_filter?: JSONValue;
    environment_json: Environment;
    show_errors?: boolean;
};

export type Environment = {
    viewport_mode: boolean;
};

// Carries the raw DB row that defines a DataGroup.
export type DataGroupRow = {
    data_group: string;
    data_group_json: DataGroup[];
};

/**
 * Option source for select/multiSelect/checkbox/radio widgets.
 */
export type InputData =
    | { src: string; value_key: string; label_key: string; options?: never; }
    | { options: Array<Record<string, JSONValue>>; value_key: string; label_key: string; src?: never; };

export type FieldConfig = {
    type?: string;
    input_data?: InputData;
    ui?: Partial<UI>;
};

export type DataGroup = {
    title?: {
        text: string;
    };
    widget_id: string;
    src: string | [string, string];
    params: ParamDefinition[];
    layout: string;
    edit?: {
        update_mutations: 'direct' | 'save' | 'batch';
    };
    is_collapsable?: boolean;
    field_config?: Record<string, FieldConfig>;
    row_options?: {
        color_key?: string;
        nav?: NavItem & {
            on_select?: NavItem;
        };
    };
    page?: number;
    footer?: {
        navs?: NavItem[];
        class_name?: string;
    };
    chart_config?: {
        type?: 'bar' | 'line' | 'donut' | 'pie';
        x_key?: string;
        y_key?: string;
        y_keys?: string[];
        value_key?: string;
        name_key?: string;
        group_by_key?: string;
        class_name_key?: string;
        height?: number;
        show_grid?: boolean;
        curved?: boolean;
        stacked?: boolean;
        show_legend?: boolean;
        inner_radius?: number;
        outer_radius?: number;
        center_label?: string;
        center_value?: string | number;
        class_name?: string;
        color_mapping?: Record<string, string>;
    };
    flow_graph_editor_config?: FlowGraphConfig;
};

// --- Validator types ---

export type FieldRole = {
    role: string;
};

export type SchemaValidator = {
    type: string;
    field_roles: Record<string, FieldRole>;
    trigger?: 'onChange' | 'onBlur';
};

export type ValidatorFunction = (
    params: Record<string, JSONValue>
) => Promise<ValidatorResult>;

export type ValidatorResult =
    | {
        type: 'completion';
        data: Record<string, JSONValue>;
    }
    | {
        type: 'suggestions';
        suggestions: Array<Record<string, JSONValue>>;
    }
    | {
        type: 'error';
        error: string;
        severity: 'error' | 'warning' | 'suggestion';
    };

export type DataTable = {
    data_table: string;
    primary_keys: string[];
    params: ParamDefinition[];
    schema: Record<string, PgField>;
    validators?: SchemaValidator[];
};

export type ParamDefinition = {
    key: string;
    is_optional?: boolean;
    is_query_param?: boolean;
    is_ident_only?: boolean;
    default_value?: JSONValue;
    /** @deprecated use default_value */
    val?: JSONValue;
};

export type ParamValue = {
    key: string;
    val: JSONValue;
};

// --- Schema types ---

export type UI = {
    i18n?: I18n<'label'>;
    order?: number;
    hidden?: boolean;
    read_only?: boolean;
    group?: {
        title?: string;
        class_name?: string;
    };
    table?: {
        sortable?: boolean;
        width?: number;
        hidden?: boolean;
    };
    chart_role?: 'x' | 'y' | 'value' | 'name' | 'group' | 'class_name';
};

export type PgField = {
    pg_type: 'int4' | 'int2' | 'int8' | 'varchar' | 'text' | 'uuid' |
    'bool' | 'numeric' | 'jsonb' | 'timestamptz' | 'date' | string;
    nullable?: boolean;
    max_length?: number;
    precision?: number;
    scale?: number;
    fields?: Record<string, PgField>;
    items?: PgField;
    ref?: InputData;
    ui?: UI;
};

export type ResolvedField = {
    key: string;
    i18n?: I18n<'label'>;
    widget?: string;
    required?: boolean;
    read_only?: boolean;
    input_data?: InputData;
    is_array?: boolean;
    fields?: ResolvedField[];
    num_constraints?: {
        min?: number;
        max?: number;
        step?: number;
    };
};

export type FormGroup = {
    title?: string;
    class_name?: string;
    fields: ResolvedField[];
};

// --- API types (local to this project) ---

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

export type DataConfig = {
    baseUrl: string;
    getToken: () => string | null;
};
