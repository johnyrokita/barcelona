"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";

export function Footer({
  version,
  commitHash,
}: {
  version: string;
  commitHash?: string | null;
}) {
  const shortCommitHash = commitHash?.slice(0, 7);

  return (
    <footer className="w-full pb-6 flex justify-between items-center text-sm text-muted-foreground">
      <div className="flex gap-2">
        <div>
          Built by{" "}
          <Link
            className="hover:underline"
            href="https://rokita.org"
            target="_blank"
          >
            Johny
            <ExternalLinkIcon className="inline size-3 ml-[0.5ch] opacity-75 mb-px" />
          </Link>
        </div>
        <div>·</div>
        <div>
          <Link
            className="hover:underline"
            href="https://github.com/johnyrokita/barcelona"
            target="_blank"
          >
            GitHub
            <ExternalLinkIcon className="inline size-3 ml-[0.5ch] opacity-75 mb-px" />
          </Link>
        </div>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger className="cursor-default">
            Version {version}
          </TooltipTrigger>
          <TooltipContent>Commit {shortCommitHash ?? "unknown"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </footer>
  );
}
