import { TabLinks } from "@/components/tab-links";
import { NewDot } from "@/components/app-shell/new-items";

function Label({ text, area }: { text: string; area: "rewards" | "shop" | "claims" }) {
  return (
    <span className="flex items-center gap-1.5">
      {text}
      <NewDot areas={[area]} />
    </span>
  );
}

/** The Store's tabs: real-world rewards, the profile shop, and the rewards you claimed. */
export function StoreTabs({ active }: { active: "rewards" | "shop" | "claims" }) {
  return (
    <TabLinks
      active={active}
      tabs={[
        { key: "rewards", label: <Label text="Rewards" area="rewards" />, href: "/rewards" },
        { key: "shop", label: <Label text="Profile shop" area="shop" />, href: "/shop" },
        { key: "claims", label: <Label text="My rewards" area="claims" />, href: "/rewards/claimed" },
      ]}
    />
  );
}
