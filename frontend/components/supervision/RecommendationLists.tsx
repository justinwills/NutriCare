import type { FoodRecommendation } from "@/lib/types/api";

function RecommendationGroup({
  title,
  emptyText,
  items,
  tone,
}: {
  title: string;
  emptyText: string;
  items: FoodRecommendation[];
  tone: "avoid" | "more";
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink/50">{emptyText}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`border-l-2 px-3 py-1.5 ${
                tone === "avoid" ? "border-brick/55" : "border-sage/70"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-ink">{item.food_name}</p>
                <span className="text-[11px] font-semibold uppercase text-ink/45">
                  {item.priority} priority
                </span>
              </div>
              <p className="mt-0.5 text-sm text-ink/65">{item.doctor_reason}</p>
              {item.recommended_frequency && (
                <p className="mt-0.5 text-xs text-ink/50">{item.recommended_frequency}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecommendationLists({ items }: { items: FoodRecommendation[] }) {
  const avoid = items.filter((item) => item.recommendation_type === "avoid");
  const consumeMore = items.filter((item) => item.recommendation_type === "consume_more");

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <RecommendationGroup
        title="Avoid or limit"
        emptyText="No foods are currently listed."
        items={avoid}
        tone="avoid"
      />
      <RecommendationGroup
        title="Consume more often"
        emptyText="No foods are currently recommended."
        items={consumeMore}
        tone="more"
      />
    </div>
  );
}
