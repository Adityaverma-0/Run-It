"use client";
import { useEffect, useState, type FormEvent } from "react";
import { ShieldCheck, Copy, Check, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Btn, Field, Modal } from "./ui";

export async function authRequest(
  action: string,
  data: Record<string, unknown> = {},
) {
  const response = await fetch(`/api/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(25000),
  });
  const result: any = await response.json();
  if (!response.ok) throw new Error(result.error || "Please try again.");
  return result;
}
type Mode = "login" | "setup" | "recover" | "accept" | "help";
export function AccessScreen({
  onSuccess,
}: {
  onSuccess: () => Promise<unknown>;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [activation, setActivation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(location.hash.slice(1)).get("activate");
    if (value) {
      setActivation(value);
      setMode("accept");
      history.replaceState(null, "", location.pathname);
    }
  }, []);
  const changeMode = (value: Mode) => {
    setMode(value);
    setError("");
  };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (mode !== "login" && data.password !== data.confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (mode === "accept") data.token = activation;
      await authRequest(mode, data);
      location.hash = "dashboard";
      await onSuccess();
    } catch (e: any) {
      setError(e.message || "Unable to sign in. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  const titles = {
    login: "Welcome to Sanket.",
    setup: "Set up your workspace.",
    recover: "Recover owner access.",
    accept: "Your workspace awaits.",
    help: "Let’s get you back in.",
  };
  return (
    <div className="login">
      <section className="login-brand">
        <img src="/favicon.svg" alt="Sanket" width="65" />
        <h1>
          Every box.
          <br />
          Every route.
          <br />
          One clear picture.
        </h1>
        <p style={{ color: "#b5c7d9", lineHeight: 1.9 }}>
          Your warehouse, sales and collections.
          <br />
          Connected from the first load to the last stop.
        </p>
      </section>
      <section className="login-card">
        <div className="clay">
          <img src="/favicon.svg" alt="" width="46" />
          <h2>{titles[mode]}</h2>
          <p className="muted">
            {mode === "login"
              ? "Sign in to your distribution workspace."
              : mode === "setup"
                ? "Create the owner account with your configured email and private setup token."
                : mode === "recover"
                  ? "Use the owner email and private setup token from your server environment to reset access."
                  : mode === "accept"
                    ? "Enter your registered email and choose a password. This link can be used once."
                    : "Ask your business owner for a new access link. Open it to set a new password. No email is sent automatically."}
          </p>
          {mode === "help" ? (
            <div className="stack mt-5">
              <Btn light onClick={() => changeMode("recover")}>
                Recover owner account
              </Btn>
              <button className="text-link" onClick={() => changeMode("login")}>
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <form className="stack mt-5" onSubmit={submit} key={mode}>
                {mode === "setup" && (
                  <Field
                    label="Full name"
                    name="name"
                    autoComplete="name"
                    maxLength={100}
                    required
                  />
                )}
                <Field
                  label="Email address"
                  name="email"
                  type="email"
                  autoComplete="username"
                  maxLength={254}
                  required
                />
                {(mode === "setup" || mode === "recover") && (
                  <Field
                    label="Owner setup token"
                    name="token"
                    type="password"
                    autoComplete="off"
                    minLength={32}
                    maxLength={256}
                    required
                  />
                )}
                <Field
                  label={mode === "login" ? "Password" : "New password"}
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={mode === "login" ? 1 : 12}
                  maxLength={128}
                  required
                />
                {mode !== "login" && (
                  <>
                    <Field
                      label="Confirm password"
                      name="confirm"
                      type="password"
                      autoComplete="new-password"
                      minLength={12}
                      maxLength={128}
                      required
                    />
                    <p className="form-help">
                      Use at least 12 characters. A long, unique passphrase
                      works well.
                    </p>
                  </>
                )}
                {error && (
                  <div className="alert error" role="alert">
                    {error}
                  </div>
                )}
                <Btn type="submit" busy={busy}>
                  {mode === "login"
                    ? "Sign in"
                    : mode === "setup"
                      ? "Create owner account"
                      : mode === "recover"
                        ? "Reset owner password"
                        : "Set password & sign in"}
                </Btn>
              </form>
              <div className="auth-links">
                {mode === "login" ? (
                  <>
                    <button
                      className="text-link"
                      onClick={() => changeMode("help")}
                    >
                      Forgot password?
                    </button>
                    <button
                      className="text-link"
                      onClick={() => changeMode("setup")}
                    >
                      First-time owner setup
                    </button>
                  </>
                ) : (
                  <button
                    className="text-link"
                    onClick={() => changeMode("login")}
                  >
                    Back to sign in
                  </button>
                )}
              </div>
            </>
          )}
          <p className="form-help mt-6 flex-row">
            <ShieldCheck size={15} />
            Secure access · Your team, your workspace
          </p>
        </div>
      </section>
    </div>
  );
}

export function PasswordDialog({ close }: { close: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.password !== data.confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await authRequest("password", data);
      toast.success("Password changed. Other sessions have been signed out.");
      close();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title="Change your password"
      description="All other sessions will be signed out. Your pending local work will stay on this device."
      onClose={close}
    >
      <form className="stack" onSubmit={submit}>
        <Field
          label="Current password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
        <Field
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
        />
        <p className="form-help">Use at least 12 characters.</p>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <Btn type="submit" busy={busy}>
            Change password
          </Btn>
        </div>
      </form>
    </Modal>
  );
}

export function InviteButton({ user }: { user: Record<string, any> }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const data = await authRequest("invite", { userId: user.id });
      setLink(new URL(data.path, location.origin).href);
      setCopied(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        className="text-link"
        disabled={!user.active}
        onClick={() => {
          setOpen(true);
          setLink("");
          setError("");
        }}
      >
        Access link
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Access for ${user.name}`}
        description="Create a private link to activate this account or reset its password."
      >
        <div className="stack">
          <p>
            Registered email: <b>{user.email}</b>
          </p>
          <p className="muted">
            The link expires in 24 hours and works once. Creating a new link
            cancels the previous link. Existing sessions are signed out when a
            new password is set.
          </p>
          {link ? (
            <>
              <Field
                label="Private access link"
                value={link}
                readOnly
                onFocus={(e: any) => e.target.select()}
              />
              <p className="form-help">
                Share it privately with this person. No email has been sent.
              </p>
              <Btn
                light
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                  } catch {
                    setError(
                      "Clipboard unavailable. Select and copy the link above.",
                    );
                  }
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy access link"}
              </Btn>
            </>
          ) : (
            <Btn busy={busy} onClick={create}>
              <KeyRound size={16} />
              Create access link
            </Btn>
          )}
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
