export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-brand flex min-h-svh flex-col md:items-center md:justify-center md:px-4 md:py-12">
      {children}
    </div>
  );
}
