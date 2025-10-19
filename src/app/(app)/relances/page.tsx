
'use client';

import { RelanceView } from './components/relance-view';
import { DataProvider } from '@/app/(app)/data-provider';

export default function RelancesPage() {
  return (
    <DataProvider>
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Relances des dons</h1>
          <p className="text-muted-foreground">
            Envoyez des rappels pour les dons en attente ou partiellement payés.
          </p>
        </div>
        <RelanceView />
      </div>
    </DataProvider>
  );
}
