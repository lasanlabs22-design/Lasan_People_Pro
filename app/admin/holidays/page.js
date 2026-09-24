import { load } from "@/lib/api";
import { isMonth, todayIso } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { HolidayPlanner } from "./planner";

export const metadata = { title: "Holidays" };

export default async function HolidaysPage({ searchParams }) {
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : todayIso().slice(0, 7);
  const year = month.slice(0, 4);
  const [{ holidays }, config] = await Promise.all([load("/holidays", { query: { year } }), load("/config")]);

  return (
    <>
      <PageHeader
        eyebrow="Calendar"
        title="Holiday calendar"
        description="Click any date to add a holiday. Mandatory holidays are skipped when counting leave days; optional ones aren't."
      />
      <HolidayPlanner month={month} holidays={holidays} weekendDays={config.weekendDays} />
    </>
  );
}
