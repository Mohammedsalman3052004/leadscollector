import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-3 h-10 w-64" />
      <Skeleton className="mb-10 h-4 w-96" />
      <div className="mb-10 grid grid-cols-2 gap-8 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
