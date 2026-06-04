import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth } from "../lib/api";
import type { Responsavel } from "@shared/schema";

export function useResponsaveis() {
  return useQuery<Responsavel[]>({
    queryKey: ["/api/responsaveis"],
    queryFn: () => fetchWithAuth("/api/responsaveis"),
  });
}

export function useCreateResponsavel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { nome: string; setor: string; ativo?: boolean }) => {
      const res = await fetchWithAuth("/api/responsaveis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/responsaveis"] });
    },
  });
}

export function useUpdateResponsavel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; nome?: string; setor?: string; ativo?: boolean }) => {
      const res = await fetchWithAuth(`/api/responsaveis/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/responsaveis"] });
    },
  });
}

export function useDeleteResponsavel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await fetchWithAuth(`/api/responsaveis/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/responsaveis"] });
    },
  });
}
