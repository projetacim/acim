
'use client';

import { CerfaTable } from './components/cerfa-table';
import { DataProvider } from '@/app/(app)/data-provider';

export default function CerfaPage() {
  return (
    <DataProvider>
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Liste des CERFA</h1>
          <p className="text-muted-foreground">
            Retrouvez et filtrez tous les reçus fiscaux qui ont été générés.
          </p>
        </div>
        <CerfaTable />
      </div>
    </DataProvider>
  );
}
