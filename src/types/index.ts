// ─── Reddit Match ───────────────────────────────────────────────────────────
export interface RedditMatch {
  id: string;
  title: string;
  subreddit: string;
  url: string;
  author: string;
  score: number;
  num_comments: number;
  selftext_preview: string;
  matched_keyword: string;
  created_utc: number;
  hours_old: number;
  found_at: string;
}

// ─── Daily Metric ───────────────────────────────────────────────────────────
export interface DailyMetric {
  date: string;
  reddit_post_karma: number | null;
  reddit_comment_karma: number | null;
  reddit_total_karma: number | null;
  website_status: string;
  website_response_ms: number | null;
  reddit_matches_count: number;
  posts_scheduled: number;
  posts_published: number;
}

// ─── Content Post ───────────────────────────────────────────────────────────
export type ContentPostStatus = "pending" | "scheduled" | "posted";

export interface ContentPost {
  number: number;
  title: string;
  status: ContentPostStatus;
  platforms: string[];
  scheduled: string;
  twitter: string;
  linkedin: string;
  hashtags: string;
}

// ─── Directory Entry ────────────────────────────────────────────────────────
export type DirectoryStatus =
  | "pending"
  | "submitted"
  | "approved"
  | "rejected"
  | "live";

export interface DirectoryEntry {
  number: number;
  name: string;
  url: string;
  status: DirectoryStatus;
  submitted: string;
  notes: string;
  category: string;
}

// ─── n8n Workflow ───────────────────────────────────────────────────────────
export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  nodes: N8nNode[];
  tags: N8nTag[];
}

export interface N8nNode {
  id: string;
  name: string;
  type: string;
  position: [number, number];
}

export interface N8nTag {
  id: string;
  name: string;
}

export interface N8nWorkflowListResponse {
  data: N8nWorkflow[];
  nextCursor: string | null;
}

// ─── n8n Execution ──────────────────────────────────────────────────────────
export interface N8nExecution {
  id: number;
  finished: boolean;
  mode: string;
  startedAt: string;
  stoppedAt: string | null;
  workflowId: string;
  workflowName?: string;
  status: "success" | "error" | "running" | "waiting" | "unknown";
}

export interface N8nExecutionListResponse {
  data: N8nExecution[];
  nextCursor: string | null;
}

// ─── Latest Reddit Post ────────────────────────────────────────────────────
export interface LatestRedditPost {
  id: string;
  title: string;
  subreddit: string;
  url: string;
  author: string;
  score: number;
  num_comments: number;
  selftext_preview: string;
  created_utc: number;
  hours_old: number;
}

// ─── Reddit Scan ───────────────────────────────────────────────────────────
export interface ScanRequest {
  keywords: string[];
  subreddits: string[];
}

export interface ScanResult {
  matches: RedditMatch[];
  added: number;
  total: number;
}

// ─── Keyword Suggestion ────────────────────────────────────────────────────
export interface KeywordSuggestion {
  keyword: string;
  relevance: number;
  frequency: number;
  source: "reddit_analysis";
}

export interface SuggestedSubreddit {
  name: string;
  postCount: number;
}

export interface KeywordSuggestionsResult {
  suggestions: KeywordSuggestion[];
  suggestedSubreddits: SuggestedSubreddit[];
  analyzedPosts: number;
}

// ─── Reddit Post ───────────────────────────────────────────────────────────
export interface RedditPostRequest {
  subreddit: string;
  title: string;
  text?: string;
  url?: string;
  flair_id?: string;
}

export interface RedditPostResult {
  posted: boolean;
  method: "api" | "manual";
  submitUrl?: string;
  postUrl?: string;
  postId?: string;
  message: string;
}

export interface RedditPostConfig {
  configured: boolean;
  username: string | null;
  message: string;
}

// ─── LinkedIn ──────────────────────────────────────────────────────────────

export type LinkedInPostType = "text" | "article" | "carousel" | "poll";

export interface LinkedInPost {
  id: string;
  content: string;
  postType: LinkedInPostType;
  hashtags: string[];
  characterCount: number;
  method: "ai" | "template";
}

