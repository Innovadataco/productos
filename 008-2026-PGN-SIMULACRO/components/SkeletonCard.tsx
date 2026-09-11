export default function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4">
      <div className="h-4 w-2/3 rounded bg-gray-200" />
      <div className="mt-3 h-3 w-full rounded bg-gray-100" />
      <div className="mt-2 h-3 w-5/6 rounded bg-gray-100" />
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-full rounded-xl bg-gray-100" />
        ))}
      </div>
    </div>
  )
}
