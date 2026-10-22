import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/treinamento')({
  component: TrainingLayout,
});

function TrainingLayout() {
  return <Outlet />;
}
