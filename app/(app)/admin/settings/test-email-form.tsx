"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { sendAdminTestEmail } from "@/lib/email/test-action";

export function TestEmailForm({ email }: { email: string }) {
  const [message, action, pending] = useActionState(sendAdminTestEmail, "");
  return (
    <form action={action} className="space-y-2">
      <p className="text-muted text-sm">Test recipient: {email}</p>
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send test email to me"}</Button>
      <p role="status" className="text-sm">{pending ? "" : message}</p>
    </form>
  );
}
