export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail?: string;
  action: string;
  collection: string;
  documentId: string;
  previousValue?: any;
  newValue?: any;
  timestamp: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}
