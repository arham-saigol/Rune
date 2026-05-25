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
        className={`px-3 py-1 rounded-full text-sm transition ${
          unreadOnly ? 'bg-[#2c1810] text-[#f5e6d3]' : 'bg-[#e8d5c0] text-[#5a3e2b] hover:bg-[#d4c0a8]'
        }`}
      >
        Unread
      </button>
      <button
        onClick={onTogglePinned}
        className={`px-3 py-1 rounded-full text-sm transition ${
          pinnedOnly ? 'bg-[#2c1810] text-[#f5e6d3]' : 'bg-[#e8d5c0] text-[#5a3e2b] hover:bg-[#d4c0a8]'
        }`}
      >
        Pinned
      </button>
    </div>
  );
}
