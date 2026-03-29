import { useQuery } from "@tanstack/react-query";
import { fetchDataGroups } from "../lib/data";

export function useDataGroups(src: string | undefined) {
    return useQuery({
        queryKey: ["data_group", src],
        queryFn: async () => {
            const result = await fetchDataGroups(src!);
            if (!result.ok) throw new Error(result.error);
            return result.data;
        },
        staleTime: 60 * 60 * 1000,
        enabled: !!src,
    });
}
