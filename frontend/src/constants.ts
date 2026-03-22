export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const NODE_COLORS: Record<string, string> = {
  BusinessPartner: '#60A5FA',
  SalesOrder: '#34D399',
  SalesOrderItem: '#6EE7B7',
  Delivery: '#FB923C',
  BillingDocument: '#C084FC',
  JournalEntry: '#FCD34D',
  Payment: '#2DD4BF',
  Product: '#94A3B8',
  Plant: '#D97706',
};

export const NODE_TYPE_ORDER = [
  'BusinessPartner',
  'SalesOrder',
  'SalesOrderItem',
  'Delivery',
  'BillingDocument',
  'JournalEntry',
  'Payment',
  'Product',
  'Plant',
];
