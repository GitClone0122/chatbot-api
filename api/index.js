// api/chatbot.js

// Mengimpor SDK Google Gemini (@google/genai)
// Pastikan Anda telah menginstal ini di proyek Vercel Anda: npm install @google/genai
import { GoogleGenAI } from "@google/genai";

// --- Inisialisasi Global (Dilakukan sekali per Cold Start Vercel Function) ---

// Mengambil Kunci API Gemini dari Environment Variables yang dikonfigurasi di Vercel Dashboard.
// Variabel lingkungan ini aman dan tidak akan diekspos ke frontend.
const API_KEY = process.env.GEMINI_API_KEY;

// Lakukan validasi API Key saat inisialisasi di luar handler untuk efisiensi.
// Jika API Key tidak ada, ini akan menyebabkan fungsi error saat Cold Start
// dan akan terlihat di log Vercel, menghasilkan respons 500 saat diakses.
if (!API_KEY) {
    console.error("FATAL ERROR: Variabel lingkungan GEMINI_API_KEY belum diatur di Vercel!");
    // Dalam lingkungan Vercel, melemparkan error di sini akan menyebabkan 'internal server error'
    // yang akan ditangkap oleh Vercel.
}

// Inisialisasi klien AI dengan Kunci API Anda.
// Objek genAI dan model ini akan diinisialisasi sekali per instance Vercel Function Cold Start.
const genAI = new GoogleGenAI(API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' }); // Sesuaikan dengan model Gemini yang Anda ingin gunakan

// --- Fungsi Handler Utama Vercel Function ---
// Fungsi ini adalah default export yang akan dipanggil oleh Vercel setiap kali ada permintaan HTTP.
// Menerima objek 'req' (permintaan HTTP) dan 'res' (respons HTTP) yang mirip dengan Express.js.
export default async function handler(req, res) {
    // Log awal untuk debugging di log Vercel.
    console.log('Vercel Function Started.');
    console.log('Request Method:', req.method);
    // Vercel secara otomatis mem-parse body JSON jika Content-Type adalah application/json.
    console.log('Request Body (parsed by Vercel):', req.body); 

    // --- 1. Tangani Permintaan Pre-flight OPTIONS (untuk CORS) ---
    // Browser akan mengirim permintaan HTTP OPTIONS sebelum permintaan POST yang sebenarnya
    // untuk memeriksa apakah permintaan lintas asal (cross-origin) diizinkan.
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*'); // Ganti dengan domain spesifik frontend Anda untuk produksi (misal: 'https://nama-domain-anda.com')
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Metode HTTP yang diizinkan untuk permintaan lintas asal
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Header permintaan yang diizinkan dari klien
        res.status(204).end(); // Mengirim respons 204 No Content untuk permintaan OPTIONS yang berhasil
        return; // Mengakhiri eksekusi fungsi setelah menangani OPTIONS
    }

    // --- 2. Set Header CORS untuk Respons Aktual (POST) ---
    // Header ini diperlukan agar respons dari Vercel Function dapat diterima oleh frontend Anda.
    res.setHeader('Access-Control-Allow-Origin', '*'); // Ganti dengan domain spesifik frontend Anda untuk produksi
    res.setHeader('Access-Control-Allow-Methods', 'POST'); // Pastikan metode POST diizinkan
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // --- 3. Pastikan Metode HTTP adalah POST ---
    // Fungsi ini dirancang untuk menerima permintaan POST dengan body JSON.
    if (req.method !== 'POST') {
        console.warn(`Method Not Allowed: ${req.method} request received. Only POST is supported.`);
        return res.status(405).json({ error: 'Method Not Allowed. Only POST requests are supported.' });
    }

    // --- 4. Proses Body Permintaan POST ---
    try {
        // Vercel secara otomatis mem-parse body JSON dari permintaan jika Content-Type adalah 'application/json'.
        // Kita langsung dapat mengakses properti dari req.body.
        const { message, context } = req.body; 

        // Validasi dasar: Pastikan pesan pengguna tidak kosong.
        if (!message) {
            console.error('Validation Error: User message is empty in the request body.');
            return res.status(400).json({ error: 'User message cannot be empty.' }); // Mengembalikan status 400 Bad Request
        }

        // --- 5. Membangun Prompt untuk Gemini AI ---
        // Prompt ini memberikan instruksi kepada model AI dan menyertakan data relevan dari frontend.
        // productContext akan dikonversi menjadi string JSON di dalam prompt.
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

        // --- 6. Panggil Gemini API ---
        console.log('Making call to Gemini API...');
        const result = await model.generateContent(prompt);
        console.log('Gemini API call successful. Retrieving response...');

        const response = await result.response;
        const botMessage = response.text(); // Mengambil teks respons dari model AI
        console.log('Received Gemini API response text:', botMessage);

        // --- 7. Mengembalikan Respons Sukses ke Frontend ---
        // Mengirim respons JSON dengan status 200 OK.
        // Properti 'reply' digunakan agar frontend Anda mudah mengakses respons AI.
        return res.status(200).json({ reply: botMessage }); 

    } catch (error) {
        // --- 8. Penanganan Error Umum ---
        // Menangkap setiap error yang terjadi dalam blok try dan mencatatnya di log Vercel.
        console.error('FATAL ERROR in Vercel Function during execution:', error);
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        console.error('Error Stack:', error.stack); // Stack trace sangat membantu debugging

        // Mengembalikan respons error yang informatif ke frontend dengan status 500 Internal Server Error.
        // Untuk produksi, pertimbangkan untuk tidak menampilkan stack trace lengkap di respons frontend.
        return res.status(500).json({
            error: `An unexpected server error occurred: ${error.message}`,
            // detail: error.stack // Uncomment for more detailed debugging in development/staging
        });
    }
}
