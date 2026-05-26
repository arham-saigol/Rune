'use client';

export default function Shimmer() {
  return (
    <div className="space-y-3">
      <div className="skel h-4 w-3/4" />
      <div className="skel h-4 w-1/2" />
      <div className="skel h-4 w-5/6" />
    </div>
  );
}
