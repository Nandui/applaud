import { cn } from "@/lib/utils";
import { AppBar } from "@/components/app-shell/app-bar";

/**
 * Screen title. Phones get a sticky frosted app bar (title left, actions
 * right); desktop gets the original large heading with a description. Inside
 * the admin area (which has its own app bar) the phone version is an in-flow
 * heading instead of a second sticky bar.
 */
export function PageHeader({
  title,
  description,
  action,
  leading,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  leading?: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <AppBar
        title={title}
        leading={leading}
        trailing={action}
        className="in-data-[admin]:static in-data-[admin]:mx-0 in-data-[admin]:mb-4 in-data-[admin]:border-0 in-data-[admin]:bg-transparent in-data-[admin]:pt-0 in-data-[admin]:backdrop-blur-none [&>div]:in-data-[admin]:px-0"
      />
      <div
        className={cn(
          "hidden gap-3 pb-6 md:flex md:flex-row md:items-end md:justify-between",
          className,
        )}
      >
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {title}
          </h1>
          {description ? <p className="text-muted text-sm">{description}</p> : null}
        </div>
        {action ? <div className="flex items-center gap-2">{action}</div> : null}
      </div>
    </>
  );
}
