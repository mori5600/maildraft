interface DraftCheckListProps {
  checks: string[];
}

export function DraftCheckList({ checks }: DraftCheckListProps) {
  return (
    <div className="mt-2 space-y-1.5">
      {checks.map((check) => (
        <div
          key={check}
          className={`rounded-[7px] border px-3 py-1.5 text-[13px] ${
            check.includes("通っています")
              ? "border-(--color-success-border) bg-(--color-success-bg) text-(--color-success-text)"
              : "border-(--color-warning-border) bg-(--color-warning-bg) text-(--color-warning-text)"
          }`}
        >
          {check}
        </div>
      ))}
    </div>
  );
}
