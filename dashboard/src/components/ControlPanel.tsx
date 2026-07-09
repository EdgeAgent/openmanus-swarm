export default function ControlPanel() {
  const handleStartAll = () => {
    console.log('START ALL clicked');
  };

  const handleStopAll = () => {
    console.log('STOP ALL clicked');
  };

  const handleRestartFleet = () => {
    console.log('RESTART FLEET clicked');
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 bg-edge-green rounded-sm" />
        <h2 className="font-mono text-[11px] tracking-[1.5px] text-edge-secondary">
          FLEET CONTROL
        </h2>
      </div>
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handleStartAll}
          className="font-mono text-[11px] tracking-[1px] px-5 py-2.5 rounded-md border border-edge-border bg-edge-card text-edge-primary hover:border-edge-green hover:text-edge-green hover:bg-edge-green/5 transition-all cursor-pointer"
        >
          START ALL
        </button>
        <button
          onClick={handleStopAll}
          className="font-mono text-[11px] tracking-[1px] px-5 py-2.5 rounded-md border border-edge-border bg-edge-card text-edge-primary hover:border-edge-error hover:text-edge-error hover:bg-edge-error/5 transition-all cursor-pointer"
        >
          STOP ALL
        </button>
        <button
          onClick={handleRestartFleet}
          className="font-mono text-[11px] tracking-[1px] px-5 py-2.5 rounded-md border border-edge-border bg-edge-card text-edge-primary hover:border-edge-amber hover:text-edge-amber hover:bg-edge-amber/5 transition-all cursor-pointer"
        >
          RESTART FLEET
        </button>
      </div>
    </section>
  );
}
