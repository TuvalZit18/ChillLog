// Stand-in for a screen that a later feat/ui-* branch builds, so the nav works in the meantime.

/** @param {{ title: string }} props */
export function Placeholder({ title }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="muted">This screen isn't built yet.</p>
    </>
  );
}
