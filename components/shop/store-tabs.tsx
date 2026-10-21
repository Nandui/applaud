import { TabLinks } from "@/components/tab-links";

/** The Store tab's two halves: real-world rewards and the profile shop. */
export function StoreTabs({ active }: { active: "rewards" | "shop" }) {
  return (
    <TabLinks
      active={active}
      tabs={[
        { key: "rewards", label: "Rewards", href: "/rewards" },
        { key: "shop", label: "Profile shop", href: "/shop" },
      ]}
    />
  );
}
