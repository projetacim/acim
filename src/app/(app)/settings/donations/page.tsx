import { DonationCategories } from './components/donation-categories';

export default function DonationSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Catégories de dons</h1>
        <p className="text-muted-foreground">
          Gérez les catégories utilisées pour classer les dons.
        </p>
      </div>
      <DonationCategories />
    </div>
  );
}
