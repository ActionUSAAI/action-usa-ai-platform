export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-blue to-brand-blue-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg">
            <span className="text-2xl font-bold text-brand-blue">AU</span>
          </div>
          <h1 className="text-2xl font-bold text-white">ACTION USA AI</h1>
          <p className="mt-1 text-sm text-blue-200">Sistema de Gestión de Casos</p>
        </div>
        {children}
      </div>
    </div>
  );
}
