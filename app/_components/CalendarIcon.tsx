/** No "calendar" icon exists in @sovereignfs/ui's icon set (confirmed against
 *  packages/ui/src/components/Icon/icons/) — adding one there is a design-system
 *  change (new Storybook coverage + a semver bump), out of scope here. Local,
 *  same precedent as GripIcon/ProgressRing elsewhere in this plugin. */
export default function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="2"
        y="3"
        width="12"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M2 6.5H14" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 1.5V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M11 1.5V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
