export default function AdminPrintLayout({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto min-h-dvh max-w-3xl bg-white p-6 text-ink sm:p-10 print:p-0">{children}</main>;
}
