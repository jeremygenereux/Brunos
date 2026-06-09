export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="border-or-400/20 bg-noir-700/60 w-full max-w-sm rounded-2xl border p-8 shadow-2xl backdrop-blur-xl">
        {children}
      </div>
    </main>
  );
}
