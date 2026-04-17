import { FinancesTabNav } from '@/components/dashboard/FinancesTabNav';

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[#111827] dark:text-foreground">Finances</h1>
          <p className="mt-1 text-[14px] text-[#6B7280]">
            Your donation history and campaign payouts in one place.
          </p>
        </div>
      </div>

      {/* Tab navigation */}
      <FinancesTabNav />

      {/* Tab content */}
      <div className="mt-6">{children}</div>
    </div>
  );
}
