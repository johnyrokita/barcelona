"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setCopied(false);
      timeoutRef.current = null;
    }, 2000);
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={copied}
      onClick={() => void handleCopy()}
      className={cn("min-w-20", className)}
    >
      <span className="relative inline-flex h-4 items-center justify-center">
        <span
          className={cn(
            "inline-flex items-center transition-all duration-200",
            copied ? "-translate-y-1.5 opacity-0" : "translate-y-0 opacity-100",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "absolute inset-0 inline-flex items-center justify-center transition-all duration-200",
            copied ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0",
          )}
          aria-hidden={!copied}
        >
          <Check className="size-4" />
        </span>
      </span>
    </Button>
  );
}
