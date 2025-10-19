
'use client';

import { BackupRestoreView } from './components/backup-view';
import { DataProvider } from '@/app/(app)/data-provider';

export default function BackupPage() {
  return (
    <DataProvider>
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Sauvegardes et Restauration</h1>
          <p className="text-muted-foreground">
            Gérez et téléchargez les sauvegardes de vos données, ou restaurez-les à partir d'un fichier.
          </p>
        </div>
        <BackupRestoreView />
      </div>
    </DataProvider>
  );
}
