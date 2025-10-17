import type { Member, Donation } from './types';

// This data is now only for fallback or initial demo purposes.
// The main data is fetched from Firestore.

export const members: Member[] = [
  {
    id: 'usr_1',
    nom: 'Alice Johnson',
    email: 'alice.j@example.com',
    telephone: '0102030405',
    adresse: '123 Main St, Anytown, USA',
    doc: 'ID_123',
    memo: 'VIP Member',
    membershipStatus: 'Active',
    joinDate: '2023-01-15T00:00:00.000Z',
    avatarUrl: 'https://picsum.photos/seed/1/40/40',
  },
  {
    id: 'usr_2',
    nom: 'Bob Williams',
    email: 'bob.w@example.com',
    telephone: '0607080910',
    adresse: '456 Oak Ave, Anytown, USA',
    doc: 'ID_456',
    memo: '',
    membershipStatus: 'Active',
    joinDate: '2022-11-20T00:00:00.000Z',
    avatarUrl: 'https://picsum.photos/seed/2/40/40',
  },
];

export const donations: Donation[] = [
  {
    id: 'don_1',
    memberId: 'usr_1',
    memberName: 'Alice Johnson',
    amount: 100,
    date: '2024-04-20',
    paymentMethod: 'Credit Card',
  },
  {
    id: 'don_2',
    memberId: 'usr_2',
    memberName: 'Bob Williams',
    amount: 50,
    date: '2024-04-18',
    paymentMethod: 'PayPal',
  },
  {
    id: 'don_3',
    memberId: 'usr_5',
    memberName: 'Ethan Hunt',
    amount: 250,
    date: '2024-04-15',
    paymentMethod: 'Bank Transfer',
  },
  {
    id: 'don_4',
    memberId: 'usr_1',
    memberName: 'Alice Johnson',
    amount: 75,
    date: '2024-03-22',
    paymentMethod: 'Credit Card',
  },
  {
    id: 'don_5',
    memberId: 'usr_4',
    memberName: 'Diana Prince',
    amount: 500,
    date: '2024-05-02',
    paymentMethod: 'Check',
  },
];
