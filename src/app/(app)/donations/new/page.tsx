'use client';

import { DonationForm } from '../components/donation-form';
import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Member } from '@/lib/types';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { ChevronsUpDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// --- Test Combobox Component ---
function TestMemberCombobox() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  
  const membersCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'membre') : null, [firestore, user]);
  const { data: members, isLoading } = useCollection<Member>(membersCollection);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Chargement des membres...</span>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[300px] justify-between"
        >
          {value
            ? members?.find((member) => member.id === value)?.nom
            : "Sélectionner un membre (Test)..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Rechercher un membre..." />
          <CommandList>
            <CommandEmpty>Aucun membre trouvé.</CommandEmpty>
            <CommandGroup>
              {members?.map((member) => (
                <CommandItem
                  key={member.id}
                  value={member.nom}
                  onSelect={() => {
                    setValue(member.id === value ? '' : member.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === member.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {member.nom}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}


export default function NewDonationPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      <Card>
        <CardHeader>
          <CardTitle>Boîte de dialogue de test</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-muted-foreground">Ce sélecteur est isolé pour tester la fonctionnalité. S'il fonctionne, le problème se situe dans le formulaire ci-dessous.</p>
          <TestMemberCombobox />
        </CardContent>
      </Card>
      
      <div>
        <div className="space-y-1 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Ajouter un don/cotisation</h1>
          <p className="text-muted-foreground">
            Remplissez les détails ci-dessous pour enregistrer un nouveau don ou une nouvelle cotisation.
          </p>
        </div>
        <DonationForm />
      </div>
    </div>
  );
}
