"use client";

import { useState, useCallback } from "react";
import {
  Loader2,
  Copy,
  ExternalLink,
  Wand2,
  RefreshCw,
  Hash,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

type PostType = "text" | "article" | "carousel" | "poll";
type Tone = "professional" | "thought_leader" | "storytelling" | "educational";

interface LinkedInPostComposerProps {
  open: boolean;
  onClose: () => void;
}

const MAX_CHARS = 3000;

export function LinkedInPostComposer({ open, onClose }: LinkedInPostComposerProps) {
  const [postType, setPostType] = useState<PostType>("text");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [method, setMethod] = useState<string>("");

  const addHashtag = useCallback(() => {
    const tag = hashtagInput.trim().replace(/^#/, "");
    if (tag && !hashtags.includes(tag)) {
      setHashtags((prev) => [...prev, tag]);
      setHashtagInput("");
    }
  }, [hashtagInput, hashtags]);

  const removeHashtag = useCallback((tag: string) => {
    setHashtags((prev) => prev.filter((h) => h !== tag));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!topic) {
      toast.error("Please enter a topic");
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch("/api/linkedin/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postType,
          topic,
          tone,
          productName: productName || undefined,
          productDescription: productDescription || undefined,
          hashtags: hashtags.map((h) => `#${h}`),
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Generation failed");
      }
      const result = await response.json();
      setGeneratedContent(result.data.content);
      setMethod(result.data.method);
      if (result.data.method === "template") {
        toast.info("Using template (add ANTHROPIC_API_KEY for AI posts)");
      } else {
        toast.success(`Post generated (${result.data.tokens} tokens)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsGenerating(false);
    }
  }, [topic, postType, tone, productName, productDescription, hashtags]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(generatedContent);
    toast.success("Copied to clipboard");
  }, [generatedContent]);

  const charCount = generatedContent.length;
  const charColor = charCount > MAX_CHARS ? "var(--color-forge-error)" : charCount > 2500 ? "var(--color-forge-warning)" : "var(--color-forge-text-muted)";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] text-[var(--color-forge-text-primary)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--color-forge-text-primary)]">
            <Wand2 className="h-4 w-4 text-[var(--color-forge-accent)]" />
            LinkedIn Post Composer
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Config Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">Post Type</Label>
              <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
                <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text Post</SelectItem>
                  <SelectItem value="article">Article</SelectItem>
                  <SelectItem value="carousel">Carousel</SelectItem>
                  <SelectItem value="poll">Poll</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="thought_leader">Thought Leader</SelectItem>
                  <SelectItem value="storytelling">Storytelling</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Topic */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--color-forge-text-muted)]">Topic / Subject</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Why automation is the future of marketing"
              className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
            />
          </div>

          {/* Product Info */}
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Product name (optional)"
              className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
            />
            <Input
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="One-line description"
              className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
            />
          </div>

          {/* Hashtags */}
          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--color-forge-text-muted)]">Hashtags</Label>
            <div className="flex gap-2">
              <Input
                value={hashtagInput}
                onChange={(e) => setHashtagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addHashtag())}
                placeholder="Add hashtag..."
                className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
              />
              <Button variant="outline" size="sm" onClick={addHashtag} className="h-8 px-2 border-[var(--color-forge-border-default)]">
                <Hash className="h-3 w-3" />
              </Button>
            </div>
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {hashtags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[10px] bg-[var(--color-forge-accent-muted)] text-[var(--color-forge-accent)] gap-1">
                    #{tag}
                    <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => removeHashtag(tag)} />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !topic}
            className="w-full bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
          >
            {isGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
            ) : generatedContent ? (
              <><RefreshCw className="mr-2 h-4 w-4" />Regenerate</>
            ) : (
              <><Wand2 className="mr-2 h-4 w-4" />Generate Post</>
            )}
          </Button>

          {/* Generated Content */}
          {generatedContent && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-[var(--color-forge-text-secondary)]">
                  Generated Post
                  {method === "template" && (
                    <Badge variant="outline" className="ml-2 text-[9px] border-[var(--color-forge-warning)] text-[var(--color-forge-warning)]">Template</Badge>
                  )}
                  {method === "ai" && (
                    <Badge variant="outline" className="ml-2 text-[9px] border-[var(--color-forge-success)] text-[var(--color-forge-success)]">AI</Badge>
                  )}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: charColor }}>{charCount}/{MAX_CHARS}</span>
                  <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 text-xs border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]">
                    <Copy className="h-3 w-3 mr-1" />Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("https://www.linkedin.com/feed/", "_blank")}
                    className="h-7 text-xs border-[var(--color-forge-accent)] text-[var(--color-forge-accent)]"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />Open LinkedIn
                  </Button>
                </div>
              </div>
              <Textarea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                rows={10}
                className="resize-y text-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
