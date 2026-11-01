export interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  currency_code: string;
  timezone: string;
  status: 'active' | 'suspended';
  created_at: string;
}
