import { Hammer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";

/**
 * Themed stub used by routes whose phase hasn't been built yet.
 * Replaced with the real screen as each phase lands.
 */
export function Placeholder({
  title,
  description,
  phase,
}: {
  title: string;
  description?: string;
  phase: string;
}) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="bg-secondary text-muted flex size-12 items-center justify-center rounded-full">
            <Hammer className="size-5" />
          </span>
          <div className="space-y-1">
            <p className="font-display font-medium">Coming together</p>
            <p className="text-muted max-w-sm text-sm">
              This screen is wired up in {phase}.
            </p>
          </div>
          <Badge variant="secondary">{phase}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
