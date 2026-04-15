"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AuthUser,
  BackupEntry,
  DatabaseRow,
  DatabaseStats,
} from "@/lib/database-types";
import { cn } from "@/lib/utils";

type StatsResponse =
  | {
      ok: true;
      data: DatabaseStats;
    }
  | {
      ok: false;
      error: string;
    };

type ProjectsResponse =
  | {
      ok: true;
      data: DatabaseRow[];
    }
  | {
      ok: false;
      error: string;
    };

type BackupResponse =
  | {
      ok: true;
      message: string;
      data: Pick<BackupEntry, "fileName" | "filePath">;
    }
  | {
      ok: false;
      error: string;
    };

type PendingUsersResponse =
  | {
      ok: true;
      data: AuthUser[];
    }
  | {
      ok: false;
      error: string;
    };

function formatBytes(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;

  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value)} ${units[exponent]}`;
}

function formatDate(value?: string) {
  if (!value) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function Home({ currentUser }: { currentUser: AuthUser }) {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [projects, setProjects] = useState<DatabaseRow[]>([]);
  const [pageError, setPageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [backupLoadingName, setBackupLoadingName] = useState<string | null>(
    null,
  );
  const [backupError, setBackupError] = useState<string | null>(null);
  const [pendingUsers, setPendingUsers] = useState<AuthUser[]>([]);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [approveLoadingId, setApproveLoadingId] = useState<number | null>(null);
  const [removeLoadingId, setRemoveLoadingId] = useState<number | null>(null);

  useEffect(() => {
    void refreshDashboard();
  }, []);

  async function refreshDashboard() {
    setLoading(true);
    setPageError(null);

    try {
      const [statsResponse, projectsResponse] = await Promise.all([
        fetch("/api/db/stats", { cache: "no-store" }),
        fetch("/api/projects", { cache: "no-store" }),
      ]);

      const [statsResult, projectsResult] = (await Promise.all([
        statsResponse.json(),
        projectsResponse.json(),
      ])) as [StatsResponse, ProjectsResponse];

      if (!statsResponse.ok || !statsResult.ok) {
        throw new Error(
          "error" in statsResult ? statsResult.error : "Failed to load stats",
        );
      }

      if (!projectsResponse.ok || !projectsResult.ok) {
        throw new Error(
          "error" in projectsResult
            ? projectsResult.error
            : "Failed to load projects",
        );
      }

      setStats(statsResult.data);
      setProjects(
        [...projectsResult.data].sort((left, right) => {
          if (left.isManaged === right.isManaged) {
            return left.name.localeCompare(right.name);
          }

          return left.isManaged ? -1 : 1;
        }),
      );
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "Failed to load dashboard data",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (currentUser.isAdmin) {
      void refreshPendingUsers();
    }
  }, [currentUser.isAdmin]);

  async function refreshPendingUsers() {
    setPendingError(null);

    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store",
      });
      const result = (await response.json()) as PendingUsersResponse;

      if (!response.ok || !result.ok) {
        throw new Error(
          "error" in result ? result.error : "Failed to load pending users",
        );
      }

      setPendingUsers(result.data);
    } catch (error) {
      setPendingError(
        error instanceof Error ? error.message : "Failed to load pending users",
      );
    }
  }

  async function handleBackup(databaseName: string) {
    setBackupLoadingName(databaseName);
    setBackupError(null);

    try {
      const response = await fetch("/api/db/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: databaseName }),
      });
      const result = (await response.json()) as BackupResponse;

      if (!response.ok || !result.ok) {
        throw new Error(
          "error" in result ? result.error : "Failed to create backup",
        );
      }

      toast.success(
        `${databaseName} backed up to ${result.data?.fileName ?? "a new backup file"}`,
      );
    } catch (error) {
      setBackupError(
        error instanceof Error ? error.message : "Failed to create backup",
      );
    } finally {
      setBackupLoadingName(null);
    }
  }

  async function handleApproveUser(userId: number) {
    setApproveLoadingId(userId);
    setPendingError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}/approve`, {
        method: "POST",
      });
      const result = (await response.json()) as
        | { ok: true }
        | { ok: false; error: string };

      if (!response.ok || !result.ok) {
        throw new Error(
          "error" in result ? result.error : "Failed to approve user",
        );
      }

      await refreshPendingUsers();
    } catch (error) {
      setPendingError(
        error instanceof Error ? error.message : "Failed to approve user",
      );
    } finally {
      setApproveLoadingId(null);
    }
  }

  async function handleRemoveUser(userId: number) {
    setRemoveLoadingId(userId);
    setPendingError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as
        | { ok: true }
        | { ok: false; error: string };

      if (!response.ok || !result.ok) {
        throw new Error(
          "error" in result ? result.error : "Failed to remove user",
        );
      }

      await refreshPendingUsers();
    } catch (error) {
      setPendingError(
        error instanceof Error ? error.message : "Failed to remove user",
      );
    } finally {
      setRemoveLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex justify-end">
        <Link
          href="/databases/new"
          className={cn(buttonVariants({ variant: "default" }))}
        >
          Create a database
        </Link>
      </div>

      {pageError ? (
        <Alert variant="destructive">
          <AlertTitle>Dashboard unavailable</AlertTitle>
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      ) : null}

      {backupError ? (
        <Alert variant="destructive">
          <AlertTitle>Backup failed</AlertTitle>
          <AlertDescription>{backupError}</AlertDescription>
        </Alert>
      ) : null}

      {currentUser.isAdmin && (pendingUsers.length > 0 || pendingError) ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending user approvals</CardTitle>
            <CardDescription>
              The first account is auto-approved admin. Later accounts need an
              admin approval before they can sign in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingError ? (
              <Alert variant="destructive">
                <AlertTitle>Approval error</AlertTitle>
                <AlertDescription>{pendingError}</AlertDescription>
              </Alert>
            ) : null}

            {pendingUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No users are waiting for approval.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="font-medium">{user.email}</div>
                      <div className="text-sm text-muted-foreground">
                        Requested {formatDate(user.createdAt)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={removeLoadingId === user.id}
                        onClick={() => void handleRemoveUser(user.id)}
                      >
                        {removeLoadingId === user.id ? "Removing..." : "Remove"}
                      </Button>
                      <Button
                        type="button"
                        disabled={approveLoadingId === user.id}
                        onClick={() => void handleApproveUser(user.id)}
                      >
                        {approveLoadingId === user.id
                          ? "Approving..."
                          : "Approve"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Databases"
          value={stats?.databaseCount}
          loading={loading}
        />
        <StatCard
          label="Total size"
          value={stats ? formatBytes(stats.totalSizeBytes) : undefined}
          loading={loading}
        />
        <StatCard
          label="Active connections"
          value={stats?.activeConnections}
          loading={loading}
        />
        <StatCard
          label="Postgres version"
          value={stats?.postgresVersion}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Databases</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Connections</TableHead>
                <TableHead>Managed</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.name}>
                  <TableCell className="font-mono">{project.name}</TableCell>
                  <TableCell className="font-mono">{project.owner}</TableCell>
                  <TableCell>{formatBytes(project.sizeBytes)}</TableCell>
                  <TableCell>{project.activeConnections}</TableCell>
                  <TableCell>
                    {project.isManaged ? (
                      <Badge
                        variant="secondary"
                        className="bg-lime-200 dark:bg-lime-600 min-w-18"
                      >
                        Managed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="min-w-18">
                        External
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(project.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={backupLoadingName === project.name}
                        onClick={() => void handleBackup(project.name)}
                      >
                        {backupLoadingName === project.name
                          ? "Backing up..."
                          : "Backup"}
                      </Button>
                      <Link
                        href={`/db/${encodeURIComponent(project.name)}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                        )}
                      >
                        Open
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && projects.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="py-6 text-center text-muted-foreground"
                    colSpan={7}
                  >
                    No databases found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | string | undefined;
  loading: boolean;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">
          {loading ? "..." : (value ?? "n/a")}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
