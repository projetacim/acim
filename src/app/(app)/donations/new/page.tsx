
'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { DonationForm } from '../components/donation-form';
import { Loader2 } from 'lucide-react';

function NewDonationPageContent() {
  const searchParams = useSearchParams();
  const memberId = searchParams.get('memberId');

  if (!memberId) {
    return (
      <div className="flex flex-col items-center justify-center text-center h-64">
          <h2 className="text-xl font-semibold">Membre non spécifié</h2>
          <p className="text-muted-foreground mt-2">
            Veuillez retourner à la page des membres et sélectionner un membre pour ajouter un don.
          </p>
      </div>
    );
  }

  return <DonationForm memberIdParam={memberId} />;
}


export default function NewDonationPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
      <NewDonationPageContent />
    </Suspense>
  );
}
