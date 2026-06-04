import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { fetchWithAuth } from "../lib/api";

export function useDashboardStats() {
  return useQuery({
    queryKey: [api.dashboard.stats.path],
    queryFn: async () => {
      const data = await fetchWithAuth(api.dashboard.stats.path);
      const result = api.dashboard.stats.responses[200].safeParse(data);
      if (result.success) {
        return result.data;
      }
      console.warn("[Dashboard] Schema validation failed, using raw data:", result.error.message);
      return data;
    },
  });
}
