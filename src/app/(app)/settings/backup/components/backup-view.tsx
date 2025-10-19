'use client';

import { useState } from 'react';
import { useData } from '@/app/(app)/data-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, Loader2 } from 'lucide-react';
import backendConfig from '@/../docs/backend.json';

type CollectionName = 'members' | 'donations' | 'transactions' | 'categories';

export function BackupView() {
  const { members, donations, transactions, categories, isLoading } = useData();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState<CollectionName | 'all' | 'config' | null>(null);

  const collections = {
    members,
    donations,
    transactions,
    categories,
  };

  const exportToJson = (data: any, fileName: string) => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur durant l\'exportation JSON :', error);
      toast({
        variant: 'destructive',
        title: 'Erreur d\'exportation',
        description: 'La création du fichier de sauvegarde a échoué.',
      });
    }
  };

  const handleExport = (collectionName: CollectionName | 'all' | 'config') => {
    setIsExporting(collectionName);

    // Use a timeout to allow the UI to update to show the loader
    setTimeout(() => {
      const date = new Date().toISOString().split('T')[0];

      if (collectionName === 'all') {
        const allData = {
          members: collections.members,
          donations: collections.donations,
          transactions: collections.transactions,
          categories: collections.categories,
        };
        exportToJson(allData, `sauvegarde-complete-${date}.json`);
        toast({ title: 'Exportation complète réussie' });
      } else if (collectionName === 'config') {
        exportToJson(backendConfig, `sauvegarde-config-${date}.json`);
        toast({ title: 'Exportation de la configuration réussie' });
      } else {
        const data = collections[collectionName];
        if (data) {
          exportToJson(data, `sauvegarde-${collectionName}-${date}.json`);
          toast({ title: `Exportation ${collectionName} réussie` });
        }
      }
      setIsExporting(null);
    }, 500);
  };
  
  const collectionMetadata = [
      { name: 'Membres', key: 'members', data: members },
      { name: 'Dons', key: 'donations', data: donations },
      { name: 'Transactions', key: 'transactions', data: transactions },
      { name: 'Catégories', key: 'categories', data: categories },
  ] as const;

  return (
    <div className="grid gap-8">
       <Card>
        <CardHeader>
          <CardTitle>Sauvegarde Complète</CardTitle>
          <CardDescription>
            Téléchargez un fichier JSON unique contenant toutes les données de l'application (membres, dons, transactions, catégories).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => handleExport('all')} disabled={isLoading || isExporting !== null}>
            {isExporting === 'all' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Télécharger la sauvegarde complète
          </Button>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Sauvegardes Individuelles</CardTitle>
          <CardDescription>
            Téléchargez les données pour des collections spécifiques au format JSON.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {collectionMetadata.map(meta => (
            <div key={meta.key} className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <h3 className="font-semibold">{meta.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {isLoading ? 'Chargement...' : `${meta.data?.length || 0} enregistrements`}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleExport(meta.key)} 
                disabled={isLoading || isExporting !== null}
              >
                 {isExporting === meta.key ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Download className="mr-2 h-4 w-4" />
                )}
                Exporter
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sauvegarde de la Configuration</CardTitle>
          <CardDescription>
            Téléchargez le fichier `backend.json` qui décrit la structure de votre base de données.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => handleExport('config')} disabled={isExporting !== null} variant="secondary">
            {isExporting === 'config' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Télécharger backend.json
          </Button>
        </CardContent>
      </Card>

    </div>
  );
}
