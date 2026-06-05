// web/src/types/supplier.ts

export interface Supplier {
  id: number;
  created_by_id: number;
  source_type?: "private" | "platform_network";
  company_name: string;
  logo_url?: string;
  company_title?: string;
  tax_number?: string;
  registration_number?: string;
  phone: string;
  email: string;
  website?: string;
  address?: string;
  city?: string;
  address_district?: string;
  postal_code?: string;
  invoice_name?: string;
  invoice_address?: string;
  invoice_city?: string;
  invoice_district?: string;
  invoice_postal_code?: string;
  reference_score: number;
  notes?: string;
  category?: string;
  category_tags?: string[];
  partner_category_tags?: string[];
  effective_category_tags?: string[];
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at?: string;
  linked_tenant_id?: number | null;
  dual_role_status?: "pending" | "active" | "rejected" | null;
  users?: SupplierUser[];
  quotes?: SupplierQuote[];
}

export interface SupplierUser {
  id: number;
  supplier_id: number;
  name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  email_verified: boolean;
  password_set: boolean;
  is_default?: boolean;
  magic_token?: string;
  magic_token_expires?: string;
  created_at: string;
  updated_at?: string;
}

export interface SupplierQuote {
  id: number;
  quote_id: number;
  supplier_id: number;
  supplier_user_id?: number;
  status: string;
  total_amount: number;
  discount_percent?: number;
  discount_amount?: number;
  final_amount: number;
  payment_terms?: string;
  delivery_time?: number;
  warranty?: string;
  submitted_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface SupplierQuoteItem {
  id: number;
  supplier_quote_id: number;
  quote_item_id: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}
