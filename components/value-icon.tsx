import { createElement } from "react";
import type { LucideProps } from "lucide-react";
import { valueIcon } from "@/lib/value-icons";

/**
 * Render a Value's icon by name. A stable component (rather than resolving
 * `valueIcon()` to a component inside render) keeps React's compiler happy.
 */
export function ValueIcon({
  icon,
  ...props
}: { icon?: string | null } & Omit<LucideProps, "ref">) {
  return createElement(valueIcon(icon), props);
}
