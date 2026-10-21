import { AppBar } from "@/components/app-shell/app-bar";

/**
 * Screen title: the sticky frosted app bar on every screen size. Inside the
 * admin area (which owns its own sticky bar) it becomes an in-flow heading with
 * the description underneath.
 */
export function PageHeader({
  title,
  description,
  action,
  leading,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <>
      <AppBar
        title={title}
        leading={leading}
        trailing={action}
        className="in-data-[admin]:static in-data-[admin]:mx-0 in-data-[admin]:mb-1 in-data-[admin]:bg-transparent in-data-[admin]:pt-0 in-data-[admin]:backdrop-blur-none [&>div]:in-data-[admin]:px-0"
      />
      {description ? (
        <p className="text-muted mb-5 hidden text-sm in-data-[admin]:block">{description}</p>
      ) : null}
    </>
  );
}
