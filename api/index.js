// api/index.js (Menggunakan require() untuk CommonJS)

// Mengimpor SDK Google Gemini menggunakan sintaks CommonJS (require)
// Ini akan memaksa Vercel untuk menggunakan distribusi CommonJS dari SDK.
const { GoogleGenAI } = require("@google/genai");

// --- Inisialisasi Global (Dilakukan sekali per Cold Start Vercel Function) ---

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    console.error("FATAL ERROR: Variabel lingkungan GEMINI_API_KEY belum diatur di Vercel!");
}

const genAI = new GoogleGenAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Sesuaikan model jika perlu

// --- Fungsi Handler Utama Vercel Function (menggunakan CommonJS) ---
// Ini adalah fungsi yang akan diekspor sebagai handler utama untuk Vercel.
module.exports = async function handler(req, res) { // Menggunakan module.exports = async function
    console.log('Vercel Function Started (CommonJS Mode).');
    console.log('Request Method:', req.method);
    console.log('Request Body (parsed by Vercel):', req.body);

    // --- 1. Tangani Permintaan Pre-flight OPTIONS (untuk CORS) ---
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*'); // Ganti dengan domain frontend Anda untuk produksi
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.status(204).end();
        return;
    }

    // --- 2. Set Header CORS untuk Respons Aktual (POST) ---
    res.setHeader('Access-Control-Allow-Origin', '*'); // Ganti dengan domain frontend Anda untuk produksi
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

        // --- 5. Panggil Gemini API ---
        console.log('Making call to Gemini API...');
        const result = await model.generateContent(prompt);
        console.log('Gemini API call successful. Retrieving response...');

        const response = await result.response;
        const botMessage = response.text();
        console.log('Received Gemini API response text:', botMessage);

        // --- 6. Mengembalikan Respons Sukses ---
        return res.status(200).json({ reply: botMessage });

    } catch (error) {
        // --- 7. Penanganan Error Umum ---
        console.error('FATAL ERROR in Vercel Function during execution (CommonJS Mode):', error);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack);

        return res.status(500).json({
            error: `An unexpected server error occurred: ${error.message}`,
            // detail: error.stack
        });
    }
};
