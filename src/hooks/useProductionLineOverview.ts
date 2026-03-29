import { useMemo } from 'react';
import { useDataGroups, useDataGeneric } from 'xfw-data';

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

export function useProductionLineOverview() {
    const { data: dataGroups } = useDataGroups(DATA_GROUP_NAME);
    const dataGroup = dataGroups?.[0];

    const emptyDataGroup = useMemo(() => ({
        widget_id: '',
        src: '',
        params: [],
        layout: '',
    }), []);

    const { dataRows, dataTable, isLoading, error } = useDataGeneric<OverviewRow>(
        dataGroup ?? emptyDataGroup,
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
