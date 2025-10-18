
'use client';

import { generateCerfaPdf } from '@/lib/pdf';
import type { Donation, Member } from '@/lib/types';

// This function needs to be a client-side function to open a new window
export async function openCerfaPdf(donation: Donation, member: Member) {
    try {
        const pdfBytesAsArray = await generateCerfaPdf(donation, member).then(buffer => Array.from(new Uint8Array(buffer)));
        const pdfBytes = new Uint8Array(pdfBytesAsArray);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } catch (error) {
        console.error("Failed to generate or open PDF:", error);
        // You might want to show a toast to the user here
    }
}
