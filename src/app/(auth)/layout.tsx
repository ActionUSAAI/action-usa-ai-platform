import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-blue to-brand-blue-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Image
            src="/logo.png"
            alt="ACTION USA AI"
            width={240}
            height={120}
            className="mx-auto h-[120px] w-auto"
            priority
          />
          <p className="mt-3 text-sm text-blue-200">Sistema de Gestión de Casos</p>
        </div>
        {children}
      </div>
    </div>
  );
}
