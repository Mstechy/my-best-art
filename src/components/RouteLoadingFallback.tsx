import { useLocation } from "react-router-dom";

function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-[#EDE9E4] dark:bg-[#28282B] motion-reduce:animate-none ${className}`} />;
}

function BrandMark() {
  return (
    <span className="select-none font-sans text-xl font-black tracking-tighter" aria-hidden="true">
      <span className="text-[#111111] dark:text-[#FAF5F2]">tradi</span>
      <span className="text-[#9E6300] dark:text-[#F6C75D]">bu</span>
    </span>
  );
}

function PublicLoadingShell() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] dark:bg-[#121212] dark:text-[#FAF5F2]">
      <header className="border-b border-[#E8E8E8] bg-white/95 dark:border-[#222222] dark:bg-[#111111]/95">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div className="hidden items-center gap-5 lg:flex">
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="h-3 w-16 rounded-full" />
            </div>
            <Skeleton className="hidden h-12 flex-1 rounded-full lg:block" />
            <div className="ml-auto flex items-center gap-2">
              <Skeleton className="hidden h-9 w-9 rounded-full sm:block" />
              <Skeleton className="h-9 w-9 rounded-full" />
              <Skeleton className="hidden h-9 w-9 rounded-full md:block" />
              <Skeleton className="h-9 w-9 rounded-full" />
            </div>
          </div>
          <Skeleton className="mt-3 h-11 w-full rounded-full lg:hidden" />
        </div>
      </header>

      <div className="border-y border-[#E8E8E8] bg-[#F6C75D] px-4 py-2 dark:border-[#222222]">
        <div className="mx-auto max-w-7xl">
          <Skeleton className="h-3 w-72 rounded-full bg-[#DCA83A] dark:bg-[#9E6300]" />
        </div>
      </div>

      <main className="pb-[calc(4rem_+_env(safe-area-inset-bottom,0px))] md:pb-16" aria-busy="true">
        <div className="border-b border-[#E8E8E8] bg-[#F8F3F0] px-4 py-4 dark:border-[#222222] dark:bg-[#1C1C1E] sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[260px_1fr_220px]">
            <Skeleton className="hidden min-h-[440px] lg:block" />
            <Skeleton className="aspect-[16/9] min-h-[240px] rounded-none sm:min-h-[280px] md:aspect-[21/9] md:min-h-[360px] lg:min-h-[440px]" />
            <div className="hidden gap-4 lg:flex lg:flex-col">
              <Skeleton className="min-h-[132px] flex-1 rounded-2xl" />
              <Skeleton className="min-h-[132px] flex-1 rounded-2xl" />
              <Skeleton className="min-h-[132px] flex-1 rounded-2xl" />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
          <section aria-label="Loading categories">
            <div className="mb-5 space-y-3">
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="h-7 w-48 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="aspect-[4/3] rounded-xl" />)}
            </div>
          </section>
        </div>
      </main>
      <div
        aria-hidden="true"
        className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[#E8E8E8] bg-white pb-[env(safe-area-inset-bottom,0px)] dark:border-[#222222] dark:bg-[#111111] md:hidden"
      >
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="mx-auto my-3 h-8 w-8 rounded-lg" />)}
      </div>
    </div>
  );
}

function DashboardLoadingShell() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121212]">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-[#E8E8E8] bg-white p-5 dark:border-[#222222] dark:bg-[#111111] lg:block">
        <BrandMark />
        <div className="mt-10 space-y-3">
          {Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="h-10 w-full rounded-lg" />)}
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="h-14 border-b border-[#E8E8E8] bg-white/95 px-4 dark:border-[#222222] dark:bg-[#111111]/95 lg:px-6">
          <div className="flex h-full items-center justify-between gap-4">
            <Skeleton className="h-9 w-9 rounded-lg lg:hidden" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </header>
        <main className="p-4 lg:p-6" aria-busy="true">
          <div className="space-y-6">
            <div className="space-y-3"><Skeleton className="h-8 w-56" /><Skeleton className="h-4 w-80 max-w-full" /></div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}
            </div>
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </main>
      </div>
    </div>
  );
}

function AuthLoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] px-4 dark:bg-[#121212]" aria-busy="true">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#E8E8E8] bg-white p-6 shadow-sm dark:border-[#222222] dark:bg-[#1A1A1A] sm:p-8">
        <div className="flex justify-center"><BrandMark /></div>
        <div className="space-y-3"><Skeleton className="mx-auto h-8 w-48" /><Skeleton className="mx-auto h-4 w-64 max-w-full" /></div>
        <div className="space-y-4"><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full" /><Skeleton className="h-11 w-full rounded-xl" /></div>
      </div>
    </div>
  );
}

export default function RouteLoadingFallback() {
  const { pathname } = useLocation();
  const isDashboard = /^(\/admin|\/seller|\/buyer)/.test(pathname);
  const isAuth = pathname.startsWith("/auth/");

  return (
    <div role="status" aria-live="polite" aria-label="Loading page">
      {isDashboard ? <DashboardLoadingShell /> : isAuth ? <AuthLoadingShell /> : <PublicLoadingShell />}
      <span className="sr-only">Loading page</span>
    </div>
  );
}
