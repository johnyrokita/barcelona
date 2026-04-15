"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { CopyButton } from "@/components/copy-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type {
  BackupEntry,
  DatabaseRow,
  ProjectCredentials,
} from "@/lib/database-types";
import { cn } from "@/lib/utils";

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

export function DatabaseDetail({
  database,
  credentials,
  backups,
}: {
  database: DatabaseRow;
  credentials: ProjectCredentials | null;
  backups: BackupEntry[];
}) {
  const router = useRouter();
  const [showSecrets, setShowSecrets] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [deleteBackupName, setDeleteBackupName] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  async function handleBackup() {
    setBackupLoading(true);
    setBackupError(null);

    try {
      const response = await fetch("/api/db/backup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: database.name }),
      });
      const result = (await response.json()) as BackupResponse;

      if (!response.ok || !result.ok) {
        throw new Error(
          "error" in result ? result.error : "Failed to create backup",
        );
      }

      toast.success(`Created ${result.data?.fileName ?? "a new backup file"}`);
      router.refresh();
    } catch (error) {
      setBackupError(
        error instanceof Error ? error.message : "Failed to create backup",
      );
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleDeleteBackup(fileName: string) {
    setDeleteBackupName(fileName);
    setBackupError(null);

    try {
      const response = await fetch(
        `/api/db/backups/download?file=${encodeURIComponent(fileName)}`,
        {
          method: "DELETE",
        },
      );
      const result = (await response.json()) as
        | {
            ok: true;
            data: { fileName: string };
          }
        | {
            ok: false;
            error: string;
          };

      if (!response.ok || !result.ok) {
        throw new Error(
          "error" in result ? result.error : "Failed to delete backup",
        );
      }

      toast.success(`Deleted ${result.data.fileName}`);
      router.refresh();
    } catch (error) {
      setBackupError(
        error instanceof Error ? error.message : "Failed to delete backup",
      );
    } finally {
      setDeleteBackupName(null);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-mono text-2xl font-semibold">{database.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
            Back
          </Link>
          <Button
            type="button"
            onClick={() => void handleBackup()}
            disabled={backupLoading}
          >
            {backupLoading ? "Backing up..." : "Backup now"}
          </Button>
        </div>
      </div>

      {backupError ? (
        <Alert variant="destructive">
          <AlertTitle>Backup failed</AlertTitle>
          <AlertDescription>{backupError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Owner" value={database.owner} />
        <StatCard label="Size" value={formatBytes(database.sizeBytes)} />
        <StatCard
          label="Connections"
          value={String(database.activeConnections)}
        />
        <StatCard
          label="Managed"
          value={database.isManaged ? "Yes" : "No"}
          badge={
            database.isManaged ? (
              <Badge
                variant="secondary"
                className="bg-lime-200 dark:bg-lime-600"
              >
                Managed
              </Badge>
            ) : (
              <Badge variant="outline">External</Badge>
            )
          }
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Connection details</CardTitle>
            {credentials ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={showSecrets ? "Hide secrets" : "Show secrets"}
                onClick={() => setShowSecrets((current) => !current)}
              >
                {showSecrets ? <EyeOff /> : <Eye />}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {credentials ? (
            <div className="grid gap-4">
              <Field label="User" value={credentials.roleName} />
              <Field label="Database" value={credentials.databaseName} />
              <Field
                label="Password"
                value={showSecrets ? credentials.password : "*******"}
                copyValue={credentials.password}
              />
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">Postgres string</span>
                  <CopyButton
                    value={credentials.postgresConnectionString}
                    label="Copy URL"
                  />
                </div>
                <Textarea
                  readOnly
                  rows={1}
                  value={
                    showSecrets
                      ? credentials.postgresConnectionString
                      : redactConnectionString(
                          credentials.postgresConnectionString,
                        )
                  }
                  className="field-sizing-fixed min-h-9.5 resize-none font-mono text-xs"
                />
              </div>
              {credentials.pgbouncerConnectionString ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      PgBouncer string
                    </span>
                    <CopyButton
                      value={credentials.pgbouncerConnectionString}
                      label="Copy URL"
                    />
                  </div>
                  <Textarea
                    readOnly
                    rows={1}
                    value={
                      showSecrets
                        ? credentials.pgbouncerConnectionString
                        : redactConnectionString(
                            credentials.pgbouncerConnectionString,
                          )
                    }
                    className="field-sizing-fixed min-h-9.5 resize-none font-mono text-xs"
                  />
                </div>
              ) : null}
              <div className="text-sm text-muted-foreground">
                Managed since {formatDate(credentials.createdAt)}
              </div>
            </div>
          ) : (
            <Alert>
              <AlertTitle>No saved credentials</AlertTitle>
              <AlertDescription>
                This database is not tracked by Barcelona, so there is no saved
                password or connection string to show here.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backups</CardTitle>
          <CardDescription>
            Files discovered by scanning the local `backups/` directory for this
            database prefix.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.map((backup) => (
                <TableRow key={backup.fileName}>
                  <TableCell className="font-mono">{backup.fileName}</TableCell>
                  <TableCell>{formatDate(backup.createdAt)}</TableCell>
                  <TableCell>{formatBytes(backup.sizeBytes)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <a
                        href={`/api/db/backups/download?file=${encodeURIComponent(backup.fileName)}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                        )}
                      >
                        Download
                      </a>
                      <AlertDialog>
                        <AlertDialogTrigger
                          render={
                            <Button type="button" variant="outline" size="sm" />
                          }
                        >
                          Delete
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete backup?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove{" "}
                              <span className="font-mono">
                                {backup.fileName}
                              </span>
                              .
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel
                              disabled={deleteBackupName === backup.fileName}
                            >
                              Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              disabled={deleteBackupName === backup.fileName}
                              onClick={() =>
                                void handleDeleteBackup(backup.fileName)
                              }
                            >
                              {deleteBackupName === backup.fileName
                                ? "Deleting..."
                                : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {backups.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-6 text-center text-muted-foreground"
                  >
                    No backup files found for this database yet.
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

function Field({
  label,
  value,
  copyValue,
}: {
  label: string;
  value: string;
  copyValue?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <CopyButton value={copyValue ?? value} />
      </div>
      <Input readOnly value={value} className="font-mono text-sm" />
    </div>
  );
}

function redactConnectionString(value: string) {
  try {
    const url = new URL(value);

    if (url.hostname) {
      url.hostname = "*******";
    }

    if (url.password) {
      url.password = "*******";
    }

    return url.toString();
  } catch {
    return value
      .replace(/:(.*?)@/, ":*******@")
      .replace(/\/\/([^/:?#]+)(:\d+)?/, (_match, _host, port = "") => {
        return `//*******${port}`;
      });
  }
}

function StatCard({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: React.ReactNode;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <div className="flex items-center gap-2">
          <CardTitle className="text-2xl">{value}</CardTitle>
          {badge}
        </div>
      </CardHeader>
    </Card>
  );
}
