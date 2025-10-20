
'use client';

import { ArchiveView } from './components/archive-view';
import { DataProvider } from '@/app/(app)/data-provider';

export default function ArchivePage() {
  return (
    <DataProvider>
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Archivage des Données</h1>
          <p className="text-muted-foreground">
            Archivez les données d'une année pour alléger l'application, ou restaurez-les.
          </p>
        </div>
        <ArchiveView />
      </div>
    </DataProvider>
  );
}
