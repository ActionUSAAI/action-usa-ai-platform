import Image from "next/image";

export default function NoAccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B2B5E] to-[#121e42] flex items-center justify-center p-4">
      <div className="w-full max-w-lg text-center space-y-8">

        {/* Logo */}
        <Image
          src="/logo.png"
          alt="ACTION USA AI"
          width={160}
          height={40}
          className="mx-auto h-10 w-auto"
          priority
        />

        {/* Card */}
        <div className="rounded-2xl bg-white shadow-2xl p-8 space-y-5">

          {/* Icon */}
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#C9A84C] bg-[#FEF9EC]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#C9A84C"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
          </div>

          {/* Text */}
          <div className="space-y-3">
            <h1 className="text-xl font-bold text-[#1B2B5E]">
              Enlace no válido o expirado
            </h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              El enlace de acceso que utilizó no es válido, ha expirado o ya fue utilizado.
              Por favor, comuníquese con su asesor de ACTION USA AI para solicitar un nuevo
              enlace de acceso.
            </p>
          </div>

          {/* Contact */}
          <div className="rounded-xl border border-[#C9A84C]/30 bg-[#FEF9EC] px-5 py-4">
            <p className="text-xs text-[#92640A] font-semibold uppercase tracking-wide mb-1">Contacto</p>
            <a
              href="mailto:actionusaaillc@gmail.com"
              className="text-sm font-medium text-[#1B2B5E] hover:underline"
            >
              actionusaaillc@gmail.com
            </a>
          </div>
        </div>

        {/* Brand footer */}
        <p className="text-xs text-blue-300 tracking-wide">
          ACTION USA AI · actionusaai.com
        </p>
      </div>
    </div>
  );
}
