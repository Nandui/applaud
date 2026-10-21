import { TabLinks } from "@/components/tab-links";

/** Top-level switch between the two halves of the Ranks tab. */
export function RanksTabs({ active }: { active: "leaderboard" | "awards" }) {
  return (
    <TabLinks
      active={active}
      tabs={[
        { key: "leaderboard", label: "Leaderboard", href: "/leaderboard" },
        { key: "awards", label: "Awards", href: "/awards" },
      ]}
    />
  );
}
