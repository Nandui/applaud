import { TabLinks } from "@/components/tab-links";
import { NewDot } from "@/components/app-shell/new-items";

function Label({ text, area }: { text: string; area: "rewards" | "shop" }) {
  return (
    <span className="flex items-center gap-1.5">
      {text}
      <NewDot areas={[area]} />
    </span>
  );
}

/** The Store tab's two halves: real-world rewards and the profile shop. */
export function StoreTabs({ active }: { active: "rewards" | "shop" }) {
  return (
    <TabLinks
      active={active}
      tabs={[
        { key: "rewards", label: <Label text="Rewards" area="rewards" />, href: "/rewards" },
        { key: "shop", label: <Label text="Profile shop" area="shop" />, href: "/shop" },
      ]}
    />
  );
}
