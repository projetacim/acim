import { DonationForm } from '../components/donation-form';

export default function NewDonationPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-1 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Enregistrer un Don</h1>
        <p className="text-muted-foreground">
          Remplissez les détails ci-dessous pour ajouter un nouveau don ou une nouvelle cotisation.
        </p>
      </div>
      <DonationForm />
    </div>
  );
}
