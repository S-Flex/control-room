import { useQuery } from "@tanstack/react-query";
import { fetchDatatable } from "../lib/data";

export function useDatatable(src: string) {
    return useQuery({
        queryKey: ["datatable", src],
        queryFn: async () => {
            const result = await fetchDatatable(src);
            if (!result.ok) throw new Error(result.error);
            return result.data;
        },
        staleTime: 60 * 60 * 1000,
        enabled: !!src,
    });
}
