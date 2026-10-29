// While an admin area loads, only the content panel shows this; the shell (app/(admin)/layout.tsx) stays put.
export default function AdminLoading() {
  return (
    <div className="ad-loading" role="status" aria-label="Loading">
      <i style={{ width: 280, height: 34 }} />
      <i style={{ width: "min(560px, 100%)", height: 18 }} />
      <i style={{ height: 140 }} />
      <i style={{ height: 220 }} />
    </div>
  );
}
