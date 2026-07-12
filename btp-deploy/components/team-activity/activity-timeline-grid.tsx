"use client";

import type { TeamActivity } from "@/lib/types";
import type { MemberActivityRow, TimelineMonth, TimelineWeek } from "@/lib/team-activity";
import { getActivitySpan, getCategoryClasses, formatDateRange, teamActivityCategoryLabels } from "@/lib/team-activity";
import { cn } from "@/lib/utils";

interface ActivityTimelineGridProps {
  months: TimelineMonth[];
  members: MemberActivityRow[];
}

export function ActivityTimelineGrid({ months, members }: ActivityTimelineGridProps) {
  const weeks = months.flatMap((m) => m.weeks);
  const gridMinWidth = 192 + weeks.length * 96;
  const today = new Date();
  const todayColIndex = weeks.findIndex((w) => today >= w.start && today <= w.end);
  const todayClass = "border-l-2 border-dashed border-primary-500";

  return (
    <div
      className="max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-border bg-surface shadow-sm"
      aria-label="Team activity timeline. Scroll horizontally to view all weeks."
    >
      <table className="w-full border-collapse" style={{ minWidth: gridMinWidth }}>
        <thead>
          <tr className="border-b border-border bg-surface-muted">
            <th
              rowSpan={2}
              className="sticky left-0 z-10 w-48 min-w-48 border-r border-border bg-surface-muted px-4 py-3 text-left text-sm font-semibold text-text-primary"
            >
              Team Member Name
            </th>
            {months.map((month) => (
              <th
                key={month.key}
                colSpan={month.weeks.length}
                className="border-r border-border px-2 py-2 text-center text-sm font-semibold text-text-primary"
              >
                {month.label}
              </th>
            ))}
          </tr>
          <tr className="border-b border-border bg-surface-muted">
            {weeks.map((week, idx) => {
              const isToday = idx === todayColIndex;
              return (
                <th
                  key={week.key}
                  className={cn(
                    "w-24 min-w-24 border-r border-border px-1 py-2 text-center text-xs font-medium text-text-secondary",
                    isToday && todayClass
                  )}
                >
                  <div className="flex flex-col items-center leading-tight">
                    <span>W{week.weekIndex}</span>
                    {isToday && <span className="text-[9px] font-bold text-primary-600">TODAY</span>}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const rowCount = Math.max(member.activities.length, 1);

            if (member.activities.length === 0) {
              return (
                <tr key={member.memberName} className="border-b border-border">
                  <td className="sticky left-0 z-10 w-48 min-w-48 border-r border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary">
                    {member.memberName}
                  </td>
                  {weeks.map((week, idx) => (
                    <td
                      key={week.key}
                      className={cn(
                        "h-12 w-24 min-w-24 border-r border-border border-b border-dashed bg-surface",
                        idx === todayColIndex && todayClass
                      )}
                    />
                  ))}
                </tr>
              );
            }

            return member.activities.map((activity, idx) => (
              <ActivityRow
                key={activity.id}
                member={member}
                activity={activity}
                weeks={weeks}
                rowCount={rowCount}
                isFirstActivity={idx === 0}
                todayColIndex={todayColIndex}
                todayClass={todayClass}
              />
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

interface ActivityRowProps {
  member: MemberActivityRow;
  activity: TeamActivity;
  weeks: TimelineWeek[];
  rowCount: number;
  isFirstActivity: boolean;
  todayColIndex: number;
  todayClass: string;
}

function ActivityRow({
  member,
  activity,
  weeks,
  rowCount,
  isFirstActivity,
  todayColIndex,
  todayClass,
}: ActivityRowProps) {
  const span = getActivitySpan(activity, weeks);
  const classes = getCategoryClasses(activity.category);

  if (!span) {
    return (
      <tr className="border-b border-border">
        {isFirstActivity && (
          <td
            rowSpan={rowCount}
            className="sticky left-0 z-10 w-48 min-w-48 border-r border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary"
          >
            {member.memberName}
          </td>
        )}
        <td
          colSpan={weeks.length}
          className="h-12 px-4 py-2 text-xs text-text-muted"
        >
          {activity.title} (outside visible range)
        </td>
      </tr>
    );
  }

  const beforeCount = span.startCol;
  const afterCount = weeks.length - span.endCol - 1;
  const barColSpan = span.endCol - span.startCol + 1;
  const barIncludesToday = todayColIndex >= span.startCol && todayColIndex <= span.endCol;

  return (
    <tr className="border-b border-border">
      {isFirstActivity && (
        <td
          rowSpan={rowCount}
          className="sticky left-0 z-10 w-48 min-w-48 border-r border-border bg-surface px-4 py-3 text-sm font-medium text-text-primary"
        >
          {member.memberName}
        </td>
      )}

      {Array.from({ length: beforeCount }).map((_, i) => (
        <td
          key={`empty-before-${i}`}
          className={cn(
            "h-12 w-24 min-w-24 border-r border-border border-b border-dashed",
            i === todayColIndex && todayClass
          )}
        />
      ))}

      <td colSpan={barColSpan} className={cn("h-12 p-1", barIncludesToday && todayClass)}>
        <div
          className={cn(
            "group relative flex h-8 items-center overflow-hidden rounded-md border px-2 text-xs font-medium shadow-sm transition-all hover:shadow-md",
            classes.bar
          )}
          title={`${activity.title}\n${member.memberName}\n${teamActivityCategoryLabels[activity.category]}\n${formatDateRange(activity.startDate, activity.endDate)}${activity.notes ? `\n${activity.notes}` : ""}`}
        >
          <span className="truncate">{activity.title}</span>
          <div className="absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-primary shadow-lg group-hover:block">
            <div className="font-semibold">{activity.title}</div>
            <div className="text-text-secondary">{member.memberName}</div>
            <div className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", classes.badge)}>
              {teamActivityCategoryLabels[activity.category]}
            </div>
            <div className="mt-1 text-text-muted">{formatDateRange(activity.startDate, activity.endDate)}</div>
            {activity.notes && <div className="mt-1 max-w-xs whitespace-normal text-text-secondary">{activity.notes}</div>}
          </div>
        </div>
      </td>

      {Array.from({ length: afterCount }).map((_, i) => {
        const colIndex = span.endCol + 1 + i;
        return (
          <td
            key={`empty-after-${i}`}
            className={cn(
              "h-12 w-24 min-w-24 border-r border-border border-b border-dashed",
              colIndex === todayColIndex && todayClass
            )}
          />
        );
      })}
    </tr>
  );
}
