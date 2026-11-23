import Link from "next/link";
import type { ProfileData } from "@/lib/profile";

/** "Managed by …" line under the bio. */
export function Managers({ data }: { data: ProfileData }) {
  const { managers } = data.user;
  if (managers.length === 0) return null;
  return (
    <p className="text-muted text-sm">
      Manager{managers.length === 1 ? "" : "s"}:{" "}
      {managers.map((m, i) => (
        <span key={m.manager.id}>
          {i > 0 && ", "}
          <Link href={`/profile/${m.manager.id}`} className="text-foreground font-semibold">
            {m.manager.name}
          </Link>
        </span>
      ))}
    </p>
  );
}
