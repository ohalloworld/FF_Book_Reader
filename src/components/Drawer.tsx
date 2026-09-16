import { useEffect, type ReactNode } from "react";

/** Generic slide-in panel chrome (backdrop, Escape-to-close, close button)
 * shared by every on-demand drawer opened from the reading view's StatBar —
 * from the right on desktop, up from the bottom on mobile. */
export function Drawer({
  open,
  onClose,
  closeLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="drawer-close" onClick={onClose} aria-label={closeLabel}>
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
