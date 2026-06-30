import { EmptyState } from '@sovereignfs/ui';

export default function TasksIndexPage() {
  return (
    <EmptyState
      heading="Select a list"
      description="Choose a list from the sidebar, or create a new one to get started."
    />
  );
}