export interface LinkedInLead {
  id: string;
  name: string;
  title: string;
  company: string;
  industry: string;
  location: string;
  score: number;
  platform: "linkedin";
  status: LeadStatus;
  addedAt: string;
}

export type LinkedInOutreachType = "connection_request" | "inmail" | "follow_up";

export interface LinkedInOutreachMessage {
  id: string;
  messageType: LinkedInOutreachType;
  content: string;
  characterCount: number;
  method: "ai" | "template";
}

// ─── Twitter ───────────────────────────────────────────────────────────────

export interface Tweet {
  id: string;
  content: string;
  characterCount: number;
  hashtags: string[];
  isThread: boolean;
  threadParts?: string[];
  method: "ai" | "template";
}

export interface HashtagSuggestion {
  hashtag: string;
  volume: string;
  relevance: number;
  trending: boolean;
}

// ─── Leads & Outreach ─────────────────────────────────────────────────────

export type LeadPlatform = "linkedin" | "twitter" | "reddit" | "email" | "producthunt" | "hackernews";
export type LeadStatus = "new" | "contacted" | "replied" | "qualified" | "converted" | "lost";

export interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  platform: LeadPlatform;
  status: LeadStatus;
  score: number;
  email?: string;
  profileUrl?: string;
  notes: string;
  addedAt: string;
  lastContactedAt?: string;
}

export interface OutreachStep {
  id: string;
  day: number;
  channel: LeadPlatform;
  action: string;
  messageTemplate: string;
  waitDays: number;
}

export interface OutreachSequence {
  id: string;
  name: string;
  description: string;
  platform: LeadPlatform;
  steps: OutreachStep[];
  method: "ai" | "template";
}

export type OutreachTemplateCategory = "cold_outreach" | "follow_up" | "referral" | "partnership";

export interface OutreachTemplate {
  id: string;
  name: string;
  category: OutreachTemplateCategory;
  platform: LeadPlatform;
  subject?: string;
  body: string;
  variables: string[];
}

// ─── Growth Channels ──────────────────────────────────────────────────────

export type LaunchChecklistPhase = "pre_launch" | "launch_day" | "post_launch";

export interface LaunchChecklistItem {
  id: string;
  phase: LaunchChecklistPhase;
  task: string;
  description: string;
  completed: boolean;
}

export interface ProductHuntLaunch {
  tagline: string;
  description: string;
  makerComment: string;
  checklist: LaunchChecklistItem[];
}

export interface HackerNewsPost {
  title: string;
  body: string;
  postType: "show_hn" | "ask_hn" | "tell_hn";
  tips: string[];
}

// ─── Content Generation (Universal) ───────────────────────────────────────

export interface ContentGenerationRequest {
  platform: LeadPlatform | "producthunt" | "hackernews" | "indiehackers";
  contentType: string;
  topic: string;
  tone?: string;
  productName?: string;
  productDescription?: string;
  additionalContext?: string;
}

export interface ContentGenerationResult {
  content: string;
  platform: string;
  contentType: string;
  method: "ai" | "template";
  characterCount: number;
}

// ─── Product Catalog ─────────────────────────────────────────────────────────

export type ProductTone = "helpful" | "casual" | "technical" | "enthusiastic";

export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  category: string;
  features: string[];
  keywords: string[];
  defaultTone: ProductTone;
  isDefault: boolean;
  createdAt: string;
}

export interface GeneratedPost {
  title: string;
  body: string;
  method: "ai" | "template";
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export type CampaignStatus = "draft" | "active" | "paused" | "completed";
export type ChannelType = "reddit" | "twitter" | "linkedin" | "email" | "blog" | "seo";

export interface CampaignTask {
  id: string;
  title: string;
  channel: ChannelType;
  status: "pending" | "in_progress" | "done";
  dueDate?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  channels: ChannelType[];
  startDate: string;
  endDate?: string;
  budget?: string;
  kpis: {
    impressions: number;
    clicks: number;
    conversions: number;
    engagement: number;
  };
  tasks: CampaignTask[];
  createdAt: string;
}

// ─── API Response Wrapper ───────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface ApiError {
  error: string;
  details?: string;
}
