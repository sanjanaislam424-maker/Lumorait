import { LoginBranding, LOGIN_BRANDING_LIMITS, logoBlurPx, backgroundBlurPx } from '@/lib/loginBranding';
import { SlidersHorizontal } from 'lucide-react';

type Props = {
  value: LoginBranding;
  onChange: (patch: Partial<LoginBranding>) => void;
};

const SLIDERS: { key: Exclude<keyof LoginBranding, 'beamEnabled' | 'backgroundUrl' | 'backgroundOpacity' | 'backgroundBlur'>; label: string; hint: string; unit: string; limits: { min: number; max: number } }[] = [
  { key: 'logoOpacity', label: 'Background logo opacity', hint: 'How strong the logo wall looks when the light is on.', unit: '%', limits: LOGIN_BRANDING_LIMITS.logoOpacity },
  { key: 'logoBlur', label: 'Background logo blur', hint: 'Soft depth-of-field blur on the logo wall. Keep it low for a crisp look.', unit: '', limits: LOGIN_BRANDING_LIMITS.logoBlur },
  { key: 'cardOpacity', label: 'Glass card opacity', hint: 'How solid the login card background is. Lower is clearer.', unit: '%', limits: LOGIN_BRANDING_LIMITS.cardOpacity },
  { key: 'cardBlur', label: 'Glass card blur', hint: 'Frosted blur behind the login card. Higher is more frosted.', unit: 'px', limits: LOGIN_BRANDING_LIMITS.cardBlur },
  { key: 'beamSpread', label: 'Light radius', hint: 'How far the circular glow spreads from the bulb, from a compact glow to a wide one.', unit: '%', limits: LOGIN_BRANDING_LIMITS.beamSpread },
  { key: 'beamBlur', label: 'Light blur / softness', hint: 'How soft and feathered the glow edge is. Higher blends it more smoothly into the background.', unit: '%', limits: LOGIN_BRANDING_LIMITS.beamBlur },
  { key: 'beamOpacity', label: 'Light brightness', hint: 'The overall intensity of the glow.', unit: '%', limits: LOGIN_BRANDING_LIMITS.beamOpacity },
];

const BACKGROUND_SLIDERS: { key: 'backgroundOpacity' | 'backgroundBlur' | 'backgroundDimLevel' | 'backgroundOffDesaturate'; label: string; hint: string; unit: string; limits: { min: number; max: number } }[] = [
  { key: 'backgroundOpacity', label: 'Background image opacity', hint: 'How visible the uploaded login background is. Applies in both the light-on and light-off states.', unit: '%', limits: LOGIN_BRANDING_LIMITS.backgroundOpacity },
  { key: 'backgroundBlur', label: 'Background image blur', hint: 'Depth-of-field blur on the login background image.', unit: '', limits: LOGIN_BRANDING_LIMITS.backgroundBlur },
  { key: 'backgroundDimLevel', label: 'Darkness when light is off', hint: 'How dark the background gets when the light is OFF. 0 means the background stays at full brightness in the dark state. Higher values darken it for a moody night look. When the light turns ON the image returns to full vibrant brightness.', unit: '%', limits: LOGIN_BRANDING_LIMITS.backgroundDimLevel },
  { key: 'backgroundOffDesaturate', label: 'Monochrome when light is off', hint: 'How desaturated (black-and-white) the background becomes when the light is OFF. 0 keeps full color, 100 fully converts to grayscale. When the light turns ON the image snaps back to full vibrant color.', unit: '%', limits: LOGIN_BRANDING_LIMITS.backgroundOffDesaturate },
];

export function LoginLightingControls({ value, onChange }: Props) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal size={18} className="text-amber-400" />
        <h3 className="font-semibold text-white">Login page lighting</h3>
      </div>
      <p className="text-xs text-slate-400 mb-4">Changes appear in the preview below as you move the sliders and save automatically for the live login page.</p>

      {/* Dedicated login background controls — independent of the global app logo */}
      <div className="mb-4 pb-4 border-b border-white/10">
        <p className="text-sm text-white mb-3">Login background image</p>
        <div className="space-y-4">
          {BACKGROUND_SLIDERS.map((s) => {
            const current = value[s.key];
            const display = s.key === 'backgroundBlur' ? `${current / 2}px` : `${current}${s.unit}`;
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor={`login-${s.key}`} className="text-sm text-white">{s.label}</label>
                  <span className="text-xs font-mono text-amber-300">{display}</span>
                </div>
                <input
                  id={`login-${s.key}`}
                  type="range"
                  min={s.limits.min}
                  max={s.limits.max}
                  step={1}
                  value={current}
                  onChange={(e) => onChange({ [s.key]: Number(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500 mt-1">{s.hint}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
        <div>
          <p className="text-sm text-white">Overhead light beam</p>
          <p className="text-[11px] text-slate-500">Shows a glow radiating from the bulb when the light is on.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value.beamEnabled}
          onClick={() => onChange({ beamEnabled: !value.beamEnabled })}
          className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${value.beamEnabled ? 'bg-amber-400' : 'bg-slate-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${value.beamEnabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      <div className="space-y-4">
        {SLIDERS.map((s) => {
          const current = value[s.key];
          const display = s.key === 'logoBlur' ? `${current / 2}px` : `${current}${s.unit}`;
          return (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor={`login-${s.key}`} className="text-sm text-white">{s.label}</label>
                <span className="text-xs font-mono text-amber-300">{display}</span>
              </div>
              <input
                id={`login-${s.key}`}
                type="range"
                min={s.limits.min}
                max={s.limits.max}
                step={1}
                value={current}
                onChange={(e) => onChange({ [s.key]: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-1">{s.hint}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
