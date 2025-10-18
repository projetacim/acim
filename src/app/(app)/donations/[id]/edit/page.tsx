'use client';
import { DonationForm } from '../../components/donation-form';

export default function EditDonationPage({ params }: { params: { id: string } }) {
  return (
    <div className="max-w-4xl mx-auto">
       <div className="space-y-1 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Modifier un Don</h1>
        <p className="text-muted-foreground">
          Mettez à jour les informations du don ou de la cotisation.
        </p>
      </div>
      <DonationForm donationId={params.id} />
    </div>
  );
}
