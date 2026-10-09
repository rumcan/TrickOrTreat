import { Keycap } from './common';

export function Controls() {
  const R = ({ k, label }: { k: React.ReactNode; label: string }) => (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <div className="flex flex-wrap gap-1">{k}</div>
      <span className="font-cond2 text-[11px] font-semibold text-[#9aa3b8]">{label}</span>
    </div>
  );
  return (
    <div className="w-full max-w-md">
      <R k={<><Keycap>W</Keycap><Keycap>A</Keycap><Keycap>S</Keycap><Keycap>D</Keycap></>} label="Move" />
      <R k={<Keycap wide>LMB</Keycap>} label="Aim / shoot (hold)" />
      <R k={<><Keycap wide>RMB</Keycap><Keycap>F</Keycap></>} label="Hero skill" />
      <R k={<Keycap wide>Space</Keycap>} label="Dash · flee a door" />
      <R k={<Keycap>E</Keycap>} label="Pick up · doorbell · shop" />
      <R k={<><Keycap>Q</Keycap><Keycap>1</Keycap><Keycap>2</Keycap></>} label="Swap weapon" />
      <R k={<Keycap>R</Keycap>} label="Reload" />
      <R k={<Keycap wide>Esc</Keycap>} label="Pause" />
    </div>
  );
}
