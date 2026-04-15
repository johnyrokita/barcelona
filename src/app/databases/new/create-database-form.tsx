"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectCredentials } from "@/lib/database-types";
import { cn } from "@/lib/utils";

type CreateDatabaseResponse =
  | {
      ok: true;
      data: Omit<ProjectCredentials, "createdAt">;
    }
  | {
      ok: false;
      error: string;
    };

export function CreateDatabaseForm() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreateDatabase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slug }),
      });
      const result = (await response.json()) as CreateDatabaseResponse;

      if (!response.ok || !result.ok) {
        throw new Error(
          "error" in result ? result.error : "Failed to create database",
        );
      }

      setSlug("");
      router.push(`/db/${result.data.databaseName}`);
      router.refresh();
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create database",
      );
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Card>
        <CardHeader>
          <CardTitle>Create a database</CardTitle>
          <CardDescription>
            Creates a Postgres role, database, and grants.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-3" onSubmit={handleCreateDatabase}>
            <div className="space-y-2">
              <Label htmlFor="database-slug">Database slug</Label>
              <Input
                id="database-slug"
                name="slug"
                placeholder="moki"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                disabled={createLoading}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={createLoading || slug.trim() === ""}
              >
                {createLoading ? "Creating..." : "Create database"}
              </Button>
              <Link
                href="/"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                Back to dashboard
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {createError ? (
        <Alert variant="destructive">
          <AlertTitle>Provisioning failed</AlertTitle>
          <AlertDescription>{createError}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
