export type Member = {
  id: string;
  nom: string;
  email: string;
  telephone?: string;
  adresse?: string;
  doc?: string;
  memo?: string;
  membershipStatus: 'Active' | 'Inactive' | 'Pending';
  joinDate: string;
  avatarUrl: string;
};

export type Donation = {
  id: string;
  memberId: string;
  type: 'Don' | 'Cotisation';
  donationCategoryId?: string;
  amount: number;
  paymentMethod: 'Carte de crédit' | 'Virement bancaire' | 'Espèces' | 'Chèque';
  date: string;
  memo?: string;
  cerfaEligible: boolean;
  createdAt: string;
};

export type Transaction = {
  id: string;
  type: 'Don' | 'Cotisation' | 'Événement';
  relatedId: string; // ID of the donation, event registration, etc.
  amount: number;
  date: string;
  paymentMethod: 'Carte de crédit' | 'Virement bancaire' | 'Espèces' | 'Chèque';
  memo?: string;
  createdAt: string;
};


export type DonationCategory = {
  id: string;
  name: string;
  description?: string;
};
