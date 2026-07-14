import type { ReactNode } from 'react';
import MobileAwareShell from './_components/MobileAwareShell';
import { countStarredTasks, getLists } from './_lib/actions';
import { registerPortabilityHandlers } from './_lib/portability';

export default async function TasksLayout({ children }: { children: ReactNode }) {
  // In-process and reset on restart — the platform SDK requires
  // re-registering from a request-scoped plugin route, so this runs on
  // every request. Best-effort: a registration failure must not block the
  // plugin's own UI (matches sovereign-plainwrite's layout.tsx).
  try {
    await registerPortabilityHandlers();
  } catch {
    // Portability is a best-effort platform integration.
  }

  const [lists, starredCount] = await Promise.all([getLists(), countStarredTasks()]);

  return (
    <MobileAwareShell lists={lists} starredCount={starredCount}>
      {children}
    </MobileAwareShell>
  );
}
