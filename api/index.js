// api/index.js

// TIDAK ADA LAGI import { GoogleGenAI } dari "@google/genai";
// Karena kita akan memanggil API secara langsung menggunakan fetch.

// --- Inisialisasi Global ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

if (!GEMINI_API_KEY) {
    console.error("FATAL ERROR: Variabel lingkungan GEMINI_API_KEY belum diatur di Vercel!");
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// --- Fungsi Handler Utama Vercel Function ---
module.exports = async function handler(req, res) {
    console.log('Vercel Function Started (Direct Fetch Mode).');
    console.log('Request Method:', req.method);
    console.log('Request Body (parsed by Vercel):', req.body);

    // --- 1. Tangani Permintaan Pre-flight OPTIONS (untuk CORS) ---
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', 'https://khoira.biz.id'); 
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).end();
        return;
    }

    // --- 2. Set Header CORS untuk Respons Aktual (POST) ---
    res.setHeader('Access-Control-Allow-Origin', 'https://khoira.biz.id'); 
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // --- 3. Pastikan Metode HTTP adalah POST ---
    if (req.method !== 'POST') {
        console.warn(`Method Not Allowed: ${req.method} request received.`);
        return res.status(405).json({ error: 'Method Not Allowed. Only POST requests are supported.' });
    }

    try {
        const { message, context } = req.body;

        if (!message) {
            console.error('Validation Error: User message is empty.');
            return res.status(400).json({ error: 'User message cannot be empty.' });
        }

        // --- 4. Buat Prompt untuk Gemini AI ---
        // Prompt sekarang akan meminta AI untuk mengembalikan data produk dalam format JSON
        const prompt = `
            Anda adalah asisten belanja yang ramah dan membantu untuk website katalog afiliasi.
            Tugas Anda adalah merekomendasikan produk dari daftar yang diberikan berdasarkan pertanyaan pengguna.
            Jika ada produk yang relevan, **berikan respons dalam format JSON Array** yang berisi objek-objek produk yang direkomendasikan.
            Setiap objek produk harus memiliki properti yang sama seperti dalam daftar produk yang Anda terima (id, name, description, imageUrl, price, rating, shopeeUrl, tokopediaUrl, dll).
            Jika tidak ada produk yang relevan, atau pertanyaan di luar lingkup rekomendasi produk, **berikan respons JSON dengan properti "text"** yang berisi pesan tekstual biasa.
            **Penting:** Selalu balas dalam format JSON.

            Daftar Produk yang Tersedia (dalam format JSON):
            ${JSON.stringify(context || [])} 

            Pertanyaan dari Pengguna: "${message}"

            Format Respons JSON (jika rekomendasi produk):
            [
                {
                    "id": "string",
                    "name": "string",
                    "description": "string",
                    "imageUrl": "string",
                    "price": number,
                    "rating": number,
                    "shopeeUrl": "string",
                    "tokopediaUrl": "string"
                }
            ]

            Format Respons JSON (jika pesan tekstual biasa):
            {
                "text": "string"
            }
        `;

        console.log('Constructed prompt for Gemini AI:\n', prompt);

        // --- 5. Panggil Gemini API Langsung dengan fetch ---
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // TAMBAHKAN generationConfig untuk meminta respons JSON terstruktur!
                generationConfig: {
                    responseMimeType: "application/json",
                    // responseSchema: { ... } // Schema bisa lebih spesifik jika diperlukan, tapi AI cukup pintar dengan instruksi prompt
                },
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API Direct Fetch Error:', errorData);
            throw new Error(`Gemini API Error: ${errorData.error ? errorData.error.message : response.statusText}`);
        }

        const data = await response.json();
        let aiResponseContent = null;
        
        // Pastikan respons AI adalah JSON yang valid
        if (data.candidates && data.candidates.length > 0 && 
            data.candidates[0].content && data.candidates[0].content.parts &&
            data.candidates[0].content.parts.length > 0) {
            
            const rawTextResponse = data.candidates[0].content.parts[0].text;
            console.log('Raw text response from Gemini API:', rawTextResponse);

            try {
                // Coba parse respons AI sebagai JSON
                aiResponseContent = JSON.parse(rawTextResponse);
                console.log('Parsed AI response content:', aiResponseContent);
            } catch (parseJsonError) {
                console.error('ERROR: Could not parse AI response as JSON:', parseJsonError);
                console.error('AI Raw Text Response:', rawTextResponse);
                // Jika tidak bisa di-parse sebagai JSON, anggap itu adalah pesan biasa
                aiResponseContent = { text: "Maaf, saya kesulitan memahami respons dari AI." };
            }
        } else {
            console.warn('Gemini API response did not have expected structure or content:', data);
            aiResponseContent = { text: "Maaf, saya tidak dapat memproses permintaan Anda saat ini." };
        }

        // --- 6. Mengembalikan Respons Sukses ---
        // Mengembalikan objek yang berisi 'reply' (untuk pesan teks) atau 'products' (untuk rekomendasi)
        // Kita akan deteksi di frontend apakah itu pesan teks atau array produk.
        if (Array.isArray(aiResponseContent)) {
            // Jika AI mengembalikan array (rekomendasi produk)
            return res.status(200).json({ products: aiResponseContent });
        } else if (aiResponseContent && typeof aiResponseContent.text === 'string') {
            // Jika AI mengembalikan objek dengan properti 'text' (pesan biasa)
            return res.status(200).json({ reply: aiResponseContent.text });
        } else {
            // Fallback jika format tidak sesuai harapan
            return res.status(200).json({ reply: "Maaf, saya tidak dapat memproses rekomendasi saat ini." });
        }

    } catch (error) {
        // --- 7. Penanganan Error Umum ---
        console.error('FATAL ERROR in Vercel Function (Direct Fetch Mode):', error);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);

        return res.status(500).json({
            error: `An unexpected server error occurred: ${error.message}`,
        });
    }
};
