"use client";

import { useState, useCallback, useMemo, KeyboardEvent } from "react";
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Star,
  Tag,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useProducts,
  useAddProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/hooks/use-data";
import { toast } from "sonner";
import type { Product, ProductTone } from "@/types";

const CATEGORIES = [
  "Software",
  "SaaS",
  "Developer Tools",
  "Design Tools",
  "Hardware",
  "Open Source",
  "Other",
];

const TONES: { value: ProductTone; label: string }[] = [
  { value: "helpful", label: "Helpful & Knowledgeable" },
  { value: "casual", label: "Casual & Friendly" },
  { value: "technical", label: "Technical & Precise" },
  { value: "enthusiastic", label: "Enthusiastic & Passionate" },
];

interface ProductFormState {
  name: string;
  tagline: string;
  description: string;
  url: string;
  category: string;
  features: string[];
  keywords: string[];
  defaultTone: ProductTone;
  isDefault: boolean;
}

const emptyForm: ProductFormState = {
  name: "",
  tagline: "",
  description: "",
  url: "",
  category: "Software",
  features: [],
  keywords: [],
  defaultTone: "helpful",
  isDefault: false,
};

// ─── Chip Input Component ──────────────────────────────────────────────────

function ChipInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && inputValue.trim()) {
      e.preventDefault();
      const trimmed = inputValue.trim().replace(/,$/, "");
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed]);
      }
      setInputValue("");
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] px-2 py-1.5 min-h-[36px]">
      {value.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full bg-[var(--color-forge-accent-muted)] px-2 py-0.5 text-xs text-[var(--color-forge-accent)]"
        >
          {chip}
          <button
            type="button"
            onClick={() => remove(i)}
            className="hover:text-[var(--color-forge-error)] transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[100px] bg-transparent text-xs text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)] outline-none"
      />
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const { data: products, isLoading } = useProducts();
  const addMutation = useAddProduct();
  const updateMutation = useUpdateProduct();
  const deleteMutation = useDeleteProduct();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const openAddDialog = useCallback(() => {
    setEditingProduct(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      tagline: product.tagline,
      description: product.description,
      url: product.url,
      category: product.category,
      features: [...product.features],
      keywords: [...product.keywords],
      defaultTone: product.defaultTone,
      isDefault: product.isDefault,
    });
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!form.description.trim()) {
      toast.error("Product description is required");
      return;
    }

    if (editingProduct) {
      updateMutation.mutate(
        { id: editingProduct.id, ...form },
        {
          onSuccess: () => {
            toast.success("Product updated");
            setDialogOpen(false);
          },
          onError: (err) => toast.error(err.message),
        }
      );
    } else {
      addMutation.mutate(form, {
        onSuccess: () => {
          toast.success("Product added");
          setDialogOpen(false);
        },
        onError: (err) => toast.error(err.message),
      });
    }
  }, [form, editingProduct, addMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Product deleted");
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(err.message),
    });
  }, [deleteTarget, deleteMutation]);

  const sortedProducts = useMemo(() => {
    if (!products) return [];
    return [...products].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [products]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-[var(--color-forge-text-primary)]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Product Catalog
          </h1>
          <p className="mt-1 text-sm text-[var(--color-forge-text-muted)]">
            Manage your products — select them in Reddit replies, post generators, and more.
          </p>
        </div>
        <Button
          onClick={openAddDialog}
          className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Product
        </Button>
      </div>

      {/* Product Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : sortedProducts.length === 0 ? (
        <Card className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-[var(--color-forge-text-muted)] mb-4" />
            <p className="text-sm text-[var(--color-forge-text-muted)]">
              No products yet. Add your first product to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedProducts.map((product) => (
            <Card
              key={product.id}
              className="border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] hover:bg-[var(--color-forge-bg-card-hover)] transition-colors"
            >
              <CardContent className="p-5 space-y-3">
                {/* Top row: name + badges */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3
                        className="text-base font-semibold text-[var(--color-forge-text-primary)] truncate"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {product.name}
                      </h3>
                      {product.isDefault && (
                        <Badge className="bg-[rgba(232,162,62,0.15)] text-[var(--color-forge-accent)] text-[10px] shrink-0">
                          <Star className="h-2.5 w-2.5 mr-0.5" />
                          Default
                        </Badge>
                      )}
                    </div>
                    {product.tagline && (
                      <p className="text-xs text-[var(--color-forge-text-muted)] mt-0.5 truncate">
                        {product.tagline}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-[rgba(129,140,248,0.15)] text-[var(--color-forge-secondary)] text-[10px] shrink-0 ml-2"
                  >
                    {product.category}
                  </Badge>
                </div>

                {/* Description */}
                <p className="text-sm text-[var(--color-forge-text-secondary)] line-clamp-2">
                  {product.description}
                </p>

                {/* Meta info */}
                <div className="flex flex-wrap gap-2 text-xs text-[var(--color-forge-text-muted)]">
                  {product.features.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {product.features.length} features
                    </span>
                  )}
                  {product.url && (
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-[var(--color-forge-accent)] transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {new URL(product.url).hostname}
                    </a>
                  )}
                </div>

                {/* Keywords */}
                {product.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {product.keywords.slice(0, 4).map((kw, i) => (
                      <span
                        key={i}
                        className="rounded-full border border-[var(--color-forge-border-default)] px-2 py-0.5 text-[10px] text-[var(--color-forge-text-muted)]"
                      >
                        {kw}
                      </span>
                    ))}
                    {product.keywords.length > 4 && (
                      <span className="text-[10px] text-[var(--color-forge-text-muted)] px-1 py-0.5">
                        +{product.keywords.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                {/* Tone badge */}
                <div className="flex items-center gap-1 text-[10px] text-[var(--color-forge-text-muted)]">
                  Tone: {TONES.find((t) => t.value === product.defaultTone)?.label || product.defaultTone}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1 border-t border-[var(--color-forge-border-subtle)]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(product)}
                    className="h-7 text-xs text-[var(--color-forge-text-muted)] hover:text-[var(--color-forge-text-primary)]"
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(product)}
                    className="h-7 text-xs text-[var(--color-forge-text-muted)] hover:text-[var(--color-forge-error)]"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Add / Edit Dialog ──────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] text-[var(--color-forge-text-primary)]">
          <DialogHeader>
            <DialogTitle
              className="text-[var(--color-forge-text-primary)]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {editingProduct ? "Edit Product" : "Add Product"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">
                Name *
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. ForgeCadNeo"
                className="h-8 text-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
              />
            </div>

            {/* Tagline */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">
                Tagline
              </Label>
              <Input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                placeholder="Short tagline..."
                className="h-8 text-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">
                Description *
              </Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this product do?"
                rows={3}
                className="text-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
              />
            </div>

            {/* URL + Category row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--color-forge-text-muted)]">
                  URL
                </Label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://..."
                  type="url"
                  className="h-8 text-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)] text-[var(--color-forge-text-primary)] placeholder:text-[var(--color-forge-text-muted)]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-[var(--color-forge-text-muted)]">
                  Category
                </Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger className="h-8 text-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">
                Features (press Enter to add)
              </Label>
              <ChipInput
                value={form.features}
                onChange={(features) => setForm({ ...form, features })}
                placeholder="e.g. STEP import, parametric modeling..."
              />
            </div>

            {/* Keywords */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">
                Keywords (press Enter to add)
              </Label>
              <ChipInput
                value={form.keywords}
                onChange={(keywords) => setForm({ ...form, keywords })}
                placeholder="e.g. CAD, 3D modeling, engineering..."
              />
            </div>

            {/* Tone */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--color-forge-text-muted)]">
                Default Tone
              </Label>
              <Select
                value={form.defaultTone}
                onValueChange={(v) => setForm({ ...form, defaultTone: v as ProductTone })}
              >
                <SelectTrigger className="h-8 text-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-elevated)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Default checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={form.isDefault}
                onCheckedChange={(checked) =>
                  setForm({ ...form, isDefault: checked === true })
                }
              />
              <Label
                htmlFor="isDefault"
                className="text-xs text-[var(--color-forge-text-secondary)] cursor-pointer"
              >
                Set as default product (auto-selected in generators)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={addMutation.isPending || updateMutation.isPending}
              className="bg-[var(--color-forge-accent)] text-[var(--color-forge-bg-root)] hover:bg-[var(--color-forge-accent-hover)]"
            >
              {editingProduct ? "Save Changes" : "Add Product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm border-[var(--color-forge-border-default)] bg-[var(--color-forge-bg-card)] text-[var(--color-forge-text-primary)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--color-forge-text-primary)]">
              Delete Product
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-forge-text-secondary)]">
            Are you sure you want to delete{" "}
            <span className="font-medium text-[var(--color-forge-text-primary)]">
              {deleteTarget?.name}
            </span>
            ? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-[var(--color-forge-border-default)] text-[var(--color-forge-text-secondary)]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-[var(--color-forge-error)] text-white hover:bg-[var(--color-forge-error)]/90"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
