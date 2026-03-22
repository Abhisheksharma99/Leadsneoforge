import type {
  DailyMetric,
  ContentPost,
  ContentPostStatus,
  DirectoryEntry,
  DirectoryStatus,
} from "@/types";

// ─── CSV Parser ─────────────────────────────────────────────────────────────

/**
 * Parse daily-metrics.csv content into DailyMetric objects.
 * Handles N/A values by converting them to null.
 */
export function parseDailyMetricsCSV(csvContent: string): DailyMetric[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const metrics: DailyMetric[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });

    metrics.push({
      date: row["date"] ?? "",
      reddit_post_karma: parseNullableNumber(row["reddit_post_karma"]),
      reddit_comment_karma: parseNullableNumber(row["reddit_comment_karma"]),
      reddit_total_karma: parseNullableNumber(row["reddit_total_karma"]),
      website_status: row["website_status"] ?? "",
      website_response_ms: parseNullableNumber(row["website_response_ms"]),
      reddit_matches_count: parseInt(row["reddit_matches_count"] ?? "0", 10) || 0,
      posts_scheduled: parseInt(row["posts_scheduled"] ?? "0", 10) || 0,
      posts_published: parseInt(row["posts_published"] ?? "0", 10) || 0,
    });
  }

  return metrics;
}

function parseNullableNumber(value: string | undefined): number | null {
  if (!value || value === "N/A" || value === "n/a" || value === "") {
    return null;
  }
  const num = parseFloat(value);
  return isNaN(num) ? null : num;
}

// ─── Content Queue Markdown Parser ──────────────────────────────────────────

/**
 * Parse content-queue.md into ContentPost objects.
 * Each post is separated by "---" and starts with "## Post N — Title"
 */
export function parseContentQueueMarkdown(mdContent: string): ContentPost[] {
  const posts: ContentPost[] = [];
  const sections = mdContent.split(/^---$/m);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Match "## Post N — Title"
    const titleMatch = trimmed.match(/^##\s+Post\s+(\d+)\s*[—–-]\s*(.+)$/m);
    if (!titleMatch) continue;

    const postNumber = parseInt(titleMatch[1], 10);
    const postTitle = titleMatch[2].trim();

    const status = extractField(trimmed, "status") as ContentPostStatus || "pending";
    const platformStr = extractField(trimmed, "platform");
    const platforms = platformStr ? platformStr.split(",").map((p) => p.trim()) : [];
    const scheduled = extractField(trimmed, "scheduled") || "";
    const twitter = extractField(trimmed, "twitter") || "";
    const linkedin = extractField(trimmed, "linkedin") || "";
    const hashtags = extractField(trimmed, "hashtags") || "";

    posts.push({
      number: postNumber,
      title: postTitle,
      status,
      platforms,
      scheduled,
      twitter,
      linkedin,
      hashtags,
    });
  }

  return posts;
}

function extractField(text: string, field: string): string {
  // Match "- field: value" where value continues to end of line
  const regex = new RegExp(`^-\\s+${field}:\\s*(.+)$`, "m");
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Update a post's status in the content-queue.md raw content.
 * Returns the updated markdown string.
 */
export function updateContentPostStatus(
  mdContent: string,
  postNumber: number,
  newStatus: ContentPostStatus
): string {
  // Find the section for this post and update the status line
  const postHeaderRegex = new RegExp(
    `(##\\s+Post\\s+${postNumber}\\s*[—–-].*\\n(?:.*\\n)*?- status:\\s*)([a-z]+)`,
    "m"
  );
  return mdContent.replace(postHeaderRegex, `$1${newStatus}`);
}

// ─── Directories Markdown Parser ────────────────────────────────────────────

/**
 * Parse directories.md into DirectoryEntry objects.
 * Extracts table rows under category headings.
 */
export function parseDirectoriesMarkdown(mdContent: string): DirectoryEntry[] {
  const entries: DirectoryEntry[] = [];
  const categoryPattern = /^##\s+(.+?)(?:\s*$)/gm;
  const tableRowPattern = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/gm;

  // Split content into sections by category headers
  const lines = mdContent.split("\n");
  let currentCategory = "";

  for (const line of lines) {
    // Check if this line is a category heading
    const catMatch = line.match(/^##\s+(.+)/);
    if (catMatch) {
      const heading = catMatch[1].trim();
      // Only use headings that look like directory categories
      if (
        heading.includes("Directories") ||
        heading.includes("Platforms") ||
        heading.includes("SEO") ||
        heading.includes("Business") ||
        heading.includes("Community") ||
        heading.includes("Niche") ||
        heading.includes("Engineering") ||
        heading.includes("Startup") ||
        heading.includes("SaaS") ||
        heading.includes("AI Tool")
      ) {
        currentCategory = heading;
      }
      continue;
    }

    // Check if this line is a table data row
    const rowMatch = line.match(
      /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(https?:\/\/[^\s|]+(?:\s*[^\s|]*)*)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/
    );
    if (rowMatch && currentCategory) {
      entries.push({
        number: parseInt(rowMatch[1], 10),
        name: rowMatch[2].trim(),
        url: rowMatch[3].trim(),
        status: rowMatch[4].trim() as DirectoryStatus,
        submitted: rowMatch[5].trim(),
        notes: rowMatch[6].trim(),
        category: currentCategory,
      });
    }
  }

  return entries;
}

/**
 * Update a directory entry's status in the markdown content.
 * Returns the updated markdown string.
 */
export function updateDirectoryStatus(
  mdContent: string,
  entryNumber: number,
  newStatus: DirectoryStatus,
  submittedDate?: string
): string {
  // Match the table row with this entry number and replace the status
  const pattern = new RegExp(
    `(\\|\\s*${entryNumber}\\s*\\|[^|]+\\|[^|]+\\|\\s*)\\w+(\\s*\\|\\s*)([^|]+)(\\s*\\|)`,
    "m"
  );

  let updated = mdContent.replace(pattern, (match, prefix, sep, datePart, suffix) => {
    const dateValue = submittedDate || datePart.trim();
    return `${prefix}${newStatus}${sep}${dateValue}${suffix}`;
  });

  return updated;
}
