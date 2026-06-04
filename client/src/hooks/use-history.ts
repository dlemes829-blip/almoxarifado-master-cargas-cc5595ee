import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { fetchWithAuth } from "../lib/api";

export function useHistory() {
  return useQuery({
    queryKey: [api.history.list.path],
    queryFn: async () => {
      const data = await fetchWithAuth(api.history.list.path);
      return api.history.list.responses[200].parse(data);
    },
  });
}
