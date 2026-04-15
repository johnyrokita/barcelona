"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AuthUser } from "@/lib/database-types";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

type SetupResponse =
  | {
      ok: true;
      data: {
        enabled: boolean;
        secret: string;
        otpauthUrl: string;
        qrDataUrl: string;
      };
    }
  | {
      ok: false;
      error: string;
    };

export function SettingsPanel({ currentUser }: { currentUser: AuthUser }) {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    currentUser.twoFactorEnabled,
  );
  const [enableDialogOpen, setEnableDialogOpen] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);
  const [setup, setSetup] = useState<{
    secret: string;
    otpauthUrl: string;
    qrDataUrl: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");

  async function loadSetup() {
    setSetupLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/2fa/setup", {
        cache: "no-store",
      });
      const result = (await response.json()) as SetupResponse;

      if (!response.ok || !result.ok) {
        throw new Error(
          "error" in result
            ? result.error
            : "Failed to prepare two-factor setup",
        );
      }

      setSetup({
        secret: result.data.secret,
        otpauthUrl: result.data.otpauthUrl,
        qrDataUrl: result.data.qrDataUrl,
      });
      setManualOpen(false);
    } catch (setupError) {
      setError(
        setupError instanceof Error
          ? setupError.message
          : "Failed to prepare two-factor setup",
      );
    } finally {
      setSetupLoading(false);
    }
  }

  async function verifySetup() {
    setVerifyLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: verifyCode }),
      });
      const result = (await response.json()) as
        | { ok: true }
        | { ok: false; error: string };

      if (!response.ok || !result.ok) {
        throw new Error(
          "error" in result ? result.error : "Failed to enable two-factor auth",
        );
      }

      setTwoFactorEnabled(true);
      setEnableDialogOpen(false);
      setSetup(null);
      setVerifyCode("");
      setManualOpen(false);
      toast.success("Two-factor authentication is now enabled.");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Failed to enable two-factor auth",
      );
    } finally {
      setVerifyLoading(false);
    }
  }

  async function disableTwoFactor() {
    setDisableLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/2fa", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: disablePassword }),
      });
      const result = (await response.json()) as
        | { ok: true }
        | { ok: false; error: string };

      if (!response.ok || !result.ok) {
        throw new Error(
          "error" in result
            ? result.error
            : "Failed to disable two-factor auth",
        );
      }

      setTwoFactorEnabled(false);
      setDisablePassword("");
      setDisableDialogOpen(false);
      setManualOpen(false);
      toast.success("Two-factor authentication has been turned off.");
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : "Failed to disable two-factor auth",
      );
    } finally {
      setDisableLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Signed in as{" "}
            <span className="font-medium">{currentUser.email}</span>
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!twoFactorEnabled ? (
            <>
              <div className="text-sm text-muted-foreground">
                2FA is currently disabled.
              </div>

              <Dialog
                open={enableDialogOpen}
                onOpenChange={(open) => {
                  setEnableDialogOpen(open);

                  if (!open) {
                    setSetup(null);
                    setVerifyCode("");
                    setManualOpen(false);
                    setError(null);
                  }
                }}
              >
                <Button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setEnableDialogOpen(true);
                    void loadSetup();
                  }}
                  disabled={setupLoading || verifyLoading}
                >
                  {setupLoading ? "Preparing..." : "Set up 2FA"}
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Set up 2FA</DialogTitle>
                    <DialogDescription>
                      Scan the QR code with your authenticator app, or use the
                      manual setup details if needed.
                    </DialogDescription>
                  </DialogHeader>

                  {setup ? (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center space-y-2">
                        <div className="text-sm font-medium">
                          Scan this QR code
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={setup.qrDataUrl}
                          alt="Two-factor authentication QR code"
                          className="size-52 rounded-lg border bg-white p-3"
                        />
                      </div>

                      <Collapsible
                        open={manualOpen}
                        onOpenChange={setManualOpen}
                        className="w-full"
                      >
                        <div className="w-full min-w-0 rounded-lg border">
                          <CollapsibleTrigger
                            className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium"
                            nativeButton
                          >
                            <span>Manual</span>
                            <ChevronDown
                              className={cn(
                                "size-4 text-muted-foreground transition-transform duration-200",
                                manualOpen ? "rotate-180" : "rotate-0",
                              )}
                            />
                          </CollapsibleTrigger>
                          <CollapsibleContent className="w-full min-w-0 border-t px-3 py-3">
                            <div className="w-full min-w-0 space-y-4">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <Label htmlFor="manual-secret">
                                    Manual secret
                                  </Label>
                                  <CopyButton value={setup.secret} />
                                </div>
                                <Input
                                  id="manual-secret"
                                  readOnly
                                  value={setup.secret}
                                  className="font-mono"
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <Label htmlFor="otpauth-uri">
                                    OTPAuth URI
                                  </Label>
                                  <CopyButton
                                    value={setup.otpauthUrl}
                                    label="Copy URI"
                                  />
                                </div>
                                <Textarea
                                  id="otpauth-uri"
                                  readOnly
                                  rows={1}
                                  value={setup.otpauthUrl}
                                  className="field-sizing-fixed min-h-9.5 w-full min-w-0 resize-none font-mono text-xs"
                                />
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>

                      <div className="space-y-2">
                        <Label htmlFor="enable-2fa-code">
                          Enter the 6-digit code from your app
                        </Label>
                        <Input
                          id="enable-2fa-code"
                          inputMode="numeric"
                          placeholder="123456"
                          value={verifyCode}
                          onChange={(event) => setVerifyCode(event.target.value)}
                          disabled={verifyLoading}
                        />
                        {error ? (
                          <p className="text-sm text-destructive">{error}</p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Preparing your authenticator setup...
                      </p>
                      {error ? (
                        <p className="text-sm text-destructive">{error}</p>
                      ) : null}
                    </div>
                  )}

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEnableDialogOpen(false)}
                      disabled={setupLoading || verifyLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        !setup || verifyLoading || verifyCode.trim() === ""
                      }
                      onClick={() => void verifySetup()}
                    >
                      {verifyLoading ? "Verifying..." : "Enable 2FA"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Two-factor authentication is enabled.
              </div>

              <Dialog
                open={disableDialogOpen}
                onOpenChange={(open) => {
                  setDisableDialogOpen(open);

                  if (!open) {
                    setDisablePassword("");
                    setError(null);
                  }
                }}
              >
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setError(null);
                    setDisableDialogOpen(true);
                  }}
                >
                  Disable 2FA
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Disable 2FA</DialogTitle>
                    <DialogDescription>
                      Confirm your password to turn off 2FA for this account.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium" htmlFor="password">
                      Password
                    </Label>
                    <Input
                      type="password"
                      id="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={disablePassword}
                      onChange={(event) =>
                        setDisablePassword(event.target.value)
                      }
                      disabled={disableLoading}
                    />
                    {error ? (
                      <p className="text-sm text-destructive">{error}</p>
                    ) : null}
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDisableDialogOpen(false)}
                      disabled={disableLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={disableLoading || disablePassword.trim() === ""}
                      onClick={() => void disableTwoFactor()}
                    >
                      {disableLoading ? "Disabling..." : "Disable 2FA"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
