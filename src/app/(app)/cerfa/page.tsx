import { CerfaTable } from './components/cerfa-table';

export default function CerfaPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Liste des CERFA</h1>
        <p className="text-muted-foreground">
          Retrouvez ici tous les reçus fiscaux qui ont été générés.
        </p>
      </div>
      <CerfaTable />
    </div>
  );
}
