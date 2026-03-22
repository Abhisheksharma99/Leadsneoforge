"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  RedditMatch,
  DailyMetric,
  ContentPost,
  ContentPostStatus,
  DirectoryEntry,
  DirectoryStatus,
  N8nWorkflow,
  N8nExecution,
  LatestRedditPost,
  ScanRequest,
  ScanResult,
  KeywordSuggestionsResult,
  RedditPostRequest,
  RedditPostResult,
  RedditPostConfig,
  LinkedInPost,
  LinkedInOutreachMessage,
  Tweet,
  HashtagSuggestion,
  ContentGenerationResult,
  OutreachSequence,
  Product,
  GeneratedPost,
  ApiResponse,
} from "@/types";

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

// ─── Reddit Matches ─────────────────────────────────────────────────────────

interface RedditMatchFilters {
  subreddit?: string;
  keyword?: string;
}

export function useRedditMatches(filters?: RedditMatchFilters) {
  const params = new URLSearchParams();
  if (filters?.subreddit) params.set("subreddit", filters.subreddit);
  if (filters?.keyword) params.set("keyword", filters.keyword);
  const queryString = params.toString();
  const url = `/api/reddit/matches${queryString ? `?${queryString}` : ""}`;

  return useQuery<RedditMatch[]>({
    queryKey: ["reddit-matches", filters?.subreddit, filters?.keyword],
    queryFn: () => fetchApi<RedditMatch[]>(url),
    refetchInterval: REFETCH_INTERVAL,
  });
}

// ─── Daily Metrics ──────────────────────────────────────────────────────────

export function useDailyMetrics() {
  return useQuery<DailyMetric[]>({
    queryKey: ["daily-metrics"],
    queryFn: () => fetchApi<DailyMetric[]>("/api/metrics/daily"),
    refetchInterval: REFETCH_INTERVAL,
  });
}

// ─── Content Queue ──────────────────────────────────────────────────────────

export function useContentQueue() {
  return useQuery<ContentPost[]>({
    queryKey: ["content-queue"],
    queryFn: () => fetchApi<ContentPost[]>("/api/content/queue"),
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useUpdateContentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postNumber,
      status,
    }: {
      postNumber: number;
      status: ContentPostStatus;
    }) => {
      return fetchApi<ContentPost[]>("/api/content/queue", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postNumber, status }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-queue"] });
    },
  });
}

// ─── Directories ────────────────────────────────────────────────────────────

export function useDirectories() {
  return useQuery<DirectoryEntry[]>({
    queryKey: ["directories"],
    queryFn: () => fetchApi<DirectoryEntry[]>("/api/directories/list"),
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useUpdateDirectoryStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entryNumber,
      status,
      submittedDate,
    }: {
      entryNumber: number;
      status: DirectoryStatus;
      submittedDate?: string;
    }) => {
      return fetchApi<DirectoryEntry[]>("/api/directories/list", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryNumber, status, submittedDate }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["directories"] });
    },
  });
}

// ─── n8n Workflows ──────────────────────────────────────────────────────────

export function useWorkflows() {
  return useQuery<N8nWorkflow[]>({
    queryKey: ["n8n-workflows"],
    queryFn: () => fetchApi<N8nWorkflow[]>("/api/n8n/workflows"),
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useToggleWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      active,
    }: {
      id: string;
      active: boolean;
    }) => {
      return fetchApi<N8nWorkflow>(`/api/n8n/workflows/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["n8n-workflows"] });
    },
  });
}

export function useRunWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body?: Record<string, unknown>;
    }) => {
      return fetchApi<unknown>(`/api/n8n/workflows/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["n8n-executions"] });
    },
  });
}

// ─── n8n Executions ─────────────────────────────────────────────────────────

export function useExecutions() {
  return useQuery<N8nExecution[]>({
    queryKey: ["n8n-executions"],
    queryFn: () => fetchApi<N8nExecution[]>("/api/n8n/executions"),
    refetchInterval: REFETCH_INTERVAL,
  });
}

// ─── Reddit Scanner ────────────────────────────────────────────────────────

export function useScanReddit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scanRequest: ScanRequest) => {
      return fetchApi<ScanResult>("/api/reddit/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scanRequest),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reddit-matches"] });
    },
  });
}

// ─── Keyword Suggestions ──────────────────────────────────────────────────

