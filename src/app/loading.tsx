export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid min-h-screen w-full place-items-center bg-[#141414] px-6 text-[#aaaaaa]"
    >
      <p className="m-0 font-mono text-[12px] uppercase tracking-[0.14em]">Receiving</p>
    </div>
  );
}
