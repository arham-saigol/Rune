'use client';

export default function Shimmer() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-[#e8d5c0] rounded w-3/4" />
      <div className="h-4 bg-[#e8d5c0] rounded w-1/2" />
      <div className="h-4 bg-[#e8d5c0] rounded w-5/6" />
    </div>
  );
}
