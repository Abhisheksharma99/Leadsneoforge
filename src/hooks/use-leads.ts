"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Lead, ApiResponse } from "@/types";

const REFETCH_INTERVAL = 30_000; // 30 seconds

// ─── Fetcher Helper ─────────────────────────────────────────────────────────

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(
      (errorBody as { error?: string }).error || `HTTP ${response.status}`
    );
  }
  const json = (await response.json()) as ApiResponse<T>;
  return json.data;
}

// ─── Leads ──────────────────────────────────────────────────────────────────

export function useLeads() {
  return useQuery<Lead[]>({
    queryKey: ["leads"],
    queryFn: () => fetchApi<Lead[]>("/api/leads"),
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useAddLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: Omit<Lead, "id" | "addedAt">) => {
      return fetchApi<Lead>("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: Partial<Lead> & { id: string }) => {
      return fetchApi<Lead>("/api/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lead),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return fetchApi<{ deleted: boolean }>(`/api/leads?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
}
