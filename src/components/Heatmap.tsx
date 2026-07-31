import { useMemo } from "react";
import { en } from "../i18n/en";
import type { DayActivity } from "../types";

interface HeatmapDay {
  key: string;
  date: Date;
  count: number;
  outsideRange: boolean;
}

interface MonthLabel {
  key: string;
  label: string | null;
}

function dateKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function intensity(count: number): number {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

export function Heatmap({ activity }: { activity: DayActivity[] }) {
  const { weeks, monthLabels } = useMemo(() => {
    const counts = new Map(activity.map((day) => [day.date, day.count]));
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const first = new Date(today);
    first.setDate(first.getDate() - 364);
    const alignedFirst = new Date(first);
    const mondayOffset = (alignedFirst.getDay() + 6) % 7;
    alignedFirst.setDate(alignedFirst.getDate() - mondayOffset);

    const generatedWeeks: HeatmapDay[][] = [];
    const labels: MonthLabel[] = [];
    const cursor = new Date(alignedFirst);
    let previousMonth = -1;
    while (cursor <= today) {
      const week: HeatmapDay[] = [];
      let weekMonth: number | null = null;
      for (let weekday = 0; weekday < 7; weekday += 1) {
        const date = new Date(cursor);
        cursor.setDate(cursor.getDate() + 1);
        const key = dateKey(date);
        const outsideRange = date < first || date > today;
        week.push({ key, date, count: outsideRange ? 0 : (counts.get(key) ?? 0), outsideRange });
        if (!outsideRange && weekMonth === null) weekMonth = date.getMonth();
      }
      generatedWeeks.push(week);
      if (weekMonth !== null && weekMonth !== previousMonth) {
        const firstVisibleDay = week.find((day) => !day.outsideRange);
        labels.push({
          key: week[0].key,
          label: firstVisibleDay
            ? new Intl.DateTimeFormat("en", { month: "short" }).format(firstVisibleDay.date)
            : null,
        });
        previousMonth = weekMonth;
      } else {
        labels.push({ key: week[0].key, label: null });
      }
    }
    const firstLabelIndex = labels.findIndex(({ label }) => Boolean(label));
    const secondLabelIndex = labels.findIndex(({ label }, index) => Boolean(label) && index > firstLabelIndex);
    if (firstLabelIndex >= 0 && secondLabelIndex - firstLabelIndex < 3) {
      labels[firstLabelIndex].label = null;
    }
    return { weeks: generatedWeeks, monthLabels: labels };
  }, [activity]);

  return (
    <section className="activity-card" aria-labelledby="activity-title">
      <div className="section-heading">
        <h2 id="activity-title">{en.activity}</h2>
        <figure className="heatmap-legend">
          <figcaption className="visually-hidden">{en.intensityLegend}</figcaption>
          <span>{en.less}</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <i key={level} className={`heatmap-swatch level-${level}`} aria-hidden="true" />
          ))}
          <span>{en.more}</span>
        </figure>
      </div>
      <figure className="heatmap-frame">
        <figcaption className="visually-hidden">{en.previousMonths}</figcaption>
        <div className="weekday-labels" aria-hidden="true">
          <span>{en.weekdays.monday}</span>
          <span />
          <span>{en.weekdays.wednesday}</span>
          <span />
          <span>{en.weekdays.friday}</span>
          <span />
          <span>{en.weekdays.sunday}</span>
        </div>
        <div className="heatmap-scroll">
          <div className="month-labels" aria-hidden="true">
            {monthLabels.map(({ key, label }) => (
              <span key={key}>{label}</span>
            ))}
          </div>
          <table className="heatmap-grid">
            <caption className="visually-hidden">{en.previousMonths}</caption>
            <tbody>
              {weeks.map((week) => (
                <tr className="heatmap-week" key={week[0].key}>
                  {week.map((day) =>
                    !day.outsideRange ? (
                      <td
                        className={`heatmap-day level-${intensity(day.count)}`}
                        key={day.key}
                        title={`${new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(day.date)}: ${
                          day.count === 0 ? en.noActivity : day.count === 1 ? en.oneSession : en.manySessions(day.count)
                        }`}
                        aria-label={`${day.key}: ${day.count === 1 ? en.oneSession : en.manySessions(day.count)}`}
                      />
                    ) : (
                      <td className="heatmap-day heatmap-day--empty" key={day.key} aria-hidden="true" />
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </figure>
    </section>
  );
}
