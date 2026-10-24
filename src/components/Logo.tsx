import { useApp } from '@/lib/AppContext';

type LogoProps = {
  size?: number;
  className?: string;
  rounded?: string;
};

export function Logo({ size = 32, className = '', rounded = 'rounded-lg' }: LogoProps) {
  const { logoUrl, themeConfig } = useApp();

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="App Logo"
        className={`${rounded} object-cover ${className}`}
        style={{ width: size, height: size, boxShadow: `0 0 12px ${themeConfig.glow}` }}
      />
    );
  }

  return (
    <div
      className={`${rounded} flex items-center justify-center font-bold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.45,
        background: `linear-gradient(135deg, ${themeConfig.primary}, ${themeConfig.secondary})`,
        boxShadow: `0 0 12px ${themeConfig.glow}`,
        color: themeConfig.bg,
      }}
    >
      L
    </div>
  );
}
