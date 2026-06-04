import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { fetchWithAuth } from "../lib/api";
import { z } from "zod";

export function useUsers() {
  return useQuery({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const data = await fetchWithAuth(api.users.list.path);
      return api.users.list.responses[200].parse(data);
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (user: z.infer<typeof api.users.create.input>) => {
      const data = await fetchWithAuth(api.users.create.path, {
        method: api.users.create.method,
        body: JSON.stringify(user),
      });
      return api.users.create.responses[201].parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.users.delete.path, { id });
      await fetchWithAuth(url, { method: api.users.delete.method });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & Partial<z.infer<typeof api.users.create.input>>) => {
      const url = buildUrl(api.users.update.path, { id });
      const data = await fetchWithAuth(url, {
        method: api.users.update.method,
        body: JSON.stringify(updates),
      });
      return api.users.update.responses[200].parse(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
    },
  });
}
