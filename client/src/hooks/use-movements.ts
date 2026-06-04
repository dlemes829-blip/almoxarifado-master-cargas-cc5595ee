import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { fetchWithAuth } from "../lib/api";
import { z } from "zod";

export function useMovements() {
  return useQuery({
    queryKey: [api.movements.list.path],
    queryFn: async () => {
      const data = await fetchWithAuth(api.movements.list.path);
      return api.movements.list.responses[200].parse(data);
    },
  });
}

export function useCreateMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (movement: z.infer<typeof api.movements.create.input>) => {
      const data = await fetchWithAuth(api.movements.create.path, {
        method: api.movements.create.method,
        body: JSON.stringify(movement),
      });
      return api.movements.create.responses[201].parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.movements.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.products.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.history.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
    },
  });
}
