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

export function GeneralSettings() {
  const [isResetting, setIsResetting] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const handleReset = async () => {
    if (!firestore || !user) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Non authentifié.',
      });
      return;
    }

    setIsResetting(true);

    try {
      const collectionsToDelete = ['transactions', 'donations'];
      let totalDeleted = 0;

      for (const collectionName of collectionsToDelete) {
        const collectionRef = collection(firestore, 'users', user.uid, collectionName);
        const snapshot = await getDocs(collectionRef);
        if (snapshot.empty) continue;

        // Firestore limits batches to 500 operations
        const batches = [];
        let currentBatch = writeBatch(firestore);
        let operationsInBatch = 0;

        snapshot.docs.forEach((doc, index) => {
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


      toast({
        title: 'Réinitialisation terminée',
        description: `Toutes les données de test (dons, transactions) ont été effacées. ${totalDeleted} documents supprimés.`,
      });
    } catch (error) {
      console.error('Failed to reset data:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur de réinitialisation',
        description: 'Une erreur est survenue. Consultez la console pour plus de détails.',
      });
    } finally {
      setIsResetting(false);
      setIsAlertOpen(false);
    }
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
        <CardContent className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Réinitialiser les données de test</h3>
            <p className="text-sm text-muted-foreground">
              Supprime tous les dons et transactions, mais conserve les membres. Le compteur CERFA sera réinitialisé.
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
        </CardContent>
      </Card>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est **irréversible**. Elle supprimera définitivement **tous les dons et toutes les transactions**. Les membres seront conservés. Ceci est utile pour redémarrer une phase de test sans avoir à réimporter tous vos membres.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              disabled={isResetting}
              className="bg-destructive hover:bg-destructive/90"
            >
              Je comprends, tout supprimer sauf les membres
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
