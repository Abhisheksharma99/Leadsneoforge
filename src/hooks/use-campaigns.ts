"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Campaign, ApiResponse } from "@/types";

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

// ─── Campaigns ──────────────────────────────────────────────────────────────

export function useCampaigns() {
  return useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: () => fetchApi<Campaign[]>("/api/campaigns"),
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: Omit<Campaign, "id" | "createdAt">) => {
      return fetchApi<Campaign>("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaign),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: Partial<Campaign> & { id: string }) => {
      return fetchApi<Campaign>("/api/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaign),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return fetchApi<{ deleted: boolean }>(`/api/campaigns?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
  });
}
