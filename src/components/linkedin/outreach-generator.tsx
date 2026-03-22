"use client";

import { useState, useCallback } from "react";
import {
  Loader2,
  Copy,
  Wand2,
  RefreshCw,
  UserPlus,
  Mail,
  Reply,
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

type MessageType = "connection_request" | "inmail" | "follow_up";
type Tone = "professional" | "casual" | "direct";

interface OutreachGeneratorProps {
  open: boolean;
  onClose: () => void;
  recipientName?: string;
  recipientTitle?: string;
  recipientCompany?: string;
}

export function OutreachGenerator({ open, onClose, recipientName: initialName, recipientTitle: initialTitle, recipientCompany: initialCompany }: OutreachGeneratorProps) {
  const [messageType, setMessageType] = useState<MessageType>("connection_request");
  const [tone, setTone] = useState<Tone>("professional");
  const [recipientName, setRecipientName] = useState(initialName || "");
  const [recipientTitle, setRecipientTitle] = useState(initialTitle || "");
  const [recipientCompany, setRecipientCompany] = useState(initialCompany || "");
  const [context, setContext] = useState("");
  const [productName, setProductName] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [method, setMethod] = useState<string>("");

  const charLimit = messageType === "connection_request" ? 300 : messageType === "inmail" ? 2000 : 1000;

  const handleGenerate = useCallback(async () => {
    if (!recipientName) {
      toast.error("Recipient name is required");
      return;
    }
    setIsGenerating(true);
    try {
      const response = await fetch("/api/linkedin/generate-outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageType,
          recipientName,
          recipientTitle: recipientTitle || undefined,
          recipientCompany: recipientCompany || undefined,
          context: context || undefined,
          productName: productName || undefined,
          tone,
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
        toast.info("Using template (add GROQ_API_KEY for AI messages)");
      } else {
        toast.success("Outreach message generated");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsGenerating(false);
    }
  }, [messageType, recipientName, recipientTitle, recipientCompany, context, productName, tone]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(generatedContent);
    toast.success("Copied to clipboard");
  }, [generatedContent]);

  const charCount = generatedContent.length;
  const charColor = charCount > charLimit ? "var(--color-forge-error)" : charCount > charLimit * 0.8 ? "var(--color-forge-warning)" : "var(--color-forge-text-muted)";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] text-[var(--color-forge-text-primary)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[var(--color-forge-text-primary)]">
            <Wand2 className="h-4 w-4 text-[var(--color-forge-accent)]" />
            LinkedIn Outreach Generator
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">Message Type</Label>
              <Select value={messageType} onValueChange={(v) => setMessageType(v as MessageType)}>
                <SelectTrigger className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="connection_request">
                    <span className="flex items-center gap-1.5"><UserPlus className="h-3 w-3" /> Connection Request</span>
                  </SelectItem>
                  <SelectItem value="inmail">
                    <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> InMail</span>
                  </SelectItem>
                  <SelectItem value="follow_up">
                    <span className="flex items-center gap-1.5"><Reply className="h-3 w-3" /> Follow-up</span>
                  </SelectItem>
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
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Recipient name *" className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
            <Input value={recipientTitle} onChange={(e) => setRecipientTitle(e.target.value)} placeholder="Job title" className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
            <Input value={recipientCompany} onChange={(e) => setRecipientCompany(e.target.value)} placeholder="Company" className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input value={context} onChange={(e) => setContext(e.target.value)} placeholder="Context (e.g., shared a great article)" className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
            <Input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Product to mention (optional)" className="h-8 text-xs border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]" />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !recipientName}
            className="w-full bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
          >
            {isGenerating ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
            ) : generatedContent ? (
              <><RefreshCw className="mr-2 h-4 w-4" />Regenerate</>
            ) : (
              <><Wand2 className="mr-2 h-4 w-4" />Generate Message</>
            )}
          </Button>

          {generatedContent && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-[var(--color-forge-text-secondary)]">
                  Generated Message
                  {method === "template" && <Badge variant="outline" className="ml-2 text-[9px] border-[var(--color-forge-warning)] text-[var(--color-forge-warning)]">Template</Badge>}
                  {method === "ai" && <Badge variant="outline" className="ml-2 text-[9px] border-[var(--color-forge-success)] text-[var(--color-forge-success)]">AI</Badge>}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-[10px]" style={{ color: charColor }}>{charCount}/{charLimit}</span>
                  <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 text-xs border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]">
                    <Copy className="h-3 w-3 mr-1" />Copy
                  </Button>
                </div>
              </div>
              <Textarea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                rows={6}
                className="resize-y text-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)]"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
