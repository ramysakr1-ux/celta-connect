// A room a view-level role can read but not change: one line saying so,
// and every form control inside shown disabled (globals.css .room-readonly).
export function RoomReadOnly({ readOnly, children }: { readOnly: boolean; children: React.ReactNode }) {
  if (!readOnly) return <>{children}</>;
  return (
    <div className="room-readonly flex flex-col gap-4">
      <p className="rounded-[6px] border border-border bg-card-inset px-4 py-2.5 text-body text-muted">
        Your role reads this room and changes nothing, so what you see is the record. A Centre manager or the Centre owner
        makes changes here.
      </p>
      {children}
    </div>
  );
}
