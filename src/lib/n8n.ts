import type {
  N8nWorkflowListResponse,
  N8nExecutionListResponse,
} from "@/types";

const N8N_BASE_URL = process.env.N8N_BASE_URL || "http://localhost:5678";
const N8N_API_KEY = process.env.N8N_API_KEY || "";

interface N8nFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: Record<string, unknown>;
}

/**
 * Make an authenticated request to the n8n API.
 * Uses the X-N8N-API-KEY header for authentication.
 */
async function n8nFetch<T>(
  path: string,
  options: N8nFetchOptions = {}
): Promise<T> {
  const { method = "GET", body } = options;

  const url = `${N8N_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "X-N8N-API-KEY": N8N_API_KEY,
    "Content-Type": "application/json",
  };

  const fetchOptions: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `n8n API error: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  return response.json() as Promise<T>;
}

// ─── Workflows ──────────────────────────────────────────────────────────────

export async function listWorkflows(): Promise<N8nWorkflowListResponse> {
  return n8nFetch<N8nWorkflowListResponse>("/api/v1/workflows");
}

export async function getWorkflow(id: string) {
  return n8nFetch<N8nWorkflowListResponse["data"][0]>(
    `/api/v1/workflows/${id}`
  );
}

export async function activateWorkflow(id: string) {
  return n8nFetch(`/api/v1/workflows/${id}/activate`, { method: "POST" });
}

export async function deactivateWorkflow(id: string) {
  return n8nFetch(`/api/v1/workflows/${id}/deactivate`, { method: "POST" });
}

export async function runWorkflow(id: string) {
  return n8nFetch<{ data: { id: string } }>("/api/v1/executions", {
    method: "POST",
    body: { workflowId: id },
  });
}

// ─── Executions ─────────────────────────────────────────────────────────────

export async function listExecutions(
  limit: number = 20
): Promise<N8nExecutionListResponse> {
  return n8nFetch<N8nExecutionListResponse>(
    `/api/v1/executions?limit=${limit}&includeData=false`
  );
}
