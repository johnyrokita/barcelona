export type DatabaseStats = {
  databaseCount: number;
  totalSizeBytes: number;
  activeConnections: number;
  postgresVersion: string;
};

export type ManagedProject = {
  slug: string;
  databaseName: string;
  roleName: string;
  passwordPlaintext: string;
  createdAt: string;
  updatedAt: string;
};

export type DatabaseRow = {
  name: string;
  owner: string;
  sizeBytes: number;
  activeConnections: number;
  isManaged: boolean;
  managedSlug?: string;
  createdAt?: string;
};

export type ProjectCredentials = {
  slug: string;
  databaseName: string;
  roleName: string;
  password: string;
  postgresConnectionString: string;
  pgbouncerConnectionString?: string;
  createdAt: string;
};

export type BackupEntry = {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
};

export type AuthUser = {
  id: number;
  email: string;
  isAdmin: boolean;
  isApproved: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
};
