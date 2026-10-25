import { z } from 'zod';

export const ProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  sku: z.string().min(1, 'SKU is required').max(50),
  price: z.number().min(0, 'Price must be positive'),
  cost: z.number().min(0, 'Cost must be positive').optional(),
  stock: z.number().int().min(0, 'Stock cannot be negative'),
  category: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  supplier: z.string().max(200).optional(),
  tester: z.boolean().optional(),
});

export const CustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email').max(200).optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const SupplierSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email').max(200).optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const ResellerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email').max(200).optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  discount: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const PurchaseOrderSchema = z.object({
  supplier: z.string().min(1, 'Supplier is required'),
  items: z.array(z.object({
    product: z.string().min(1),
    quantity: z.number().int().min(1),
    unitCost: z.number().min(0),
  })).min(1, 'At least one item required'),
  notes: z.string().max(2000).optional(),
});

export const StockAdjustmentSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().int(),
  type: z.enum(['add', 'remove', 'set']),
  reason: z.string().min(1, 'Reason is required').max(500),
});

export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map(i => i.message);
    return { valid: false, errors, data: null };
  }
  return { valid: true, errors: [], data: result.data };
}
