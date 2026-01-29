type LogoProps = {
  name?: string;
  subtitle?: string;
  logoUrl?: string; // opcional para multiempresa
};

export default function Logo({ name = 'Tecnocel', subtitle = 'Panel de gestión de importaciones', logoUrl }: LogoProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      {logoUrl ? (
        <img src={logoUrl} alt={name} className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
          <span className="text-lg font-bold">TC</span>
        </div>
      )}
      <div className="text-center">
        <h1 className="text-xl font-semibold text-slate-900">Ingresar al sistema</h1>
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

