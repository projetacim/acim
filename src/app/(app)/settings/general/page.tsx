import { GeneralSettings } from './components/general-settings';

export default function GeneralSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Paramètres Généraux</h1>
        <p className="text-muted-foreground">
          Gérez les paramètres généraux de l'application.
        </p>
      </div>
      <GeneralSettings />
    </div>
  );
}
