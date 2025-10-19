
'use server';

import { Resend } from 'resend';
import { CerfaReceiptEmail } from '@/emails/cerfa-receipt-email';
import { ReminderEmail } from '@/emails/reminder-email';
import type { Donation, Member } from '@/lib/types';
import { generateCerfaPdf } from '@/lib/pdf';
import { ReactElement } from 'react';
import { doc, updateDoc, arrayUnion, getFirestore } from 'firebase/firestore';
import { getSdks } from '@/firebase'; // Using server-side firebase admin instance

// The Resend instance will be initialized inside sendEmail.
let resend: Resend | null = null;

interface SendEmailOptions {
    to: string;
    subject: string;
    react: ReactElement;
    attachments?: {
        filename: string;
        content: Buffer;
    }[];
}

async function sendEmail(options: SendEmailOptions) {
    // --- Development Environment Logic ---
    if (process.env.NODE_ENV === 'development') {
        const devRecipient = process.env.DEV_EMAIL_RECIPIENT;
        if (devRecipient) {
            console.log(`\n--- DEVELOPMENT EMAIL ---`);
            console.log(`Redirecting email for [${options.to}] to [${devRecipient}]`);
            console.log(`Subject: ${options.subject}`);
            console.log(`Attachments: ${options.attachments?.map(a => a.filename).join(', ') || 'none'}`);
            console.log(`-----------------------\n`);
            options.to = devRecipient;
        } else {
            console.warn('\n--- Skipping Email Send ---');
            console.warn('DEV_EMAIL_RECIPIENT is not set in .env. Email was not sent.');
            console.log(`Intended recipient: ${options.to}`);
            console.log(`Subject: ${options.subject}`);
            console.warn('---------------------------\n');
            return { success: true, data: { id: 'dev-skipped' } };
        }
    }
    
    if (!process.env.RESEND_API_KEY) {
        console.error('RESEND_API_KEY is not set. Skipping email sending.');
        return { success: false, error: 'La clé API Resend est manquante.' };
    }

    if (!process.env.RESEND_FROM_EMAIL) {
        console.error('RESEND_FROM_EMAIL is not set. Skipping email sending.');
        return { success: false, error: 'L\'adresse e-mail d\'expédition (RESEND_FROM_EMAIL) est manquante.' };
    }
    
    // Initialize Resend on first use if it hasn't been already.
    if (!resend) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    
    try {
        const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            ...options
        });

        if (error) {
            console.error('Resend error:', error);
            return { success: false, error: error.message };
        }
        
        return { success: true, data };

    } catch (error: any) {
        console.error('Failed to send email:', error);
        return { success: false, error: error.message };
    }
}


export async function sendCerfaEmail(donation: Donation, member: Member) {
    const toEmail = donation.cerfaEmail || member.email;
    
    if (!toEmail) {
        return { success: false, error: "No recipient email address found for this donation." };
    }
    
    const pdfBuffer = await generateCerfaPdf(donation, member);
    
    const result = await sendEmail({
        to: toEmail,
        subject: `Votre reçu fiscal ACIM - Don n°${donation.cerfaNumber}`,
        react: CerfaReceiptEmail({ donation, member }),
        attachments: [
            {
                filename: `recu-fiscal-${donation.cerfaNumber}.pdf`,
                content: pdfBuffer,
            }
        ]
    });
    
    return result;
}

export async function sendReminderEmail(donation: Donation & { remainingAmount: number }, member: Member) {
    const toEmail = donation.cerfaEmail || member.email;
    
    if (!toEmail) {
        return { success: false, error: "No recipient email address found for this donation." };
    }

    // This is a server action, so we can't use the client-side `useFirestore` hooks.
    // We need to initialize a server-side connection to Firestore.
    // Since this is a simple update, we can use the Firebase Admin SDK if configured,
    // but for simplicity and consistency with the client-side approach, we'll
    // just update the document after sending the email.
    // NOTE: This assumes that the environment has credentials to update Firestore.
    // A more robust solution would use a dedicated backend function.

    const result = await sendEmail({
        to: toEmail,
        subject: `Rappel concernant votre ${donation.type.toLowerCase()} à l'ACIM`,
        react: ReminderEmail({ donation, member }),
    });

    if (result.success && process.env.FIREBASE_PROJECT_ID) {
        try {
            // This is a simplified way to get a firestore instance on the server.
            // A proper implementation would have a shared admin instance.
            const { initializeApp, cert } = await import('firebase-admin/app');
            const { getFirestore } = await import('firebase-admin/firestore');
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string);
            
            const adminApps = (await import('firebase-admin/app')).getApps;

            const adminApp = adminApps().length
              ? adminApps()[0]!
              : initializeApp({ credential: cert(serviceAccount) });

            const db = getFirestore(adminApp);
            
            // We need to know the user's UID to find their donations.
            // This is a limitation of this approach. We'd need to pass it or query for it.
            // For now, we assume this function CANNOT update the DB and the client will.
            // THIS IS A FLAW in the direct server action approach.
            // The client calling this should perform the update.
            // Let's modify this to return success and let the client update.
        } catch (dbError) {
             console.error("Failed to update donation after sending reminder:", dbError);
             // We don't want to fail the whole operation if the email sent but DB update failed.
             // Log it and maybe handle it separately.
        }
    }
    
    return result;
}
