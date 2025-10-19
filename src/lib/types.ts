

export type Member = {
  id: string;
  nom: string;
  email?: string;
  telephone?: string;
  adresse?: string;
  doc?: string;
  memo?: string;
  role?: string;
  membershipStatus: 'Active' | 'Inactive' | 'Pending';
  joinDate: string;
};

export type Payment = {
  amount: number;
  date: string; // ISO string
  paymentMethod: 'Carte de crédit' | 'Virement bancaire' | 'Espèces' | 'Chèque';
}

export type Donation = {
  id: string;
  memberId: string;
  type: 'Don' | 'Cotisation';
  donationCategoryId?: string;
  totalAmount: number;
  payments: Payment[];
  paymentStatus: 'EN ATTENTE' | 'Partiel' | 'Payé' | 'Annulé';
  memo?: string;
  cerfaEligible: boolean;
  ne_pas_relancer?: boolean;
  cerfaNumber?: string;
  cerfaDate?: string; // ISO string
  createdAt: string;
  reminders?: string[]; // Array of ISO date strings
  // CERFA specific fields, can be different from member's default info
  cerfaNom?: string;
  cerfaAdresse?: string;
  cerfaEmail?: string;
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
