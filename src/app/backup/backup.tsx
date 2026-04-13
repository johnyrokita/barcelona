"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useEffect, useState } from "react";

export function Backup() {
  const [databases, setDatabases] = useState<string[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupStatus, setBackupStatus] = useState<any>(null);

  function fetchDatabases() {
    try {
      fetch("/api/db/list")
        .then((response) => response.json())
        .then((data) => {
          if (data.ok) {
            setDatabases(data.data);
          } else {
            console.error("Failed to fetch databases:", data.error);
          }
        });
    } catch (error) {
      console.error("Error fetching databases:", error);
    }
  }

  function handleBackup(dbName: string) {
    setBackupLoading(true);
    setBackupStatus(null);

    fetch("/api/db/backup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: dbName }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.ok) {
          setBackupStatus(data);
        } else {
          setBackupStatus(data);
        }
      })
      .catch((error) => {
        setBackupStatus({
          ok: false,
          error: `Error backing up database: ${error instanceof Error ? error.message : String(error)}`,
        });
      })
      .finally(() => {
        setBackupLoading(false);
      });
  }

  useEffect(() => {
    fetchDatabases();
  }, []);

  return (
    <div className="p-4 flex flex-col gap-2">
      <h1 className="font-bold text-xl">Backup</h1>
      <p>
        {databases.length > 0
          ? `Found ${databases.length} databases`
          : "No databases found"}
      </p>
      <div>
        <Collapsible>
          <CollapsibleTrigger className="px-2 py-1 bg-gray-200 rounded">
            Show Databases
          </CollapsibleTrigger>
          <CollapsibleContent className="p-2 border rounded mt-2">
            {databases.map((db) => (
              <div key={db} className="flex items-center gap-2">
                <span>– {db}</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const dbName = formData.get("dbName") as string;
            if (dbName) {
              handleBackup(dbName);
            }
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            name="dbName"
            placeholder="Database name"
            className="border px-2 py-1 rounded"
          />
          <button
            type="submit"
            className="px-2 py-1 bg-blue-500 text-white rounded"
            disabled={backupLoading}
          >
            {backupLoading ? "Backing up..." : "Backup"}
          </button>
        </form>
        {backupStatus && (
          <div
            className={`mt-2 p-2 rounded ${
              backupStatus.ok
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            <pre>{JSON.stringify(backupStatus, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
