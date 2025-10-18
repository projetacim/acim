'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DonationForm } from '../components/donation-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

function NewDonationContent() {
  const searchParams = useSearchParams();
  const memberId = searchParams.get('memberId');

  if (!memberId) {
    return (
       <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Aucun membre sélectionné. Veuillez retourner à la page des dons et sélectionner un membre avant de continuer.
        </AlertDescription>
      </Alert>
    )
  }

  return <DonationForm memberIdParam={memberId} />;
}


export default function NewDonationPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="space-y-1 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Enregistrer un Don</h1>
        <p className="text-muted-foreground">
          Remplissez les détails ci-dessous pour ajouter un nouveau don ou une nouvelle cotisation.
        </p>
      </div>
       <Suspense fallback={<FormSkeleton />}>
        <NewDonationContent />
      </Suspense>
    </div>
  );
}

function FormSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-8 w-1/2" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-10 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
        <div className="space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-24 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}
