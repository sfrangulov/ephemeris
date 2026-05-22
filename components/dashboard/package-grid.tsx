import { PackageCard, type PackageCardData } from "./package-card";

/** Responsive 3 -> 2 -> 1 column card grid with staggered entrance. */
export function PackageGrid({ packages }: { packages: PackageCardData[] }) {
  return (
    <div className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {packages.map((p) => (
        <PackageCard key={p.name} {...p} />
      ))}
    </div>
  );
}
