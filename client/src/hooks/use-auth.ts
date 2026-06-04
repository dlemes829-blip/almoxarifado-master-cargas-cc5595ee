import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { fetchWithAuth, setToken, clearToken, getToken } from "../lib/api";
import { useLocation } from "wouter";
import { z } from "zod";

export function useAuth() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: user, isLoading, error } = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      if (!getToken()) return null;
      try {
        const data = await fetchWithAuth(api.auth.me.path);
        return api.auth.me.responses[200].parse(data);
      } catch (err) {
        return null;
      }
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: z.infer<typeof api.auth.login.input>) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro no login");
      }

      const data = api.auth.login.responses[200].parse(await res.json());
      return data;
    },
    onSuccess: (data) => {
      setToken(data.token);
      localStorage.setItem("user", JSON.stringify({ id: data.user.id, username: data.user.username }));
      queryClient.setQueryData([api.auth.me.path], data.user);
      setLocation("/");
    },
  });

  const logout = () => {
    clearToken();
    localStorage.removeItem("user");
    queryClient.setQueryData([api.auth.me.path], null);
    setLocation("/login");
  };

  return {
    user,
    isLoading,
    error,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    logout,
  };
}
