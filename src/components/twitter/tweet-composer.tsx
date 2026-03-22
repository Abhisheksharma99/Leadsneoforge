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

type TweetTone = "witty" | "professional" | "provocative" | "educational";

interface TweetComposerProps {
  open: boolean;
  onClose: () => void;
  isThread?: boolean;
}

const MAX_TWEET_CHARS = 280;

export function TweetComposer({ open, onClose, isThread: initialThread = false }: TweetComposerProps) {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<TweetTone>("professional");
  const [isThread, setIsThread] = useState(initialThread);
  const [threadLength, setThreadLength] = useState(5);
  const [productName, setProductName] = useState("");
  const [hashtagInput, setHashtagInput] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [generatedContent, setGeneratedContent] = useState("");
  const [threadParts, setThreadParts] = useState<string[]>([]);
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
      const response = await fetch("/api/twitter/generate-tweet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          tone,
          isThread,
          threadLength: isThread ? threadLength : undefined,
          hashtags: hashtags.map((h) => `#${h}`),
          productName: productName || undefined,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Generation failed");
      }
      const result = await response.json();
      setGeneratedContent(result.data.content);
      setThreadParts(result.data.threadParts || []);
      setMethod(result.data.method);
      if (result.data.method === "template") {
        toast.info("Using template (add ANTHROPIC_API_KEY for AI tweets)");
      } else {
        toast.success(isThread ? "Thread generated" : "Tweet generated");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsGenerating(false);
    }
  }, [topic, tone, isThread, threadLength, hashtags, productName]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(generatedContent);
    toast.success("Copied to clipboard");
  }, [generatedContent]);

  const handleCopyPart = useCallback((part: string) => {
    navigator.clipboard.writeText(part);
    toast.success("Tweet copied");
  }, []);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] text-[var(--color-forge-text-primary)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--color-forge-text-primary)]">
            <Wand2 className="h-4 w-4 text-[var(--color-forge-accent)]" />
            {isThread ? "Thread Builder" : "Tweet Composer"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as TweetTone)}>
                <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="witty">Witty</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="provocative">Provocative</SelectItem>
                  <SelectItem value="educational">Educational</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">Type</Label>
              <Select value={isThread ? "thread" : "tweet"} onValueChange={(v) => setIsThread(v === "thread")}>
                <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tweet">Single Tweet</SelectItem>
                  <SelectItem value="thread">Thread</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isThread && (
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--color-forge-text-muted)]">Thread Length</Label>
                <Select value={String(threadLength)} onValueChange={(v) => setThreadLength(Number(v))}>
                  <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 5, 7, 10].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} tweets</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-[var(--color-forge-text-muted)]">Topic</Label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="What do you want to tweet about?"
              className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Product to mention (optional)"
              className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
            />
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
          </div>

          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] bg-[var(--color-forge-accent-muted)] text-[var(--color-forge-accent)] gap-1">
                  #{tag}
                  <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => removeHashtag(tag)} />
                </Badge>
              ))}
            </div>
          )}

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
              <><Wand2 className="mr-2 h-4 w-4" />Generate {isThread ? "Thread" : "Tweet"}</>
            )}
          </Button>

          {generatedContent && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-[var(--color-forge-text-secondary)]">
                  Generated {isThread ? "Thread" : "Tweet"}
                  {method === "template" && <Badge variant="outline" className="ml-2 text-[9px] border-[var(--color-forge-warning)] text-[var(--color-forge-warning)]">Template</Badge>}
                  {method === "ai" && <Badge variant="outline" className="ml-2 text-[9px] border-[var(--color-forge-success)] text-[var(--color-forge-success)]">AI</Badge>}
                </Label>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 text-xs border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]">
                    <Copy className="h-3 w-3 mr-1" />Copy All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open("https://twitter.com/compose/tweet", "_blank")}
                    className="h-7 text-xs border-[var(--color-forge-accent)] text-[var(--color-forge-accent)]"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />Open Twitter
                  </Button>
                </div>
              </div>

              {isThread && threadParts.length > 1 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {threadParts.map((part, i) => (
                    <div key={i} className="rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-medium text-[var(--color-forge-text-muted)]">Tweet {i + 1}/{threadParts.length}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px]" style={{ color: part.length > MAX_TWEET_CHARS ? "var(--color-forge-error)" : "var(--color-forge-text-muted)" }}>
                            {part.length}/{MAX_TWEET_CHARS}
                          </span>
                          <Button variant="ghost" size="sm" onClick={() => handleCopyPart(part)} className="h-5 px-1">
                            <Copy className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-[var(--color-forge-text-primary)] whitespace-pre-wrap">{part}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <Textarea
                    value={generatedContent}
                    onChange={(e) => setGeneratedContent(e.target.value)}
                    rows={4}
                    className="resize-y text-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]"
                  />
                  <div className="flex justify-end">
                    <span className="text-[10px]" style={{ color: generatedContent.length > MAX_TWEET_CHARS ? "var(--color-forge-error)" : "var(--color-forge-text-muted)" }}>
                      {generatedContent.length}/{MAX_TWEET_CHARS}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
