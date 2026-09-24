// Loading placeholders shaped like each page, so the screen changes the moment a tab is tapped
// and nothing jumps when the real content streams in.
import { cn } from "./ui";

export function Bone({ className }) {
  return <div className={cn("skeleton", className)} />;
}

function Page({ children }) {
  return (
    <div aria-busy="true" className="animate-fade-up [animation-duration:0.25s]">
      <span className="sr-only" role="status">
        Loading…
      </span>
      {children}
    </div>
  );
}

function Header({ actions = 0 }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-3">
        <Bone className="h-3 w-24" />
        <Bone className="h-8 w-64 max-w-full rounded-lg" />
        <Bone className="h-3.5 w-80 max-w-full" />
      </div>
      {actions > 0 && (
        <div className="flex gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Bone key={i} className="h-10 w-32 rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
}

function Stats({ count, className }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="glass rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <Bone className="h-3 w-20" />
            <Bone className="size-9 rounded-xl" />
          </div>
          <Bone className="mt-4 h-7 w-14 rounded-md" />
          <Bone className="mt-2 h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

function Card({ className, children, title = true }) {
  return (
    <div className={cn("glass rounded-2xl", className)}>
      {title && (
        <div className="flex items-center gap-3 px-5 pt-5">
          <Bone className="size-9 rounded-xl" />
          <div className="space-y-2">
            <Bone className="h-3.5 w-32" />
            <Bone className="h-2.5 w-20" />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}

function Rows({ count = 5, avatar = true }) {
  return (
    <ul className="space-y-1 px-3 pb-4 pt-3">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
          {avatar && <Bone className="size-10 shrink-0 rounded-full" />}
          <div className="flex-1 space-y-2">
            <Bone className="h-3 w-2/5" />
            <Bone className="h-2.5 w-3/5" />
          </div>
          <Bone className="h-6 w-16 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

function Table({ rows = 8, cols = 5 }) {
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex gap-6 border-b border-white/[0.06] px-5 py-4">
        {Array.from({ length: cols }, (_, i) => (
          <Bone key={i} className={cn("h-2.5", i === 0 ? "w-40" : "w-20", i > 2 && "hidden md:block")} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-white/[0.04] px-5 py-3.5 last:border-0">
          <div className="flex w-40 shrink-0 items-center gap-3">
            <Bone className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bone className="h-3 w-full" />
              <Bone className="h-2.5 w-2/3" />
            </div>
          </div>
          {Array.from({ length: cols - 1 }, (_, c) => (
            <Bone key={c} className={cn("h-3 w-20", c > 1 && "hidden md:block")} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MonthGrid() {
  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <Bone className="h-4 w-32" />
        <div className="flex gap-2">
          <Bone className="size-8 rounded-lg" />
          <Bone className="size-8 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 35 }, (_, i) => (
          <Bone key={i} className="aspect-square rounded-lg sm:aspect-[4/3]" />
        ))}
      </div>
    </div>
  );
}

function YearGrid() {
  return (
    <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, m) => (
        <div key={m} className="space-y-2">
          <Bone className="h-3 w-20" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }, (_, i) => (
              <Bone key={i} className="aspect-square rounded" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Form({ fields = 6 }) {
  return (
    <div className="grid gap-5 p-5 sm:grid-cols-2">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Bone className="h-2.5 w-24" />
          <Bone className="h-10 w-full rounded-xl" />
        </div>
      ))}
      <Bone className="h-10 w-32 rounded-xl" />
    </div>
  );
}

function Tabs({ count = 4 }) {
  return (
    <div className="mb-6 flex gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Bone key={i} className="h-9 w-24 rounded-xl" />
      ))}
    </div>
  );
}

/* ---------------------------------- Admin ---------------------------------- */

export function AdminOverviewSkeleton() {
  return (
    <Page>
      <Header actions={1} />
      <Stats count={4} className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" />
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <Rows count={5} />
        </Card>
        <div className="grid gap-6">
          <Card>
            <Rows count={3} />
          </Card>
          <Card>
            <Rows count={3} avatar={false} />
          </Card>
        </div>
      </div>
    </Page>
  );
}

export function EmployeesSkeleton() {
  return (
    <Page>
      <Header actions={1} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Bone className="h-10 flex-1 rounded-xl" />
        <Bone className="h-10 w-56 rounded-xl" />
      </div>
      <Table rows={8} cols={5} />
    </Page>
  );
}

export function EmployeeDetailSkeleton() {
  return (
    <Page>
      <Bone className="mb-6 h-3.5 w-28" />
      <div className="glass mb-6 flex flex-col gap-5 rounded-2xl p-5 sm:flex-row sm:items-center">
        <Bone className="size-16 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2.5">
          <Bone className="h-6 w-56 max-w-full rounded-md" />
          <Bone className="h-3 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Bone className="h-9 w-20 rounded-xl" />
          <Bone className="h-9 w-32 rounded-xl" />
        </div>
      </div>
      <Tabs count={4} />
      <Stats count={4} className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" />
      <Card>
        <YearGrid />
      </Card>
    </Page>
  );
}

export function LeaveRequestsSkeleton() {
  return (
    <Page>
      <Header />
      <Tabs count={4} />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="glass space-y-4 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <Bone className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Bone className="h-3.5 w-40" />
                <Bone className="h-2.5 w-24" />
              </div>
              <Bone className="h-6 w-20 rounded-full" />
            </div>
            <Bone className="h-3 w-3/4" />
            <Bone className="h-12 w-full rounded-xl" />
            <div className="flex gap-2">
              <Bone className="h-9 w-28 rounded-xl" />
              <Bone className="h-9 w-24 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}

export function RollCallSkeleton() {
  return (
    <Page>
      <Header actions={2} />
      <Stats count={3} className="mb-6 grid grid-cols-3 gap-3 sm:gap-4" />
      <Table rows={8} cols={5} />
    </Page>
  );
}

export function HolidayPlannerSkeleton() {
  return (
    <Page>
      <Header actions={1} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card title={false}>
          <YearGrid />
        </Card>
        <Card>
          <Rows count={6} avatar={false} />
        </Card>
      </div>
    </Page>
  );
}

export function SettingsSkeleton() {
  return (
    <Page>
      <Header />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <Form fields={4} />
        </Card>
        <Card>
          <Rows count={4} avatar={false} />
        </Card>
        <Card className="xl:col-span-2">
          <Rows count={2} />
        </Card>
      </div>
    </Page>
  );
}

/* --------------------------------- Employee --------------------------------- */

export function EmployeeDashboardSkeleton() {
  return (
    <Page>
      <Header actions={1} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        {/* Punch card */}
        <div className="glass flex flex-col items-center gap-5 rounded-2xl p-6">
          <div className="flex w-full justify-between">
            <Bone className="h-3 w-24" />
            <Bone className="h-6 w-28 rounded-full" />
          </div>
          <Bone className="h-12 w-44 rounded-lg" />
          <Bone className="h-3 w-32" />
          <Bone className="size-36 rounded-full" />
          <div className="grid w-full grid-cols-3 gap-3">
            <Bone className="h-12 rounded-xl" />
            <Bone className="h-12 rounded-xl" />
            <Bone className="h-12 rounded-xl" />
          </div>
        </div>
        <div className="space-y-6">
          <Stats count={4} className="grid grid-cols-2 gap-3 sm:gap-4" />
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <Rows count={4} avatar={false} />
        </Card>
        <Card>
          <Rows count={4} avatar={false} />
        </Card>
      </div>
    </Page>
  );
}

export function MyLeavesSkeleton() {
  return (
    <Page>
      <Header actions={1} />
      <Stats count={4} className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4" />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title={false}>
          <MonthGrid />
        </Card>
        <Card>
          <Rows count={5} avatar={false} />
        </Card>
      </div>
    </Page>
  );
}

export function MyAttendanceSkeleton() {
  return (
    <Page>
      <Header />
      <Stats count={3} className="mb-6 grid grid-cols-3 gap-3 sm:gap-4" />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title={false}>
          <MonthGrid />
        </Card>
        <Card>
          <Rows count={6} avatar={false} />
        </Card>
      </div>
    </Page>
  );
}

export function MyHolidaysSkeleton() {
  return (
    <Page>
      <Header actions={1} />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card title={false}>
          <YearGrid />
        </Card>
        <Card>
          <Rows count={6} avatar={false} />
        </Card>
      </div>
    </Page>
  );
}

export function ProfileSkeleton() {
  return (
    <Page>
      <Header />
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div className="space-y-6">
          <div className="glass flex flex-col items-center gap-4 rounded-2xl p-6">
            <Bone className="size-28 rounded-full" />
            <Bone className="h-5 w-40 rounded-md" />
            <Bone className="h-3 w-28" />
            <Bone className="h-9 w-32 rounded-xl" />
          </div>
          <Card>
            <Rows count={3} avatar={false} />
          </Card>
        </div>
        <Card>
          <Form fields={8} />
        </Card>
      </div>
    </Page>
  );
}
