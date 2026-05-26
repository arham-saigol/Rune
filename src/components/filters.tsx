'use client';

export default function Filters({
  unreadOnly,
  pinnedOnly,
  onToggleUnread,
  onTogglePinned,
}: {
  unreadOnly: boolean;
  pinnedOnly: boolean;
  onToggleUnread: () => void;
  onTogglePinned: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onToggleUnread}
        className={`nav-pill ${unreadOnly ? 'nav-pill--active' : 'nav-pill--inactive'}`}
      >
        Unread
      </button>
      <button
        onClick={onTogglePinned}
        className={`nav-pill ${pinnedOnly ? 'nav-pill--active' : 'nav-pill--inactive'}`}
      >
        Pinned
      </button>
    </div>
  );
}
