import { useMemo } from 'react';
import { useDataGroups, useDataGeneric, type ParamValue } from 'xfw-data';

const DATA_GROUP_NAME = 'production_line_overview';

export type OverviewRow = {
    layout_name: string;
    state: {
        code: string;
        color: string;
        block: Record<string, unknown>;
    };
    resource_uid?: string;
    nest_name?: string;
    job_name?: string;
    page_number?: number;
    start_at?: string;
    duration_seconds?: number | null;
};

export function useProductionLineOverview(model: string, until?: string) {
    const { data: dataGroups } = useDataGroups(DATA_GROUP_NAME);
    const dataGroup = dataGroups?.[0];

    const params = useMemo<ParamValue[]>(() => {
        if (!dataGroup) return [];
        const qp: Record<string, string> = { model };
        if (until) qp.until = until;
        const result: ParamValue[] = dataGroup.params.map(p => ({
            key: p.key,
            val: p.key in qp ? qp[p.key] : (p.default_value ?? p.val ?? null),
        }));
        // Ensure model and until are always present
        for (const [key, val] of Object.entries(qp)) {
            if (!result.some(p => p.key === key)) result.push({ key, val });
        }
        return result;
    }, [dataGroup, model, until]);

    const emptyDataGroup = useMemo(() => ({
        widget_id: '',
        src: '',
        params: [],
        layout: '',
    }), []);

    const { dataRows, dataTable, isLoading, error } = useDataGeneric<OverviewRow>(
        dataGroup ?? emptyDataGroup,
        params,
    );

    // Build a map from layout_name to row for quick lookup
    const rowMap = useMemo(() => {
        const map = new Map<string, OverviewRow>();
        if (dataRows) {
            for (const row of dataRows) {
                if (row.layout_name) map.set(row.layout_name, row);
            }
        }
        return map;
    }, [dataRows]);

    return {
        dataRows,
        dataTable,
        rowMap,
        isLoading: !dataGroup || isLoading,
        error,
    };
}
