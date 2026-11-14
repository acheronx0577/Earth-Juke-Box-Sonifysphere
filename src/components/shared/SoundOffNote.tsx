export function SoundOffNote({ onTurnOn }: Readonly<{ onTurnOn: () => void }>) {
  return (
    <div className="sonify-sound-off pointer-events-auto" role="status">
      <p>Sound is off.</p>
      <button type="button" className="pointer-events-auto" onClick={onTurnOn}>
        Turn sound on
      </button>
    </div>
  );
}
