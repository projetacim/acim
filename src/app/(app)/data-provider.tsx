
'use client'

import React, { createContext, useContext, ReactNode } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Donation, Member, DonationCategory } from '@/lib/types';
import { FirestoreError } from 'firebase/firestore';

interface DataContextState {
    members: (Member & { id: string; })[] | null;
    donations: (Donation & { id: string; })[] | null;
    categories: (DonationCategory & { id: string; })[] | null;
    isLoading: boolean;
    error: FirestoreError | Error | null;
}

const DataContext = createContext<DataContextState | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
    const firestore = useFirestore();
    const { user } = useUser();

    const membersCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'membre') : null, [firestore, user]);
    const donationsCollection = useMemoFirebase(() => user ? collection(firestore, 'users', user.uid, 'donations') : null, [firestore, user]);
    const categoriesCollection = useMemoFirebase(() => firestore ? collection(firestore, 'donationCategories') : null, [firestore]);

    const { data: members, isLoading: isLoadingMembers, error: membersError } = useCollection<Member>(membersCollection);
    const { data: donations, isLoading: isLoadingDonations, error: donationsError } = useCollection<Donation>(donationsCollection);
    const { data: categories, isLoading: isLoadingCategories, error: categoriesError } = useCollection<DonationCategory>(categoriesCollection);

    const isLoading = isLoadingMembers || isLoadingDonations || isLoadingCategories;
    const error = membersError || donationsError || categoriesError;

    const value: DataContextState = {
        members,
        donations,
        categories,
        isLoading,
        error
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
}

export function useData(): DataContextState {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
