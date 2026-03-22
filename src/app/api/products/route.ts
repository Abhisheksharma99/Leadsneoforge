import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { Product } from "@/types";

const DATA_DIR = process.env.DATA_DIR || process.cwd() + "/data";

const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");

async function readProducts(): Promise<Product[]> {
  try {
    const content = await fs.readFile(PRODUCTS_FILE, "utf-8");
    return JSON.parse(content) as Product[];
  } catch {
    return [];
  }
}

async function writeProducts(products: Product[]): Promise<void> {
  await fs.writeFile(PRODUCTS_FILE, JSON.stringify(products, null, 2), "utf-8");
}

/**
 * GET /api/products — list all products
 */
export async function GET() {
  try {
    const products = await readProducts();
    return NextResponse.json({ data: products });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to read products", details: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products — create a new product
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, tagline, description, url, category, features, keywords, defaultTone, isDefault } = body;

    if (!name || !description) {
      return NextResponse.json(
        { error: "name and description are required" },
        { status: 400 }
      );
    }

    const products = await readProducts();

    const newProduct: Product = {
      id: crypto.randomUUID(),
      name,
      tagline: tagline || "",
      description,
      url: url || "",
      category: category || "Software",
      features: features || [],
      keywords: keywords || [],
      defaultTone: defaultTone || "helpful",
      isDefault: isDefault ?? false,
      createdAt: new Date().toISOString(),
    };

    // If marking as default, unset other defaults
    if (newProduct.isDefault) {
      for (const p of products) {
        p.isDefault = false;
      }
    }

    products.push(newProduct);
    await writeProducts(products);

    return NextResponse.json({ data: newProduct }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create product", details: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products — update an existing product
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const products = await readProducts();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // If marking as default, unset other defaults
    if (updates.isDefault) {
      for (const p of products) {
        p.isDefault = false;
      }
    }

    products[index] = { ...products[index], ...updates };
    await writeProducts(products);

    return NextResponse.json({ data: products[index] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update product", details: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products — delete a product by id (passed as query param)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id query parameter is required" },
        { status: 400 }
      );
    }

    const products = await readProducts();
    const filtered = products.filter((p) => p.id !== id);

    if (filtered.length === products.length) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    await writeProducts(filtered);

    return NextResponse.json({ data: { deleted: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to delete product", details: message },
      { status: 500 }
    );
  }
}
