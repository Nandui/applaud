export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background relative isolate flex min-h-svh flex-col overflow-hidden md:items-center md:justify-center md:px-4 md:py-12">
      {/* Violet glow behind the splash, same mark as the app icon. */}
      <div
        aria-hidden
        className="bg-brand absolute -top-40 left-1/2 -z-10 size-[34rem] -translate-x-1/2 rounded-full opacity-45 blur-3xl"
      />
      {children}
    </div>
  );
}
