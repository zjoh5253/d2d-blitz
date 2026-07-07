"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/tables/data-table";
import { ProductForm } from "./product-form";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface CarrierOption {
  id: string;
  name: string;
}

interface ProductRow {
  id: string;
  carrierId: string;
  name: string;
  revenue: number;
  minMarginPercent: number | null;
  active: boolean;
  carrier: { id: string; name: string };
}

interface ProductsClientProps {
  products: ProductRow[];
  carriers: CarrierOption[];
}

export function ProductsClient({ products, carriers }: ProductsClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleAdd() {
    setEditingProduct(null);
    setDialogOpen(true);
  }

  function handleEdit(product: ProductRow) {
    setEditingProduct(product);
    setDialogOpen(true);
  }

  async function handleDelete(product: ProductRow) {
    if (
      !confirm(
        `Delete product "${product.name}" (${product.carrier.name})? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(product.id);
    try {
      await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  const columns = [
    {
      key: "carrier",
      label: "Carrier",
      sortable: true,
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as ProductRow;
        return r.carrier.name;
      },
    },
    {
      key: "name",
      label: "Product",
      sortable: true,
    },
    {
      key: "revenue",
      label: "Revenue",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as ProductRow;
        return `$${r.revenue.toFixed(2)}`;
      },
    },
    {
      key: "minMarginPercent",
      label: "Min Margin",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as ProductRow;
        return r.minMarginPercent != null ? (
          <span>{r.minMarginPercent}%</span>
        ) : (
          <span className="text-muted-foreground italic">carrier default</span>
        );
      },
    },
    {
      key: "active",
      label: "Active",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as ProductRow;
        return r.active ? (
          <Badge variant="default">Active</Badge>
        ) : (
          <span className="text-muted-foreground">Inactive</span>
        );
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (_value: unknown, row: Record<string, unknown>) => {
        const r = row as unknown as ProductRow;
        return (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(r);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              <span className="sr-only">Edit</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={deletingId === r.id}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(r);
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
              <span className="sr-only">Delete</span>
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Products</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Per-carrier product catalog. Each product has its own per-install revenue.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Product
        </Button>
      </div>

      <DataTable
        data={products as unknown as Record<string, unknown>[]}
        columns={columns}
        searchable
        searchKeys={["name", "carrier.name"]}
        pagination
        pageSize={20}
        emptyMessage="No products found. Add one to get started."
      />

      <ProductForm
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
        carriers={carriers}
      />
    </>
  );
}
