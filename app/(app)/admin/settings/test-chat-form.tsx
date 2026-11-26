"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { sendAdminChatTest } from "@/lib/chat/test-action";

export function TestChatForm() {
  const [message, action, pending] = useActionState(sendAdminChatTest, "");
  return (
    <form action={action} className="space-y-2">
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Sending…" : "Send a test message to the space"}
      </Button>
      <p role="status" className="text-sm">{pending ? "" : message}</p>
    </form>
  );
}
