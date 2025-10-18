import { DonationsImport } from './components/donations-import';
import { DataProvider } from '@/app/(app)/data-provider';

export default function DonationsImportPage() {
  return (
    <DataProvider>
      <div className="flex flex-col gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Importer des Dons</h1>
          <p className="text-muted-foreground">
            Téléversez un fichier Excel (.xls, .xlsx) pour importer des dons en masse.
          </p>
        </div>
        <DonationsImport />
      </div>
    </DataProvider>
  );
}