export function useSuggestKeywords() {
  return useMutation({
    mutationFn: async ({
      keywords,
      subreddits,
    }: {
      keywords: string[];
      subreddits?: string[];
    }) => {
      return fetchApi<KeywordSuggestionsResult>(
        "/api/reddit/suggest-keywords",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keywords, subreddits }),
        }
      );
    },
  });
}

// ─── Reddit Posting ──────────────────────────────────────────────────────────

export function useRedditPostConfig() {
  return useQuery<RedditPostConfig>({
    queryKey: ["reddit-post-config"],
    queryFn: () => fetchApi<RedditPostConfig>("/api/reddit/post"),
  });
}

export function useRedditPost() {
  return useMutation({
    mutationFn: async (postRequest: RedditPostRequest) => {
      return fetchApi<RedditPostResult>("/api/reddit/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postRequest),
      });
    },
  });
}

// ─── Latest Reddit Posts ───────────────────────────────────────────────────

export function useLatestPosts(subreddit?: string) {
  const params = new URLSearchParams();
  if (subreddit) params.set("subreddit", subreddit);
  const queryString = params.toString();
  const url = `/api/reddit/latest${queryString ? `?${queryString}` : ""}`;

  return useQuery<LatestRedditPost[]>({
    queryKey: ["reddit-latest", subreddit],
    queryFn: () => fetchApi<LatestRedditPost[]>(url),
    refetchInterval: 60_000, // refresh every 60 seconds
  });
}

// ─── LinkedIn Post Generation ──────────────────────────────────────────────

export function useGenerateLinkedInPost() {
  return useMutation({
    mutationFn: async (request: {
      postType: string;
      topic: string;
      tone?: string;
      productName?: string;
      productDescription?: string;
      hashtags?: string[];
    }) => {
      return fetchApi<LinkedInPost>("/api/linkedin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
    },
  });
}

// ─── LinkedIn Outreach Generation ──────────────────────────────────────────

export function useGenerateLinkedInOutreach() {
  return useMutation({
    mutationFn: async (request: {
      messageType: string;
      recipientName: string;
      recipientTitle?: string;
      recipientCompany?: string;
      context?: string;
      productName?: string;
      productDescription?: string;
      tone?: string;
    }) => {
      return fetchApi<LinkedInOutreachMessage>("/api/linkedin/generate-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
    },
  });
}

// ─── Tweet Generation ──────────────────────────────────────────────────────

export function useGenerateTweet() {
  return useMutation({
    mutationFn: async (request: {
      topic: string;
      tone?: string;
      isThread?: boolean;
      threadLength?: number;
      hashtags?: string[];
      productName?: string;
      productDescription?: string;
    }) => {
      return fetchApi<Tweet>("/api/twitter/generate-tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
    },
  });
}

// ─── Hashtag Suggestions ──────────────────────────────────────────────────

export function useSuggestHashtags() {
  return useMutation({
    mutationFn: async (request: {
      topic: string;
      platform?: string;
      count?: number;
    }) => {
      return fetchApi<{ suggestions: HashtagSuggestion[]; topic: string }>("/api/twitter/suggest-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
    },
  });
}

// ─── Universal Content Generation ──────────────────────────────────────────

export function useGenerateContent() {
  return useMutation({
    mutationFn: async (request: {
      platform: string;
      contentType: string;
      topic: string;
      tone?: string;
      productName?: string;
      productDescription?: string;
      additionalContext?: string;
    }) => {
      return fetchApi<ContentGenerationResult>("/api/content/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
    },
  });
}

// ─── Outreach Sequence Generation ──────────────────────────────────────────

export function useGenerateOutreachSequence() {
  return useMutation({
    mutationFn: async (request: {
      platform: string;
      goal: string;
      steps?: number;
      productName?: string;
      productDescription?: string;
      targetAudience?: string;
    }) => {
      return fetchApi<OutreachSequence>("/api/outreach/generate-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
    },
  });
}

// ─── Products ──────────────────────────────────────────────────────────────

export function useProducts() {
  return useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: () => fetchApi<Product[]>("/api/products"),
    refetchInterval: REFETCH_INTERVAL,
  });
}

export function useAddProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Omit<Product, "id" | "createdAt">) => {
      return fetchApi<Product>("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Partial<Product> & { id: string }) => {
      return fetchApi<Product>("/api/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return fetchApi<{ deleted: boolean }>(`/api/products?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useGenerateProductPost() {
  return useMutation({
    mutationFn: async (request: { productId: string; subreddit: string }) => {
      return fetchApi<GeneratedPost>("/api/products/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
    },
  });
}
