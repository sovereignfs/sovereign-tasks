/** Matches @sovereignfs/ui's DragHandleRow icon, reproduced locally since it
 *  isn't exported. Shared between ListSidebar and TaskItem, whose drag
 *  handles both use an absolutely-positioned floating overlay (no reserved
 *  gutter) rather than DragHandleRow's flex layout — see the sidebar
 *  row-layout brainstorm this was first built for. */
export default function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      {[3, 7, 11].map((cy) =>
        [4, 10].map((cx) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.2} fill="currentColor" />),
      )}
    </svg>
  );
}
