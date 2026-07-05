import type { ReactNode } from 'react';
import MobileAwareShell from './_components/MobileAwareShell';
import { getLists } from './_lib/actions';

export default async function TasksLayout({ children }: { children: ReactNode }) {
  const lists = await getLists();

  return <MobileAwareShell lists={lists}>{children}</MobileAwareShell>;
}
