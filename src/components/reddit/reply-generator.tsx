"use client";

import { useState, useCallback } from "react";
import {
  Loader2,
  Copy,
  ExternalLink,
  Wand2,
  RefreshCw,
  MessageSquare,
  Send,
  Mail,
  Package,
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
import { useProducts } from "@/hooks/use-data";
import type { Product } from "@/types";

interface PostInfo {
  title: string;
  content?: string;
  subreddit: string;
  author: string;
  url: string;
  score?: number;
}

interface ReplyGeneratorProps {
  post: PostInfo | null;
  open: boolean;
  onClose: () => void;
}

type Tone = "helpful" | "casual" | "technical" | "enthusiastic";
type ReplyType = "comment" | "dm" | "standalone_post";

export function ReplyGeneratorDialog({ post, open, onClose }: ReplyGeneratorProps) {
  const { data: products } = useProducts();
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [tone, setTone] = useState<Tone>("helpful");
  const [replyType, setReplyType] = useState<ReplyType>("comment");
  const [generatedReply, setGeneratedReply] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [method, setMethod] = useState<string>("");

  const handleProductSelect = useCallback(
    (productId: string) => {
      setSelectedProductId(productId);
      if (productId === "__none__") {
        setProductName("");
        setProductDescription("");
        setProductUrl("");
        return;
      }
      const product = products?.find((p: Product) => p.id === productId);
      if (product) {
        setProductName(product.name);
        setProductDescription(product.description);
        setProductUrl(product.url);
        if (product.defaultTone) setTone(product.defaultTone);
      }
    },
    [products]
  );

  const handleGenerate = useCallback(async () => {
    if (!post) return;
    setIsGenerating(true);

    try {
      const response = await fetch("/api/reddit/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postTitle: post.title,
          postContent: post.content || "",
          subreddit: post.subreddit,
          postAuthor: post.author,
          productName: productName || undefined,
          productDescription: productDescription || undefined,
          productUrl: productUrl || undefined,
          tone,
          replyType,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Generation failed");
      }

      const result = await response.json();
      setGeneratedReply(result.data.reply);
      setMethod(result.data.method);

      if (result.data.method === "template") {
        toast.info("Using template (add GROQ_API_KEY for AI replies)");
      } else {
        toast.success(`Reply generated (${result.data.tokens} tokens)`);
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : "Unknown error";
      toast.error(error);
    } finally {
      setIsGenerating(false);
    }
  }, [post, productName, productDescription, productUrl, tone, replyType]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(generatedReply);
    toast.success("Reply copied to clipboard");
  }, [generatedReply]);

  const handleOpenReddit = useCallback(() => {
    if (post?.url) {
      window.open(post.url, "_blank");
    }
  }, [post]);

  if (!post) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] text-[var(--color-forge-text-primary)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--color-forge-text-primary)]">
            <Wand2 className="h-4 w-4 text-[var(--color-forge-accent)]" />
            Generate Contextual Reply
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Post Preview */}
          <div className="rounded-lg border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] p-3 space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--color-forge-text-muted)]">
              <Badge variant="secondary" className="bg-[rgba(129,140,248,0.15)] text-[var(--color-forge-secondary)] text-[10px]">
                r/{post.subreddit}
              </Badge>
              <span>u/{post.author}</span>
              {post.score !== undefined && <span>{post.score} pts</span>}
            </div>
            <p className="text-sm font-medium text-[var(--color-forge-text-primary)]">
              {post.title}
            </p>
            {post.content && (
              <p className="text-xs text-[var(--color-forge-text-muted)] line-clamp-3">
                {post.content}
              </p>
            )}
          </div>

          {/* Config Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">Tone</Label>
              <Select value={tone} onValueChange={(v) => setTone(v as Tone)}>
                <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="helpful">Helpful & Knowledgeable</SelectItem>
                  <SelectItem value="casual">Casual & Friendly</SelectItem>
                  <SelectItem value="technical">Technical & Precise</SelectItem>
                  <SelectItem value="enthusiastic">Enthusiastic & Passionate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">Reply Type</Label>
              <Select value={replyType} onValueChange={(v) => setReplyType(v as ReplyType)}>
                <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comment">
                    <span className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Comment Reply</span>
                  </SelectItem>
                  <SelectItem value="dm">
                    <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> Direct Message</span>
                  </SelectItem>
                  <SelectItem value="standalone_post">
                    <span className="flex items-center gap-1.5"><Send className="h-3 w-3" /> New Post</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Product Selector */}
          {products && products.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)] flex items-center gap-1">
                <Package className="h-3 w-3" />
                Select Product
              </Label>
              <Select value={selectedProductId} onValueChange={handleProductSelect}>
                <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                  <SelectValue placeholder="Choose a product..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No product (pure value reply)</SelectItem>
                  {products.map((p: Product) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.isDefault ? " (Default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Product Info (optional) */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-[var(--color-forge-text-muted)]">
              Product to mention (optional — leave empty for pure value reply)
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Product name"
                className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
              />
              <Input
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="One-line description"
                className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
              />
              <Input
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="URL"
                className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
              />
            </div>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Crafting reply...
              </>
            ) : generatedReply ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate Reply
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Reply
              </>
            )}
          </Button>

          {/* Generated Reply */}
          {generatedReply && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-[var(--color-forge-text-secondary)]">
                  Generated Reply
                  {method === "template" && (
                    <Badge variant="outline" className="ml-2 text-[9px] border-[var(--color-forge-warning)] text-[var(--color-forge-warning)]">
                      Template
                    </Badge>
                  )}
                  {method === "ai" && (
                    <Badge variant="outline" className="ml-2 text-[9px] border-[var(--color-forge-success)] text-[var(--color-forge-success)]">
                      AI
                    </Badge>
                  )}
                </Label>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="h-7 text-xs border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenReddit}
                    className="h-7 text-xs border-[var(--color-forge-accent)] text-[var(--color-forge-accent)]"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open Post
                  </Button>
                </div>
              </div>
              <Textarea
                value={generatedReply}
                onChange={(e) => setGeneratedReply(e.target.value)}
                rows={8}
                className="resize-y text-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]"
              />
              <p className="text-[10px] text-[var(--color-forge-text-muted)]">
                Edit the reply above before copying. Click &quot;Open Post&quot; to go to the Reddit thread and paste your reply.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
