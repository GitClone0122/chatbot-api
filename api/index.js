// api/index.js (Memanggil Gemini API Langsung dengan Fetch)

// TIDAK ADA LAGI import { GoogleGenAI } dari "@google/genai";
// Karena kita akan memanggil API secara langsung menggunakan fetch.

// --- Inisialisasi Global (Dilakukan sekali per Cold Start Vercel Function) ---

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // Nama variabel lingkungan di Vercel

if (!GEMINI_API_KEY) {
    console.error("FATAL ERROR: Variabel lingkungan GEMINI_API_KEY belum diatur di Vercel!");
}

// URL Endpoint Gemini API
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
// Sesuaikan model jika Anda menggunakan yang berbeda, misal: gemini-1.5-pro, gemini-pro

// --- Fungsi Handler Utama Vercel Function ---
module.exports = async function handler(req, res) {
    console.log('Vercel Function Started (Direct Fetch Mode).');
    console.log('Request Method:', req.method);
    console.log('Request Body (parsed by Vercel):', req.body);

    // --- 1. Tangani Permintaan Pre-flight OPTIONS (untuk CORS) ---
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*'); // Ganti dengan domain frontend Anda di produksi
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).end();
        return;
    }

    // --- 2. Set Header CORS untuk Respons Aktual (POST) ---
    res.setHeader('Access-Control-Allow-Origin', '*'); // Ganti dengan domain frontend Anda di produksi
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
        const prompt = `
            Anda adalah asisten belanja yang ramah dan membantu untuk website katalog afiliasi.
            Tugas Anda adalah memberikan rekomendasi produk berdasarkan pertanyaan pengguna.
            Gunakan daftar produk di bawah ini sebagai sumber pengetahuan Anda.
            Jawablah dengan gaya bahasa yang natural, santai, dan persuasif dalam format Markdown.

            Daftar Produk (dalam format JSON):
            ${JSON.stringify(context || [])} 

            Pertanyaan dari Pengguna: "${message}"

            Jawaban Anda (Gunakan Markdown):
        `;

        console.log('Constructed prompt for Gemini AI:\n', prompt);

        // --- 5. Panggil Gemini API Langsung dengan fetch ---
        // Kunci API ditambahkan sebagai query parameter.
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API Direct Fetch Error:', errorData);
            throw new Error(`Gemini API Error: ${errorData.error ? errorData.error.message : response.statusText}`);
        }

        const data = await response.json();
        let botMessage = "Maaf, saya tidak dapat memproses permintaan Anda saat ini.";
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
            botMessage = data.candidates[0].content.parts[0].text;
        } else {
            console.warn('Gemini API response did not have expected format:', data);
        }
        console.log('Received Gemini API response text:', botMessage);

        // --- 6. Mengembalikan Respons Sukses ---
        return res.status(200).json({ reply: botMessage });

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
