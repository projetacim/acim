import type { Member, Donation } from './types';

export const members: Member[] = [
  {
    id: 'usr_1',
    nom: 'Alice Johnson',
    email: 'alice.j@example.com',
    membershipStatus: 'Active',
    joinDate: '2023-01-15',
    avatarUrl: 'https://picsum.photos/seed/1/40/40',
  },
  {
    id: 'usr_2',
    nom: 'Bob Williams',
    email: 'bob.w@example.com',
    membershipStatus: 'Active',
    joinDate: '2022-11-20',
    avatarUrl: 'https://picsum.photos/seed/2/40/40',
  },
  {
    id: 'usr_3',
    nom: 'Charlie Brown',
    email: 'charlie.b@example.com',
    membershipStatus: 'Inactive',
    joinDate: '2023-03-10',
    avatarUrl: 'https://picsum.photos/seed/3/40/40',
  },
  {
    id: 'usr_4',
    nom: 'Diana Prince',
    email: 'diana.p@example.com',
    membershipStatus: 'Pending',
    joinDate: '2024-05-01',
    avatarUrl: 'https://picsum.photos/seed/4/40/40',
  },
  {
    id: 'usr_5',
    nom: 'Ethan Hunt',
    email: 'ethan.h@example.com',
    membershipStatus: 'Active',
    joinDate: '2021-08-25',
    avatarUrl: 'https://picsum.photos/seed/5/40/40',
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
