
'use client';

import { BilanView } from './components/bilan-view';
import { DataProvider } from '@/app/(app)/data-provider';

export default function BilanPage() {
  return (
    <DataProvider>
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Bilan Financier</h1>
          <p className="text-muted-foreground">
            Analysez les transactions et les statistiques financières de votre association.
          </p>
        </div>
        <BilanView />
      </div>
    </DataProvider>
  );
}
