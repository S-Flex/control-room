export interface Content {
    code: string;
    block: {
        name?: string;
        title?: string;
        description?: string;
        text?: string;
        imageUrl?: string;
        template?: string[];
        params?: string[];
        files?: string[];
        i18n?: Record<string, Record<string, string>>;
        [key: string]: unknown;
    };
}

export type ContentLike = { code: string; block: Record<string, unknown> }
