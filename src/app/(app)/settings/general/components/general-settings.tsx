
'use client';

import { useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function GeneralSettings() {
  const [isResetting, setIsResetting] = useState(false);
  const [isTotalResetting, setIsTotalResetting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isTotalAlertOpen, setIsTotalAlertOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const performReset = async (collectionsToDelete: string[]) => {
    if (!firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Non authentifié.',
      });
      return {success: false, count: 0};
    }

    let totalDeleted = 0;
    try {
      for (const collectionName of collectionsToDelete) {
        const collectionRef = collection(firestore, 'users', user.uid, collectionName);
        const snapshot = await getDocs(collectionRef);
        if (snapshot.empty) continue;

        const batches = [];
        let currentBatch = writeBatch(firestore);
        let operationsInBatch = 0;

        snapshot.docs.forEach((doc) => {
          currentBatch.delete(doc.ref);
          operationsInBatch++;
          totalDeleted++;
          if (operationsInBatch === 500) {
            batches.push(currentBatch);
            currentBatch = writeBatch(firestore);
            operationsInBatch = 0;
          }
        });

        if (operationsInBatch > 0) {
          batches.push(currentBatch);
        }
        await Promise.all(batches.map(batch => batch.commit()));
      }
      return {success: true, count: totalDeleted};
    } catch (error) {
      console.error('Failed to reset data:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur de réinitialisation',
        description: 'Une erreur est survenue. Consultez la console pour plus de détails.',
      });
      return {success: false, count: 0};
    }
  }

  const handlePartialReset = async () => {
    setIsResetting(true);
    const result = await performReset(['transactions', 'donations']);
    if(result.success) {
      toast({
        title: 'Réinitialisation terminée',
        description: `Les données de test (dons, transactions) ont été effacées. ${result.count} documents supprimés.`,
      });
    }
    setIsResetting(false);
    setIsAlertOpen(false);
  };
  
  const handleTotalReset = async () => {
    setIsTotalResetting(true);
    const result = await performReset(['transactions', 'donations', 'membre']);
     if(result.success) {
      toast({
        title: 'Réinitialisation totale terminée',
        description: `Toutes les données (membres, dons, transactions) ont été effacées. ${result.count} documents supprimés.`,
      });
    }
    setIsTotalResetting(false);
    setIsTotalAlertOpen(false);
  };


  return (
    <>
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle>Zone de Danger</CardTitle>
          <CardDescription>
            Ces actions sont irréversibles. Soyez absolument certain avant de continuer.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Réinitialiser les données de dons</h3>
              <p className="text-sm text-muted-foreground">
                Supprime tous les dons et transactions, mais conserve les membres.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setIsAlertOpen(true)}
              disabled={isResetting}
            >
              {isResetting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="mr-2 h-4 w-4" />
              )}
              Réinitialiser
            </Button>
          </div>

          <Separator />

           <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Réinitialisation totale</h3>
              <p className="text-sm text-muted-foreground">
                Supprime toutes les données : membres, dons et transactions.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setIsTotalAlertOpen(true)}
              disabled={isTotalResetting}
            >
              {isTotalResetting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="mr-2 h-4 w-4" />
              )}
              Réinitialisation Totale
            </Button>
          </div>

        </CardContent>
      </Card>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est **irréversible**. Elle supprimera définitivement **tous les dons et toutes les transactions**. Les membres seront conservés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePartialReset}
              disabled={isResetting}
              className="bg-destructive hover:bg-destructive/90"
            >
              Je comprends, tout supprimer sauf les membres
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isTotalAlertOpen} onOpenChange={setIsTotalAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est **extrêmement dangereuse et irréversible**. Elle supprimera définitivement **TOUTES les données** : membres, dons et transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTotalReset}
              disabled={isTotalResetting}
              className="bg-destructive hover:bg-destructive/90"
            >
              Je comprends, supprimer toutes les données
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
