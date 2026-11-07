export interface PrivilegeItem {
  id: string;
  name: string;
  code: string;
  description: string;
  category: PrivilegeCategoryKey;
}

export type PrivilegeCategoryKey =
  | 'back_office'
  | 'pos_front_office'
  | 'menu_items'
  | 'inventory_procurement'
  | 'accounting_finance'
  | 'customer_loyalty'
  | 'delivery_dispatch'
  | 'security_audit';

export interface PrivilegeCategory {
  key: PrivilegeCategoryKey;
  label: string;
  description: string;
  privileges: PrivilegeItem[];
}

export interface ReportItem {
  id: string;
  code: string;
  name: string;
  category: 'sales' | 'inventory' | 'finance' | 'operations';
  description: string;
}

export interface OrderSummaryColumn {
  id: string;
  code: string;
  label: string;
  description: string;
  defaultVisible: boolean;
}

export interface RoleDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  isSystem: boolean;
  privileges: string[]; // List of privilege codes
  reports: string[]; // List of report codes
  orderSummaryColumns: string[]; // List of column codes
  userCount?: number;
  updatedAt?: string;
}

export interface EffectiveAccessSummary {
  staffId: string;
  name: string;
  workEmail: string;
  roleId: string;
  roleName: string;
  branchScope: string;
  status: 'active' | 'suspended';
  mustChangePassword: boolean;
  failedLoginAttempts: number;
  lockoutUntil?: number;
  lastLoginAt?: string;
  lastLoginIp?: string;
  effectivePrivileges: string[];
  permittedReports: string[];
  permittedColumns: string[];
  categories: {
    categoryKey: PrivilegeCategoryKey;
    categoryLabel: string;
    totalAvailable: number;
    grantedCount: number;
    privileges: {
      code: string;
      name: string;
      granted: boolean;
    }[];
  }[];
}
