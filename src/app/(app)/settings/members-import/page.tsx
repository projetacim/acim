import { MembersImport } from './components/members-import';

export default function MembersImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Importer des membres</h1>
        <p className="text-muted-foreground">
          Téléversez un fichier Excel (.xls, .xlsx) pour importer des membres en masse.
        </p>
      </div>
      <MembersImport />
    </div>
  );
}
